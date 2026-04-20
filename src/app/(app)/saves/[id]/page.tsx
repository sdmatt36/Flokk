import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { ChevronLeft, MapPin, Sparkles, Clock, Users, DollarSign, ExternalLink, Navigation } from "lucide-react";
import { SaveNotes } from "@/components/features/saves/SaveNotes";

const SOURCE_LABEL: Record<string, string> = {
  URL_PASTE: "URL save", EMAIL_FORWARD: "Email", IN_APP_SAVE: "Saved in app", SHARED_TRIP_IMPORT: "Flokk share",
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", google_maps: "Google Maps",
  airbnb: "Airbnb", getyourguide: "GetYourGuide", viator: "Viator", klook: "Klook",
  INSTAGRAM: "Instagram", TIKTOK: "TikTok", GOOGLE_MAPS: "Google Maps",
  MANUAL: "URL save", IN_APP: "Saved in app", EMAIL_IMPORT: "Email", PHOTO_IMPORT: "URL save",
};

const TAG_GRADIENT: Record<string, string> = {
  Food: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  "Street Food": "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  Outdoor: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
  Hiking: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
  Beach: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
  Kids: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
  Activity: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
  Culture: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
  History: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
  Wellness: "linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)",
  Lodging: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  Luxury: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
};

function getGradient(tags: string[]): string {
  for (const tag of tags) {
    const g = TAG_GRADIENT[tag];
    if (g) return g;
  }
  return "linear-gradient(135deg, #C4664A 0%, #a85039 100%)";
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildMatchReason(tags: string[], interestKeys: string[]): string {
  if (tags.some(t => ["Kids", "Activity", "Educational"].includes(t)) || interestKeys.some(k => ["theme_parks","zoos","educational","hands_on","playgrounds"].includes(k))) {
    return "A great pick for the whole family — built for kids but enjoyable for adults too.";
  }
  if (tags.some(t => ["Food", "Street Food"].includes(t)) || interestKeys.some(k => ["street_food","local_markets","food_tours","cafes"].includes(k))) {
    return "Matches your family's love of local food — a must-try for food explorers.";
  }
  if (tags.some(t => ["Culture", "History", "Museum"].includes(t)) || interestKeys.some(k => ["museums","history","art","architecture"].includes(k))) {
    return "Lines up with your interest in culture and history — a rich local experience.";
  }
  if (tags.some(t => ["Beach", "Outdoor", "Hiking", "Water"].includes(t)) || interestKeys.some(k => ["beaches","hiking","national_parks","water_sports","wildlife"].includes(k))) {
    return "Fits your family's taste for outdoor adventures and nature.";
  }
  if (tags.some(t => ["Luxury", "Lodging"].includes(t))) {
    return "A high-comfort option that matches the style of your trip.";
  }
  return "Saved based on your family's travel interests and upcoming trip.";
}

function buildAppleMapsUrl(lat: number, lng: number, title: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(title)}&ll=${lat},${lng}`;
}

export default async function SaveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const profileId = await resolveProfileId(userId);
  if (!profileId) redirect("/onboarding");

  const profile = await db.familyProfile.findUnique({
    where: { id: profileId },
    include: { interests: true, members: true },
  });
  if (!profile) redirect("/onboarding");

  const item = await db.savedItem.findUnique({
    where: { id },
    include: { trip: { select: { id: true, title: true } } },
  });

  if (!item || item.familyProfileId !== profile.id) notFound();

  const tags = item.categoryTags ?? [];
  const interestKeys = profile.interests.map(i => i.interestKey);
  const gradient = getGradient(tags);
  const matchReason = buildMatchReason(tags, interestKeys);
  const sourceLabel = SOURCE_LABEL[item.sourcePlatform ?? ""] || SOURCE_LABEL[item.sourceMethod ?? ""] || item.sourceMethod || "";
  const location = [item.destinationCity, item.destinationCountry].filter(Boolean).join(", ");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fff", paddingBottom: "96px" }}>

      {/* Hero */}
      <div style={{ height: "260px", position: "relative", overflow: "hidden" }}>
        {(item.placePhotoUrl ?? item.mediaThumbnailUrl) ? (
          <div style={{ width: "100%", height: "100%", backgroundImage: `url('${item.placePhotoUrl ?? item.mediaThumbnailUrl}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: gradient }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)" }} />

        {/* Back button */}
        <Link
          href="/saves"
          style={{
            position: "absolute", top: "16px", left: "16px", zIndex: 2,
            display: "flex", alignItems: "center", gap: "4px",
            backgroundColor: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.3)", borderRadius: "20px",
            padding: "6px 14px", color: "#fff", textDecoration: "none",
            fontSize: "13px", fontWeight: 600,
          }}
        >
          <ChevronLeft size={15} />
          Saves
        </Link>

        {/* Title overlay */}
        <div style={{ position: "absolute", bottom: "24px", left: "24px", right: "24px", zIndex: 2 }}>
          <h1 style={{ fontSize: "26px", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: "6px", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
            {item.rawTitle ?? "Saved place"}
          </h1>
          {location && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <MapPin size={13} style={{ color: "rgba(255,255,255,0.8)" }} />
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>{location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "24px" }}>

        {/* Header block */}
        <div style={{ marginBottom: "20px" }}>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: "12px", fontWeight: 600, background: "rgba(0,0,0,0.06)", color: "#444", borderRadius: "999px", padding: "4px 10px" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p style={{ fontSize: "12px", color: "#999" }}>
            Saved from {sourceLabel} · {formatDate(item.savedAt)}
          </p>
        </div>

        {/* Match reason */}
        <div style={{ background: "#FDF6F3", borderRadius: "12px", padding: "12px 16px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <Sparkles size={14} style={{ color: "#C4664A" }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#C4664A" }}>Why this works for your family</span>
          </div>
          <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.5, margin: 0 }}>{matchReason}</p>
        </div>

        {/* Details block */}
        {(item.rawDescription) && (
          <div style={{ marginBottom: "20px", padding: "16px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)" }}>
            <p style={{ fontSize: "14px", color: "#444", lineHeight: 1.6, margin: 0 }}>{item.rawDescription}</p>
          </div>
        )}

        {/* Quick detail pills */}
        {(item.relevanceScore || item.lat) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
            {item.relevanceScore && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "#F5F5F5", borderRadius: "999px", padding: "6px 12px" }}>
                <Sparkles size={12} style={{ color: "#C4664A" }} />
                <span style={{ fontSize: "12px", color: "#555" }}>Match score: {Math.round(item.relevanceScore * 100)}%</span>
              </div>
            )}
            {item.lat && item.lng && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "#F5F5F5", borderRadius: "999px", padding: "6px 12px" }}>
                <Navigation size={12} style={{ color: "#555" }} />
                <span style={{ fontSize: "12px", color: "#555" }}>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</span>
              </div>
            )}
          </div>
        )}

        {/* Trip assignment */}
        <div style={{ marginBottom: "20px", padding: "14px 16px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {item.trip ? (
            <>
              <span style={{ fontSize: "13px", color: "#555" }}>Added to trip</span>
              <Link href={`/trips/${item.trip.id}`} style={{ fontSize: "13px", fontWeight: 700, color: "#C4664A", textDecoration: "none" }}>
                {item.trip.title} →
              </Link>
            </>
          ) : (
            <>
              <span style={{ fontSize: "13px", color: "#999" }}>Not assigned to a trip yet</span>
              <Link href="/trips" style={{ fontSize: "13px", fontWeight: 700, color: "#C4664A", textDecoration: "none" }}>
                Add to trip →
              </Link>
            </>
          )}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a", marginBottom: "8px" }}>Your notes</p>
          <SaveNotes itemId={id} initialNotes={item.notes ?? ""} />
        </div>

      </div>

      {/* Booking CTA */}
      <BookingCta
        affiliateUrl={item.affiliateUrl}
        websiteUrl={item.websiteUrl}
        lat={item.lat}
        lng={item.lng}
        title={item.rawTitle ?? ""}
      />
    </div>
  );
}

