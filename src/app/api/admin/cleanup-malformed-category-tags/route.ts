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

  let scanned = 0;
  let stripped = 0;
  let reclassified = 0;
  let emptyRemaining = 0;

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
      if (item.categoryTags.length === 0) continue;

      // Keep only canonical slugs (map legacy values, drop unmappable ones)
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
      const isEmail = EMAIL_SOURCE_METHODS.has(item.sourceMethod ?? "");

      if (isEmail && item.lodgingType) {
        // Structurally known as lodging from email extraction
        await db.savedItem.update({
          where: { id: item.id },
          data: { categoryTags: ["lodging"] },
        });
        reclassified++;
        continue;
      }

      if (isEmail) {
        // Email-extracted flights/unfamiliar items — leave empty
        emptyRemaining++;
        await db.savedItem.update({
          where: { id: item.id },
          data: { categoryTags: [] },
        });
        continue;
      }

      // Not email-extracted → ask Haiku
      const suggested = await classifyViaHaiku(
        item.rawTitle,
        item.rawDescription,
        item.destinationCity
      );

      await db.savedItem.update({
        where: { id: item.id },
        data: { categoryTags: suggested },
      });

      if (suggested.length > 0) {
        reclassified++;
      } else {
        emptyRemaining++;
      }
    }
  }

  return NextResponse.json({ scanned, stripped, reclassified, emptyRemaining });
}
