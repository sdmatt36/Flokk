import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { CATEGORY_SLUGS, CATEGORIES, normalizeCategorySlug } from "@/lib/categories";
import { normalizeAndDedupeCategoryTags } from "@/lib/category-tags";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EMAIL_SOURCE_METHODS = new Set([
  "EMAIL_FORWARD",
  "EMAIL_IMPORT",
  "email_forward",
  "email_extracted",
  "email",
]);

const TRANSPORT_SLUGS = new Set(["train", "flight", "airline", "transport", "transit"]);

// Structural flight indicator — real flight emails write ItineraryItems, not SavedItems,
// but the low-confidence URL-extraction path occasionally creates a SavedItem with a
// URL as rawTitle, or rare edge cases produce "XX 123" style titles.
function looksLikeFlight(title: string | null): boolean {
  if (!title) return false;
  if (/^[A-Z]{2,3}\s?\d{3,4}(\s|$)/.test(title)) return true;
  if (title.includes(" → ") && title.length < 30) return true;
  if (/^flight\s/i.test(title)) return true;
  return false;
}

async function classifyViaHaiku(
  title: string | null,
  description: string | null,
  city: string | null
): Promise<string[]> {
  const prompt = `You are classifying a travel save into 1-2 canonical category slugs.

Place: ${title ?? "(unknown)"}
City: ${city ?? "(unknown)"}
Description: ${description ? description.slice(0, 300) : "(none)"}

Canonical slugs (pick 1-2 that best fit):
${CATEGORIES.map((c) => `${c.slug} — ${c.label}`).join("\n")}

Respond ONLY with a JSON array of slugs, e.g. ["food_and_drink"] or ["culture","experiences"].
If you cannot classify, respond with [].`;

  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as unknown[];
    return (parsed as string[]).filter(
      (s) => typeof s === "string" && CATEGORY_SLUGS.has(s)
    );
  } catch {
    return [];
  }
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Count total active vs deleted for gap explanation
  const [activeCount, totalCount] = await Promise.all([
    db.savedItem.count({ where: { deletedAt: null } }),
    db.savedItem.count(),
  ]);
  const deletedSkipped = totalCount - activeCount;

  let scanned = 0;
  let stripped = 0;
  let reclassified = 0;
  let emptyRemaining = 0;

  // Scope breakdown counters
  let scopePreviouslyEmpty = 0;
  let scopePreviouslyMalformed = 0;
  let scopeFlightSkipped = 0;

  let cursor: string | undefined;

  while (true) {
    const batch = await db.savedItem.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        categoryTags: true,
        sourceMethod: true,
        lodgingType: true,
        rawTitle: true,
        rawDescription: true,
        destinationCity: true,
      },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;
    scanned += batch.length;

    for (const item of batch) {
      const isEmail = EMAIL_SOURCE_METHODS.has(item.sourceMethod ?? "");

      // ── Path A: item already has empty tags ──────────────────────────────────
      if (item.categoryTags.length === 0) {
        scopePreviouslyEmpty++;

        // Structurally known lodging (email-extracted hotel)
        if (isEmail && item.lodgingType) {
          await db.savedItem.update({
            where: { id: item.id },
            data: { categoryTags: ["lodging"] },
          });
          reclassified++;
          continue;
        }

        // Structural flight indicator — skip Haiku, leave empty
        if (looksLikeFlight(item.rawTitle)) {
          scopeFlightSkipped++;
          emptyRemaining++;
          continue;
        }

        // All other empty-tag items → Haiku classify
        const suggested = await classifyViaHaiku(
          item.rawTitle,
          item.rawDescription,
          item.destinationCity
        );
        await db.savedItem.update({
          where: { id: item.id },
          data: { categoryTags: suggested },
        });
        if (suggested.length > 0) reclassified++;
        else emptyRemaining++;
        continue;
      }

      // ── Path B: item has existing tags — normalize and dedup ─────────────────
      const mappedTags: string[] = [];
      for (const raw of item.categoryTags) {
        const slug = normalizeCategorySlug(raw);
        if (slug && CATEGORY_SLUGS.has(slug) && !TRANSPORT_SLUGS.has(slug)) {
          mappedTags.push(slug);
        }
      }
      const cleaned = normalizeAndDedupeCategoryTags(mappedTags);

      const changed =
        cleaned.length !== item.categoryTags.length ||
        cleaned.some((t, i) => t !== item.categoryTags[i]);

      if (!changed) continue;

      scopePreviouslyMalformed++;
      stripped++;

      if (cleaned.length > 0) {
        // Tags changed but still non-empty → just update
        await db.savedItem.update({
          where: { id: item.id },
          data: { categoryTags: cleaned },
        });
        continue;
      }

      // Tags stripped to empty — decide what to do
      if (isEmail && item.lodgingType) {
        await db.savedItem.update({
          where: { id: item.id },
          data: { categoryTags: ["lodging"] },
        });
        reclassified++;
        continue;
      }

      if (looksLikeFlight(item.rawTitle)) {
        scopeFlightSkipped++;
        await db.savedItem.update({
          where: { id: item.id },
          data: { categoryTags: [] },
        });
        emptyRemaining++;
        continue;
      }

      if (isEmail) {
        // Email-extracted item with unrecognized/unfamiliar content — Haiku classify
        const suggested = await classifyViaHaiku(
          item.rawTitle,
          item.rawDescription,
          item.destinationCity
        );
        await db.savedItem.update({
          where: { id: item.id },
          data: { categoryTags: suggested },
        });
        if (suggested.length > 0) reclassified++;
        else emptyRemaining++;
        continue;
      }

      // Non-email, tags stripped to empty → Haiku classify
      const suggested = await classifyViaHaiku(
        item.rawTitle,
        item.rawDescription,
        item.destinationCity
      );
      await db.savedItem.update({
        where: { id: item.id },
        data: { categoryTags: suggested },
      });
      if (suggested.length > 0) reclassified++;
      else emptyRemaining++;
    }
  }

  return NextResponse.json({
    scanned,
    activeTotal: activeCount,
    deletedSkipped,
    stripped,
    reclassified,
    emptyRemaining,
    scopeBreakdown: {
      previously_empty: scopePreviouslyEmpty,
      previously_malformed: scopePreviouslyMalformed,
      flight_skipped: scopeFlightSkipped,
    },
  });
}
