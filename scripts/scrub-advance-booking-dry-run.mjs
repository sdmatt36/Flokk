import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GREENE_PROFILE_ID = "cmmmv15y7000104jvocfz5kt6";
const LIMIT = 200;

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
- Sigiriya, Anuradhapura, Polonnaruwa archaeological sites with limited daily entry
- Cooking classes, organized day-tours
- Theme parks, water parks with paid entry

Examples of items that DO NOT need advance booking (return false):
- Generic restaurants, casual cafes, street food spots
- Public parks, beaches, lookouts, viewpoints
- Markets, neighborhoods, shopping districts
- Walking around a temple/shrine that's free and walk-in
- Generic "things to do in [city]" lists or vague pins
- Most lodging (already handled by isBooked elsewhere)
- Photo spots, free overlooks

Family travel context: the family is planning ahead and would rather book early than miss out. Be generous on flagging items where ticketed entry, reservation, or timed booking is COMMON — but do not flag a generic cafe just because it's popular. The signal is "structural advance-booking expectation" not "popularity."

For "reason": one short sentence explaining the specific advance-booking expectation (e.g. "Timed-entry tickets sell out weeks ahead", "Major attraction with limited daily entry", "Restaurant requires reservation 2-3 weeks ahead"). Keep under 120 chars.`;

async function evalItem(item) {
  const userContent = `Title: ${item.rawTitle ?? "(none)"}
Description: ${item.rawDescription ?? "(none)"}
City: ${item.destinationCity ?? "(unknown)"}
Country: ${item.destinationCountry ?? "(unknown)"}
Category tags: ${item.categoryTags.length > 0 ? item.categoryTags.join(", ") : "(none)"}`;

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
  if (typeof parsed.needsAdvanceBooking !== "boolean") throw new Error("missing needsAdvanceBooking field");
  return { needsAdvanceBooking: parsed.needsAdvanceBooking, reason: String(parsed.reason ?? "") };
}

async function main() {
  const items = await prisma.savedItem.findMany({
    where: {
      familyProfileId: GREENE_PROFILE_ID,
      deletedAt: null,
      isBooked: false,
    },
    orderBy: { savedAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      rawTitle: true,
      rawDescription: true,
      destinationCity: true,
      destinationCountry: true,
      categoryTags: true,
    },
  });

  const flagged = [];
  const notFlagged = [];
  const errors = [];

  console.log(`=== ADVANCE BOOKING DRY-RUN ===`);
  console.log(`Profile: Greene (${GREENE_PROFILE_ID})`);
  console.log(`Items to evaluate: ${items.length}`);
  console.log(``);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0 && i % 25 === 0) {
      console.log(`Processed ${i}/${items.length}...`);
    }
    try {
      const result = await evalItem(item);
      if (result.needsAdvanceBooking) {
        flagged.push({ item, reason: result.reason });
      } else {
        notFlagged.push({ item, reason: result.reason });
      }
    } catch (err) {
      errors.push({ item, error: String(err?.message ?? err) });
    }
  }

  const total = items.length;
  const errorCount = errors.length;
  const flaggedCount = flagged.length;
  const pct = total > 0 ? Math.round((flaggedCount / total) * 100) : 0;

  console.log(`Items evaluated: ${total}`);
  console.log(`Flagged: ${flaggedCount} (${pct}%)`);
  console.log(`Errors: ${errorCount}`);
  console.log(``);

  console.log(`=== FLAGGED ITEMS (need advance booking) ===`);
  if (flagged.length === 0) {
    console.log(`(none)`);
  } else {
    flagged.forEach(({ item, reason }, idx) => {
      console.log(`[${idx + 1}] ${item.rawTitle ?? "(no title)"} — ${item.destinationCity ?? "(unknown city)"}`);
      console.log(`    Tags: ${item.categoryTags.length > 0 ? item.categoryTags.join(", ") : "(none)"}`);
      console.log(`    Reason: ${reason}`);
      console.log(`    Item ID: ${item.id}`);
    });
  }

  console.log(``);
  console.log(`=== NOT FLAGGED (walk-in OK) ===`);
  if (notFlagged.length === 0) {
    console.log(`(none)`);
  } else {
    notFlagged.forEach(({ item, reason }, idx) => {
      console.log(`[${idx + 1}] ${item.rawTitle ?? "(no title)"} — ${item.destinationCity ?? "(unknown city)"}`);
      console.log(`    Tags: ${item.categoryTags.length > 0 ? item.categoryTags.join(", ") : "(none)"}`);
      console.log(`    Reason: ${reason}`);
      console.log(`    Item ID: ${item.id}`);
    });
  }

  console.log(``);
  console.log(`=== ERRORS (parse failure or API error) ===`);
  if (errors.length === 0) {
    console.log(`(none)`);
  } else {
    errors.forEach(({ item, error }, idx) => {
      console.log(`[${idx + 1}] ${item.rawTitle ?? "(no title)"} — ${item.id}`);
      console.log(`    Error: ${error}`);
    });
  }

  console.log(``);
  console.log(`=== READY FOR REVIEW. No DB writes performed. ===`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
