/**
 * Production backfill: evaluates SavedItems for advance-booking requirement via Haiku.
 *
 * Reads items from a JSON file (populated via Supabase MCP — avoids P1001 direct-connection
 * failure from local Mac). Calls Haiku in batches of 10. Writes results to:
 *   - stdout: progress + summary
 *   - /tmp/backfill-updates.sql: SQL UPDATE statements ready to apply via Supabase MCP
 *
 * Usage:
 *   node --env-file=.env.local scripts/scrub-advance-booking-backfill.mjs [items-file]
 *
 * Resumability: rows with advanceBookingScrubbedAt already set are excluded from the
 * input file (filtered by the Supabase MCP query). Re-run picks up where it left off.
 */

import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";

const DATA_FILE = process.argv[2] ?? "/tmp/backfill-items.json";
const OUTPUT_SQL = "/tmp/backfill-updates.sql";
const BATCH_SIZE = 10;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are evaluating a saved travel item for a family travel planning app. The family will visit this place during a trip with their kids. Your job is to decide whether this item typically requires booking tickets, reservations, or significant planning in advance — meaning the family should secure it weeks ahead, not show up on the day.

Return STRICT JSON with NO preamble, NO markdown fence, exactly this shape:
{
  "needsAdvanceBooking": boolean,
  "reason": string
}

Examples of items that DO need advance booking (return true):
- Museums with timed-entry tickets (Vatican Museums, Anne Frank House, Tokyo Disney, Universal Studios)
- Major attractions that sell out (Eiffel Tower summit, Empire State Building, Sagrada Familia, Alhambra, Sigiriya Rock)
- Sports games, concerts, theater shows, named live events
- Famous restaurants requiring reservations weeks ahead (Noma, Sukiyabashi Jiro)
- Specific guided tours (private guide, small-group experience)
- Archaeological sites with limited daily entry (Sigiriya, Anuradhapura, Polonnaruwa, Machu Picchu)
- Cooking classes, organized day-tours
- Theme parks, water parks with paid entry

Examples of items that DO NOT need advance booking (return false):
- Generic restaurants, casual cafes, street food spots
- Public parks, beaches, lookouts, viewpoints
- Markets, neighborhoods, shopping districts
- Walking around a temple/shrine that is free and walk-in
- Generic "things to do in [city]" lists or vague pins
- Most lodging
- Photo spots, free overlooks
- Popular casual restaurants without a formal reservation system. Even if a restaurant is famous, crowded, or described as "magical" or "iconic", it does NOT need advance booking unless it operates a structural reservation system (online booking required, waitlist that closes weeks ahead, prix-fixe tasting menu only). Popularity alone is NOT the signal. The signal is structural advance-booking expectation. If the family could walk in and wait 30 minutes for a table on any given day, it is NOT flagged.

Family travel context: the family is planning ahead and would rather book early than miss out. Be generous on flagging items where ticketed entry, reservation, or timed booking is COMMON — but do not flag a generic cafe just because it is popular. The signal is "structural advance-booking expectation" not "popularity."

For "reason": one short sentence explaining the specific advance-booking expectation (e.g. "Timed-entry tickets sell out weeks ahead", "Major attraction with limited daily entry", "Restaurant requires reservation 2-3 weeks ahead"). Keep under 120 chars.`;

async function evalItem(item) {
  const userContent = `Title: ${item.rawTitle ?? "(none)"}
Description: ${item.rawDescription ?? "(none)"}
City: ${item.destinationCity ?? "(unknown)"}
Country: ${item.destinationCountry ?? "(unknown)"}
Category tags: ${(item.categoryTags ?? []).length > 0 ? item.categoryTags.join(", ") : "(none)"}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("non-text response");
  const text = content.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(text);
  if (typeof parsed.needsAdvanceBooking !== "boolean") throw new Error("missing needsAdvanceBooking boolean");
  return {
    needsAdvanceBooking: parsed.needsAdvanceBooking,
    reason: String(parsed.reason ?? "").slice(0, 200),
  };
}

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

async function main() {
  const startTime = Date.now();
  const items = JSON.parse(readFileSync(DATA_FILE, "utf8"));

  console.log(`=== ADVANCE BOOKING PRODUCTION BACKFILL ===`);
  console.log(`Input file: ${DATA_FILE}`);
  console.log(`Items to process: ${items.length}`);
  console.log(`Batch size: ${BATCH_SIZE} parallel Haiku calls`);
  console.log(``);

  const results = [];
  let flaggedCount = 0;
  let errorCount = 0;
  const errors = [];

  const batches = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const startItem = batchIdx * BATCH_SIZE + 1;
    const endItem = Math.min(startItem + batch.length - 1, items.length);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const result = await evalItem(item);
          return { item, ...result, error: null };
        } catch (err) {
          return { item, needsAdvanceBooking: null, reason: null, error: String(err?.message ?? err) };
        }
      })
    );

    for (const r of batchResults) {
      if (r.error) {
        errorCount++;
        errors.push({ id: r.item.id, title: r.item.rawTitle, error: r.error });
      } else {
        results.push(r);
        if (r.needsAdvanceBooking) flaggedCount++;
      }
    }

    console.log(`Processed batch ${batchIdx + 1}/${batches.length} (items ${startItem}–${endItem}) | flagged so far: ${flaggedCount} | errors: ${errorCount}`);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const successCount = results.length;
  const flagRate = successCount > 0 ? Math.round((flaggedCount / successCount) * 100) : 0;

  console.log(``);
  console.log(`=== SUMMARY ===`);
  console.log(`Total processed: ${items.length}`);
  console.log(`  Successful:    ${successCount}`);
  console.log(`  Flagged:       ${flaggedCount} (${flagRate}%)`);
  console.log(`  Not flagged:   ${successCount - flaggedCount}`);
  console.log(`  Errors:        ${errorCount}`);
  console.log(`Runtime: ${elapsed}s`);
  console.log(`Cost estimate: ~$${(items.length * 0.001).toFixed(2)}`);

  if (errors.length > 0) {
    console.log(``);
    console.log(`=== ERRORS (not written — eligible for re-run) ===`);
    errors.forEach(({ id, title, error }) => {
      console.log(`  ${title ?? "(no title)"} [${id}]: ${error}`);
    });
  }

  // Generate SQL UPDATE file
  if (results.length > 0) {
    const sqlLines = ["-- Auto-generated by scrub-advance-booking-backfill.mjs", "-- Apply via Supabase MCP execute_sql", ""];
    // Build one UPDATE per item (safe, readable, auditable)
    for (const r of results) {
      const reason = r.reason ? `'${escapeSql(r.reason)}'` : "NULL";
      sqlLines.push(
        `UPDATE "SavedItem" SET "needsAdvanceBooking" = ${r.needsAdvanceBooking}, "advanceBookingReason" = ${reason}, "advanceBookingScrubbedAt" = NOW() WHERE id = '${r.item.id}';`
      );
    }
    writeFileSync(OUTPUT_SQL, sqlLines.join("\n") + "\n");
    console.log(``);
    console.log(`SQL UPDATE file written: ${OUTPUT_SQL} (${results.length} statements)`);
    console.log(`Apply via: Supabase MCP execute_sql with contents of ${OUTPUT_SQL}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
