import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";
import { ExtractionStatus } from "@prisma/client";

const IMPORT_SOURCE_METHODS = ["maps_import"];

export default async function FromSharePage({
  searchParams,
}: {
  searchParams: Promise<{ cityToken?: string }>;
}) {
  const { cityToken } = await searchParams;

  if (!cityToken?.trim()) {
    return <Msg text="Invalid share link." back="/saves" backLabel="Go to my saves" />;
  }

  const { userId } = await auth();
  if (!userId) {
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(`/saves/from-share?cityToken=${cityToken}`)}`
    );
  }

  const profileId = await resolveProfileId(userId);
  if (!profileId) redirect("/sign-in");

  const share = await db.cityShare.findUnique({
    where: { token: cityToken },
    select: { ownerProfileId: true, citySlug: true, scope: true },
  });

  if (!share) {
    return <Msg text="This share is no longer available." back="/saves" backLabel="Go to my saves" />;
  }

  if (profileId === share.ownerProfileId) {
    redirect(`/share/city/${cityToken}?error=cant-import-own`);
  }

  const city = await db.city.findFirst({
    where: { slug: share.citySlug },
    select: { id: true },
  });

  const sourceSaves = city
    ? await db.savedItem.findMany({
        where: {
          familyProfileId: share.ownerProfileId,
          cityId: city.id,
          deletedAt: null,
          ...(share.scope === "imports"
            ? { sourceMethod: { in: IMPORT_SOURCE_METHODS } }
            : {}),
        },
        select: {
          rawTitle: true,
          rawDescription: true,
          mapsUrl: true,
          websiteUrl: true,
          sourceUrl: true,
          lat: true,
          lng: true,
          placePhotoUrl: true,
          googlePlaceId: true,
          categoryTags: true,
          cityId: true,
          destinationCity: true,
          destinationCountry: true,
        },
      })
    : [];

  if (sourceSaves.length === 0) {
    return (
      <Msg
        text="Nothing to import yet."
        back={`/share/city/${cityToken}`}
        backLabel="Back to share"
      />
    );
  }

  // Case-insensitive dedup: exclude titles the recipient already has
  const existingMatches = await db.savedItem.findMany({
    where: {
      familyProfileId: profileId,
      deletedAt: null,
      OR: sourceSaves.map((s) => ({
        rawTitle: { equals: (s.rawTitle ?? "").trim(), mode: "insensitive" },
      })),
    },
    select: { rawTitle: true },
  });
  const existingLower = new Set(existingMatches.map((e) => (e.rawTitle ?? "").trim().toLowerCase()));
  const toClone = sourceSaves.filter((s) => !existingLower.has((s.rawTitle ?? "").trim().toLowerCase()));

  if (toClone.length === 0) {
    redirect(`/saves/imported/${share.citySlug}?from-share=0`);
  }

  const cloneData = toClone.map((s) => ({
    familyProfileId: profileId,
    rawTitle: s.rawTitle,
    rawDescription: s.rawDescription ?? null,
    mapsUrl: s.mapsUrl ?? null,
    websiteUrl: s.websiteUrl ?? null,
    sourceUrl: s.sourceUrl ?? null,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    placePhotoUrl: s.placePhotoUrl ?? null,
    googlePlaceId: s.googlePlaceId ?? null,
    categoryTags: normalizeAndDedupeCategoryTags(s.categoryTags),
    cityId: s.cityId ?? null,
    destinationCity: s.destinationCity ?? null,
    destinationCountry: s.destinationCountry ?? null,
    sourceMethod: "SHARED_TRIP_IMPORT",
    sourcePlatform: "direct",
    status: "UNORGANIZED" as const,
    extractionStatus: ExtractionStatus.ENRICHED,
  }));

  let importError: string | null = null;
  let createdCount = 0;
  try {
    const result = await db.savedItem.createMany({ data: cloneData, skipDuplicates: false });
    createdCount = result.count;
  } catch (err) {
    importError = err instanceof Error ? err.message.slice(0, 200) : String(err);
  }

  if (!importError) {
    redirect(`/saves/imported/${share.citySlug}?from-share=${createdCount}`);
  }

  return (
    <Msg
      text="Import failed."
      detail={importError ?? undefined}
      back={`/share/city/${cityToken}`}
      backLabel="Try again"
    />
  );
}

function Msg({
  text,
  detail,
  back,
  backLabel,
}: {
  text: string;
  detail?: string;
  back: string;
  backLabel: string;
}) {
  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
      <p
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20,
          fontWeight: 700,
          color: "#1B3A5C",
          marginBottom: 8,
        }}
      >
        {text}
      </p>
      {detail && (
        <p style={{ fontSize: 13, color: "#717171", marginBottom: 12 }}>{detail}</p>
      )}
      <Link href={back} style={{ color: "#C4664A", fontSize: 14, fontWeight: 600 }}>
        {backLabel}
      </Link>
    </div>
  );
}