function BookingCta({ affiliateUrl, websiteUrl, lat, lng, title }: {
  affiliateUrl: string | null;
  websiteUrl: string | null;
  lat: number | null;
  lng: number | null;
  title: string;
}) {
  const mapsUrl = lat && lng ? buildAppleMapsUrl(lat, lng, title) : null;

  if (!affiliateUrl && !websiteUrl && !mapsUrl) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20,
      padding: "12px 24px 28px",
      background: "linear-gradient(to top, #fff 80%, rgba(255,255,255,0))",
    }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        {affiliateUrl ? (
          <a href={affiliateUrl} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            width: "100%", padding: "14px", borderRadius: "999px",
            backgroundColor: "#C4664A", color: "#fff", fontWeight: 700, fontSize: "15px",
            textDecoration: "none",
          }}>
            <ExternalLink size={15} />
            Book now
          </a>
        ) : websiteUrl ? (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            width: "100%", padding: "14px", borderRadius: "999px",
            backgroundColor: "#fff", color: "#C4664A", fontWeight: 700, fontSize: "15px",
            textDecoration: "none", border: "2px solid #C4664A",
          }}>
            <ExternalLink size={15} />
            Visit website
          </a>
        ) : mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            width: "100%", padding: "14px", borderRadius: "999px",
            backgroundColor: "#fff", color: "#333", fontWeight: 700, fontSize: "15px",
            textDecoration: "none", border: "1.5px solid rgba(0,0,0,0.12)",
          }}>
            <Navigation size={15} />
            Get directions
          </a>
        ) : null}
      </div>
    </div>
  );
}
