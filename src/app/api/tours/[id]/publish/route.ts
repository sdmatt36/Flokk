import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const maxDuration = 60;

function ageFromBirthDate(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : null;
}

function ageRangeString(ages: number[]): string {
  if (ages.length === 0) return "children";
  if (ages.length === 1) return `a child aged ${ages[0]}`;
  const sorted = [...ages].sort((a, b) => a - b);
  if (sorted.length === 2) return `kids ages ${sorted[0]} and ${sorted[1]}`;
  return `kids ages ${sorted[0]}–${sorted[sorted.length - 1]}`;
}

type ScrubResult = {
  publicTitle: string;
  publicSubtitle: string;
  stops: Array<{ id: string; publicWhy: string; publicFamilyNote: string }>;
};

async function callSonnetScrub(prompt: string): Promise<ScrubResult | null> {
  const anthropic = new Anthropic();
  const aiResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  const text = aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean) as ScrubResult;
  if (
    typeof parsed.publicTitle !== "string" ||
    typeof parsed.publicSubtitle !== "string" ||
    !Array.isArray(parsed.stops)
  ) {
    return null;
  }
  return parsed;
}

function buildScrubPrompt(opts: {
  title: string;
  subtitle: string | null;
  namesArray: string[];
  ageRange: string;
  stops: Array<{ id: string; why: string | null; familyNote: string | null }>;
}): string {
  const { title, subtitle, namesArray, ageRange, stops } = opts;
  const stopsJson = JSON.stringify(
    stops.map(s => ({ id: s.id, why: s.why ?? "", familyNote: s.familyNote ?? "" })),
    null,
    2
  );
  return `You are rewriting copy for a family tour that the owner is about to publish publicly. Your job: remove any specific children's names and replace them with age-range descriptors that preserve the tone, length, and family-friendly framing of the original.

NAMES TO REMOVE (verbatim, case-insensitive): ${namesArray.join(", ")}
GENERAL AGE DESCRIPTOR TO USE: ${ageRange} (e.g. "kids ages 8 and 10" or "kids ages 5-12")

RULES:
- Replace every occurrence of any name in NAMES TO REMOVE with a natural age-range phrase ("kids", "the kids", "your kids", "your family", etc.) appropriate to the sentence. Do not over-formalize; keep the conversational warmth of the original.
- Preserve sentence structure, length (within +/- 20%), and family-tour tone. Do NOT add new sentences or facts.
- If a name appears in possessive form (e.g. "Beau's"), replace with the equivalent ("your child's" or "the kids'" depending on count and context).
- If the original contains a name pattern that's already generic (e.g. "the kids"), leave it alone.
- Do NOT change place names, venue names, time references, walking distances, or any other factual content.
- Return ONLY a JSON object in the exact schema below. No prose. No markdown.

INPUT:
Tour title: "${title}"
Tour subtitle: "${subtitle ?? ""}"
Stops:
${stopsJson}

OUTPUT SCHEMA (return JSON only, in this exact shape):
{
  "publicTitle": "...",
  "publicSubtitle": "...",
  "stops": [
    { "id": "stop-id-1", "publicWhy": "...", "publicFamilyNote": "..." },
    { "id": "stop-id-2", "publicWhy": "...", "publicFamilyNote": "..." }
  ]
}`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tourId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    select: {
      id: true,
      familyProfileId: true,
      title: true,
      subtitle: true,
      isPublic: true,
      deletedAt: true,
      stops: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        select: { id: true, why: true, familyNote: true },
      },
    },
  });

  if (!tour || tour.deletedAt || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = await db.familyProfile.findUnique({
    where: { id: profileId },
    select: {
      members: { select: { name: true, role: true, birthDate: true } },
    },
  });

  const childMembers = (profile?.members ?? []).filter(m => m.role === "CHILD");
  const childNames = childMembers.map(m => m.name).filter((n): n is string => !!n);
  const childAges = childMembers
    .map(m => ageFromBirthDate(m.birthDate))
    .filter((a): a is number => a !== null);
  const ageRange = ageRangeString(childAges);

  // No child PII to scrub — copy originals verbatim as public fields
  if (childNames.length === 0) {
    console.log(`[tour-publish] tourId=${tourId} no_child_names: copying originals verbatim`);
    await db.$transaction([
      db.generatedTour.update({
        where: { id: tourId },
        data: {
          isPublic: true,
          publicTitle: tour.title,
          publicSubtitle: tour.subtitle,
        },
      }),
      ...tour.stops.map(s =>
        db.tourStop.update({
          where: { id: s.id },
          data: { publicWhy: s.why, publicFamilyNote: s.familyNote },
        })
      ),
    ]);
    return NextResponse.json({
      tourId,
      isPublic: true,
      publicTitle: tour.title,
      publicSubtitle: tour.subtitle,
      stops: tour.stops.map(s => ({
        id: s.id,
        publicWhy: s.why,
        publicFamilyNote: s.familyNote,
      })),
    });
  }

  const prompt = buildScrubPrompt({
    title: tour.title,
    subtitle: tour.subtitle,
    namesArray: childNames,
    ageRange,
    stops: tour.stops,
  });

  let scrubbed: ScrubResult | null = null;

  try {
    scrubbed = await callSonnetScrub(prompt);
  } catch {
    console.log(`[tour-publish] tourId=${tourId} attempt=1 error=parse_failed, retrying`);
  }

  if (!scrubbed) {
    try {
      scrubbed = await callSonnetScrub(prompt);
    } catch {
      console.log(`[tour-publish] tourId=${tourId} attempt=2 error=parse_failed, aborting`);
      return NextResponse.json(
        { error: "scrub_failed", message: "Could not generate public version, please try again" },
        { status: 500 }
      );
    }
  }

  if (!scrubbed) {
    console.log(`[tour-publish] tourId=${tourId} error=null_after_retry`);
    return NextResponse.json(
      { error: "scrub_failed", message: "Could not generate public version, please try again" },
      { status: 500 }
    );
  }

  // Validate stop IDs match
  const inputIds = new Set(tour.stops.map(s => s.id));
  const outputIds = new Set(scrubbed.stops.map(s => s.id));
  const missingIds = [...inputIds].filter(id => !outputIds.has(id));
  if (missingIds.length > 0) {
    console.log(`[tour-publish] tourId=${tourId} error=shape_mismatch missing_stop_ids=${missingIds.join(",")}`);
    return NextResponse.json(
      { error: "scrub_failed", message: "Could not generate public version, please try again" },
      { status: 500 }
    );
  }

  console.log(`[tour-publish] tourId=${tourId} scrub_ok stops=${tour.stops.length}`);

  await db.$transaction([
    db.generatedTour.update({
      where: { id: tourId },
      data: {
        isPublic: true,
        publicTitle: scrubbed.publicTitle,
        publicSubtitle: scrubbed.publicSubtitle,
      },
    }),
    ...scrubbed.stops.map(s =>
      db.tourStop.update({
        where: { id: s.id },
        data: { publicWhy: s.publicWhy, publicFamilyNote: s.publicFamilyNote },
      })
    ),
  ]);

  return NextResponse.json({
    tourId,
    isPublic: true,
    publicTitle: scrubbed.publicTitle,
    publicSubtitle: scrubbed.publicSubtitle,
    stops: scrubbed.stops,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tourId } = await params;
  const profileId = await resolveProfileId(userId);
  if (!profileId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tour = await db.generatedTour.findUnique({
    where: { id: tourId },
    select: { familyProfileId: true, deletedAt: true },
  });

  if (!tour || tour.deletedAt || tour.familyProfileId !== profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.generatedTour.update({
    where: { id: tourId },
    data: { isPublic: false },
  });

  console.log(`[tour-publish] tourId=${tourId} unpublished`);

  return NextResponse.json({ tourId, isPublic: false });
}
