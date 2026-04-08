import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { INTERESTS } from "@/types";
import { Playfair_Display } from "next/font/google";
import {
  MapPin,
  Bookmark,
  Plus,
  Compass,
  Calendar,
} from "lucide-react";
import { AddTripButton } from "@/components/features/home/AddTripModal";
import { getTripCoverImage } from "@/lib/destination-images";
import { DropLinkTile } from "@/components/features/home/DropLinkTile";
import { SourceFilterSaves } from "@/components/features/home/SourceFilterSaves";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "900"] });

const CARD_GRADIENT = "linear-gradient(to bottom, transparent 0%, transparent 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.85) 100%)";

function getGreeting() {
  const hour = new Date().getUTCHours() + 9;
  const h = hour % 24;
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDateRange(start: Date | null, end: Date | null) {
  if (!start) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  if (!end) return startStr;
  const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startStr} – ${endStr}`;
}

function getMemberAgeLabel(role: string, birthDate: Date | null): string {
  if (role === "ADULT") return "Adult";
  if (!birthDate) return "Child";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return `Age ${age}`;
}

const STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};
const STATUS_COLOR: Record<string, { text: string }> = {
  PLANNING: { text: "#6B8F71" },
  ACTIVE: { text: "#C4664A" },
  COMPLETED: { text: "#717171" },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: {
      familyProfile: {
        include: {
          members: true,
          interests: true,
          trips: {
            orderBy: { startDate: "asc" },
          },
          savedItems: {
            orderBy: { savedAt: "desc" },
            take: 20,
          },
        },
      },
    },
  });

  const profile = user?.familyProfile;
  if (!profile) redirect("/onboarding");

  // Only PLANNING/ACTIVE trips for save-to dropdowns (excludes community templates)
  const activePlannedTrips = profile.trips.filter(
    (t) => t.status === "PLANNING" || t.status === "ACTIVE"
  );

  // Top community trips for "Popular with Flokk families"
  // Fetch broadly then JS-filter: seeded community trips share familyProfileId with user in dev
  const rawCommunityTrips = await db.trip.findMany({
    where: { privacy: "PUBLIC", status: "COMPLETED" },
    select: {
      id: true,
      familyProfileId: true,
      title: true,
      destinationCity: true,
      destinationCountry: true,
      startDate: true,
      endDate: true,
      heroImageUrl: true,
      _count: { select: { savedItems: true } },
      familyProfile: { select: { familyName: true } },
    },
    orderBy: { savedItems: { _count: "desc" } },
    take: 20,
  });

  const activeCities = new Set(
    activePlannedTrips
      .map((t) => t.destinationCity?.toLowerCase())
      .filter((c): c is string => Boolean(c))
  );

  const communityTrips = rawCommunityTrips
    .filter((t) => t.familyProfileId !== profile.id || t.id.startsWith("cmtrip-"))
    .filter((t) => !activeCities.has(t.destinationCity?.toLowerCase() ?? ""))
    .slice(0, 4);

  // Deduplicate saved items by rawTitle (keeps most recent), then take 6
  const seenTitles = new Set<string>();
  const dedupedSaves = profile.savedItems.filter(item => {
    const key = item.rawTitle ?? item.id;
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  }).slice(0, 6);

  const greeting = getGreeting();
  const rawName = profile.familyName || user?.email?.split("@")[0] || "there";
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const today = new Date();
  const futureTrips = profile.trips.filter((t) => t.startDate && t.startDate > today);
  const completedTrips = profile.trips.filter(
    (t) => t.status === "COMPLETED" && !t.id.startsWith("cmtrip-")
  );
  const heroTrip = futureTrips[0] ?? completedTrips[completedTrips.length - 1] ?? null;
  const sidebarTrip = futureTrips[1] ?? null;
  const hasCompletedTrips = completedTrips.length > 0;
  const heroCover = getTripCoverImage(heroTrip?.destinationCity, heroTrip?.destinationCountry, heroTrip?.heroImageUrl);
  const sidebarCover = getTripCoverImage(sidebarTrip?.destinationCity, sidebarTrip?.destinationCountry, sidebarTrip?.heroImageUrl);

  const adultCount = profile.members.filter((m) => m.role === "ADULT").length;
  const kidCount = profile.members.filter((m) => m.role === "CHILD").length;

  const interestKeys = profile.interests.map((i) => i.interestKey);
  const myInterests = INTERESTS.filter((i) => interestKeys.includes(i.key));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", paddingBottom: "80px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px 0" }}>

        {/* ── Page greeting ── */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A" }}>
            {greeting}
          </p>
          <h1 className={playfair.className} style={{ color: "#1a1a1a", fontSize: "28px", fontWeight: 900, lineHeight: 1.2 }}>
            {displayName}
          </h1>
        </div>

        {/* ── Two-column layout ── */}
        <div className="flex flex-col md:flex-row" style={{ gap: "20px" }}>

          {/* ── LEFT COLUMN — display:contents on mobile so children reorder freely ── */}
          <div className="contents md:flex md:flex-col" style={{ flex: "0 0 60%", minWidth: 0, gap: "20px" }}>

            {/* Hero trip card — mobile order 1 */}
            <div className="order-1 md:order-none">
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "24px",
                height: "380px",
                backgroundImage: `url('${heroCover}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0) 100%)", zIndex: 1 }} />
              {/* Status pill — top left */}
              <div style={{ position: "absolute", top: "16px", left: "16px", zIndex: 3 }}>
                {heroTrip ? (
                  <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", color: "#fff", borderRadius: "999px", padding: "5px 12px" }}>
                    {heroTrip.status === "ACTIVE" ? "Now traveling" : heroTrip.status === "COMPLETED" ? "Last trip" : "Up next"}
                  </span>
                ) : (
                  <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", color: "#fff", borderRadius: "999px", padding: "5px 12px" }}>
                    No trips planned
                  </span>
                )}
              </div>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "24px 24px 18px 24px", zIndex: 2 }}>
                <p className={playfair.className} style={{ color: "#fff", fontSize: "36px", fontWeight: 900, lineHeight: 1.2, marginTop: "4px", textShadow: "0px 2px 12px rgba(0,0,0,0.95)" }}>
                  {heroTrip ? heroTrip.title : "Where to next?"}
                </p>
                {heroTrip?.destinationCity && (
                  <p style={{ fontSize: "14px", color: "#ccc", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                    <MapPin size={13} />
                    {heroTrip.destinationCity}{heroTrip.destinationCountry ? `, ${heroTrip.destinationCountry}` : ""}
                  </p>
                )}
                {!heroTrip && (
                  <p style={{ fontSize: "14px", fontStyle: "italic", color: "rgba(255,255,255,0.65)", marginTop: "8px" }}>
                    Save it, plan it, book it, share it.
                  </p>
                )}
                {heroTrip ? (
                  <Link
                    href={`/trips/${heroTrip.id}`}
                    style={{ alignSelf: "flex-start", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", fontSize: "14px", marginTop: "12px", backgroundColor: "#C4664A", color: "#fff", textDecoration: "none" }}
                  >
                    View trip
                  </Link>
                ) : (
                  <Link
                    href="/trips"
                    style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, padding: "10px 20px", borderRadius: "999px", fontSize: "14px", marginTop: "12px", backgroundColor: "#1B3A5C", color: "#fff", textDecoration: "none" }}
                  >
                    Plan a trip
                  </Link>
                )}
              </div>
            </div>
            </div>{/* end hero order wrapper */}

            {/* Quick action tiles — mobile order 5 */}
            <div className="order-5 md:order-none">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <DropLinkTile trips={activePlannedTrips.map(t => ({ id: t.id, title: t.title, startDate: t.startDate ? t.startDate.toISOString() : null, endDate: t.endDate ? t.endDate.toISOString() : null }))} />
              <Link
                href={heroTrip ? `/trips/${heroTrip.id}?tab=recommended` : "/discover"}
                style={{ position: "relative", borderRadius: "16px", overflow: "hidden", display: "block", height: "160px", backgroundImage: "url('https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80')", backgroundSize: "cover", backgroundPosition: "center", textDecoration: "none" }}
              >
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
                <div style={{ position: "absolute", inset: 0, background: CARD_GRADIENT }} />
                <div style={{ position: "relative", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", boxSizing: "border-box" }}>
                  <Compass size={20} style={{ color: "#fff", marginBottom: "8px" }} />
                  <p style={{ fontWeight: 700, color: "#fff", fontSize: "17px" }}>Get inspired</p>
                  <p style={{ color: "#fff", fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>Picked for your family</p>
                </div>
              </Link>
            </div>
            </div>{/* end tiles order wrapper */}

            {/* Source filter + recent saves — mobile order 6/7 */}
            <div className="order-6 md:order-none">
            <SourceFilterSaves
              items={dedupedSaves.map(item => ({
                id: item.id,
                rawTitle: item.rawTitle,
                placePhotoUrl: item.placePhotoUrl,
                mediaThumbnailUrl: item.mediaThumbnailUrl,
                destinationCity: item.destinationCity,
                destinationCountry: item.destinationCountry,
                categoryTags: item.categoryTags,
                sourceType: item.sourceType,
              }))}
              trips={activePlannedTrips.map(t => ({ id: t.id, title: t.title, startDate: t.startDate ? t.startDate.toISOString() : null, endDate: t.endDate ? t.endDate.toISOString() : null }))}
            />
            </div>{/* end source filter wrapper */}

          </div>

          {/* ── RIGHT COLUMN — display:contents on mobile ── */}
          <div className="contents md:flex md:flex-col md:border-l md:pl-8" style={{ flex: "0 0 40%", minWidth: 0, gap: "20px", borderColor: "rgba(0,0,0,0.06)" }}>

            {/* Your interests — mobile order 2 */}
            <div className="order-2 md:order-none">
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h2 style={{ fontWeight: 700, color: "#1a1a1a", fontSize: "15px" }}>Your interests</h2>
                <Link href="/profile/interests" style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}>
                  Edit
                </Link>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {myInterests.slice(0, 5).map((interest) => (
                  <span
                    key={interest.key}
                    style={{ backgroundColor: "#C4664A", color: "#fff", fontWeight: 600, padding: "8px 16px", borderRadius: "999px", fontSize: "13px" }}
                  >
                    {interest.label}
                  </span>
                ))}
                {myInterests.length > 5 && (
                  <Link href="/profile/interests" style={{ textDecoration: "none", backgroundColor: "rgba(0,0,0,0.05)", color: "#717171", fontWeight: 600, padding: "8px 16px", borderRadius: "999px", fontSize: "13px" }}>
                    +{myInterests.length - 5} more
                  </Link>
                )}
              </div>
            </div>
            </div>{/* end interests order wrapper */}

            {/* Your trips — mobile order 3 */}
            <div className="order-3 md:order-none">
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h2 style={{ fontWeight: 700, color: "#1a1a1a", fontSize: "15px" }}>Your trips</h2>
                <AddTripButton />
              </div>
              {sidebarTrip ? (
                <Link href={`/trips/${sidebarTrip.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ backgroundColor: "#fff", borderRadius: "20px", overflow: "hidden", border: "1.5px solid #EEEEEE", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                    {/* Hero photo */}
                    <div style={{ height: "110px", position: "relative", overflow: "hidden", backgroundImage: `url('${sidebarCover}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
                      <div style={{ position: "absolute", bottom: "12px", left: "16px", zIndex: 2 }}>
                        <p style={{ fontSize: "20px", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{sidebarTrip.title}</p>
                      </div>
                      <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 2, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: "20px", padding: "3px 10px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: (STATUS_COLOR[sidebarTrip.status] ?? STATUS_COLOR.PLANNING).text }}>
                          {STATUS_LABEL[sidebarTrip.status]}
                        </span>
                      </div>
                    </div>
                    {/* Details */}
                    <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {(sidebarTrip.destinationCity || sidebarTrip.destinationCountry) && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <MapPin size={13} style={{ color: "#C4664A", flexShrink: 0 }} />
                            <span style={{ fontSize: "13px", color: "#2d2d2d", fontWeight: 600 }}>
                              {[sidebarTrip.destinationCity, sidebarTrip.destinationCountry].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <Calendar size={13} style={{ color: "#717171", flexShrink: 0 }} />
                          <span style={{ fontSize: "13px", color: "#717171" }}>
                            {formatDateRange(sidebarTrip.startDate, sidebarTrip.endDate) ?? ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div style={{ backgroundColor: "#1B3A5C", borderRadius: "20px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: "8px" }}>What&apos;s next for your family?</p>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: "16px" }}>
                    Plan your next adventure and build your trip from scratch.
                  </p>
                  <Link
                    href="/trips/new"
                    style={{ display: "inline-block", fontSize: "13px", fontWeight: 700, padding: "9px 18px", borderRadius: "999px", backgroundColor: "#C4664A", color: "#fff", textDecoration: "none" }}
                  >
                    Plan a trip
                  </Link>
                </div>
              )}
            </div>

            {/* Past trip nudge — shown when user has no completed trips */}
            {!hasCompletedTrips && (
              <div style={{ marginTop: "16px", backgroundColor: "rgba(196,102,74,0.05)", borderRadius: "14px", padding: "16px 18px", border: "1px solid rgba(196,102,74,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <p style={{ fontSize: "13px", color: "#717171", lineHeight: 1.5, flex: 1 }}>
                  Been on a great trip? Your experience helps other families plan theirs.
                </p>
                <Link
                  href="/trips/past/new"
                  style={{ flexShrink: 0, fontSize: "13px", fontWeight: 700, color: "#C4664A", textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  Add a past trip →
                </Link>
              </div>
            )}
            </div>{/* end trips order wrapper */}

            {/* Your crew — mobile order 4 */}
            <div className="order-4 md:order-none">
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h2 style={{ fontWeight: 700, color: "#1a1a1a", fontSize: "15px" }}>
                  {profile.familyName ? `${profile.familyName} crew` : "Your crew"}
                </h2>
                <Link href="/family" style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}>
                  Edit family
                </Link>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {(() => {
                  const adults = profile.members.filter((m) => m.role === "ADULT");
                  const children = profile.members.filter((m) => m.role === "CHILD");
                  const allMembers = [...adults, ...children];
                  return allMembers.map((member, i) => {
                    const isAdult = member.role === "ADULT";
                    const avatarBg = isAdult ? "#C4664A" : "#1B3A5C";
                    const adultIdx = adults.findIndex((m) => m.id === member.id);
                    const childIdx = children.findIndex((m) => m.id === member.id);
                    const displayName = member.name?.trim()
                      ? member.name.trim()
                      : isAdult
                        ? adults.length > 1 ? `Adult ${adultIdx + 1}` : "Adult"
                        : children.length > 1 ? `Child ${childIdx + 1}` : "Child";
                    const initial = member.name?.trim()
                      ? member.name.trim()[0].toUpperCase()
                      : isAdult ? "A" : "C";
                    const ageLabel = getMemberAgeLabel(member.role, member.birthDate);
                    return (
                      <div key={member.id || i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "64px" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: avatarBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{initial}</span>
                        </div>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "#1a1a1a", textAlign: "center", lineHeight: 1.2 }}>{displayName}</p>
                        <p style={{ fontSize: "11px", color: "#717171", textAlign: "center", lineHeight: 1.2 }}>{ageLabel}</p>
                      </div>
                    );
                  });
                })()}
                {/* Add member card */}
                <Link href="/onboarding" style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "64px" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "2px dashed #CCCCCC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={18} style={{ color: "#AAAAAA" }} />
                    </div>
                    <p style={{ fontSize: "11px", color: "#AAAAAA", textAlign: "center", lineHeight: 1.2 }}>Add member</p>
                  </div>
                </Link>
              </div>
            </div>
            </div>{/* end crew order wrapper */}

            {/* Popular community trips — mobile order 8 */}
            <div className="order-8 md:order-none">
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h2 style={{ fontWeight: 700, color: "#1a1a1a", fontSize: "15px" }}>Popular with Flokk families</h2>
                <Link href="/discover" style={{ fontSize: "13px", fontWeight: 600, color: "#C4664A", textDecoration: "none" }}>
                  See all
                </Link>
              </div>
              {communityTrips.length === 0 ? (
                <Link href="/discover" style={{ display: "block", textAlign: "center", padding: "20px", backgroundColor: "#F9F9F9", borderRadius: "14px", fontSize: "13px", color: "#C4664A", fontWeight: 600, textDecoration: "none" }}>
                  Explore community trips →
                </Link>
              ) : (
                <div className="grid grid-cols-2" style={{ gap: "10px" }}>
                  {communityTrips.map((trip) => {
                    const img = getTripCoverImage(trip.destinationCity, trip.destinationCountry, trip.heroImageUrl);
                    const nights = trip.startDate && trip.endDate
                      ? Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
                      : null;
                    const familyName = trip.familyProfile?.familyName;
                    return (
                      <Link key={trip.id} href={`/trips/${trip.id}`} style={{ textDecoration: "none" }}>
                        <div style={{ height: "130px", borderRadius: "14px", overflow: "hidden", position: "relative", backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)" }} />
                          <div style={{ position: "absolute", bottom: "10px", left: "10px", right: "10px", zIndex: 2 }}>
                            <p style={{ fontSize: "12px", fontWeight: 700, color: "#fff", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {trip.destinationCity ?? trip.title}
                            </p>
                            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>
                              {nights ? `${nights} nights` : trip.destinationCountry ?? ""}
                              {familyName ? ` · by ${familyName}` : ""}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            </div>{/* end popular trips order wrapper */}

          </div>
        </div>

      </div>
    </div>
  );
}
