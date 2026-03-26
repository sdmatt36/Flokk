import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

function parseCost(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim()
    .replace(/\b(KRW|USD|GBP|JPY|EUR|AUD)\b/gi, "")
    .replace(/[£$€¥]/g, "")
    .replace(/,/g, "")
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

function detectCurrency(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw);
  if (/\bKRW\b/i.test(s)) return "KRW";
  if (/\bGBP\b/i.test(s) || s.includes("£")) return "GBP";
  if (/\bEUR\b/i.test(s) || s.includes("€")) return "EUR";
  if (/\bJPY\b/i.test(s) || s.includes("¥")) return "JPY";
  if (/\bAUD\b/i.test(s)) return "AUD";
  if (/\bUSD\b/i.test(s) || s.includes("$")) return "USD";
  return null;
}

async function main() {
  // Find trips where budgetSpent is 0 or null but have booking vault documents
  const trips = await db.trip.findMany({
    where: {
      OR: [{ budgetSpent: null }, { budgetSpent: 0 }],
      documents: { some: { type: "booking" } },
    },
    select: {
      id: true,
      title: true,
      budgetSpent: true,
      budgetCurrency: true,
      documents: {
        where: { type: "booking" },
        select: { id: true, label: true, content: true },
      },
    },
  });

  console.log(`[fix-budget] ${trips.length} trips to process`);

  for (const trip of trips) {
    // Group costs by currency to handle mixed-currency trips
    const byCurrency: Record<string, number> = {};

    for (const doc of trip.documents) {
      let booking: Record<string, unknown> = {};
      try { booking = JSON.parse(doc.content ?? "{}"); } catch { continue; }

      // Return flight docs have totalCost: null — skip
      const rawCost = booking.totalCost;
      if (rawCost === null || rawCost === undefined) continue;

      const cost = parseCost(rawCost);
      if (!cost) continue;

      // Detect currency: prefer from raw cost string (e.g. "KRW 3,039,520"),
      // fall back to stored currency field
      const cur =
        detectCurrency(rawCost) ??
        (booking.currency as string | null) ??
        "USD";

      byCurrency[cur] = (byCurrency[cur] ?? 0) + cost;
    }

    const entries = Object.entries(byCurrency);
    if (entries.length === 0) {
      console.log(`[fix-budget] trip "${trip.title}" — no parseable costs found, skipping`);
      continue;
    }

    // Pick the currency with the highest aggregate value
    entries.sort((a, b) => b[1] - a[1]);
    const [primaryCurrency, primaryTotal] = entries[0];

    if (entries.length > 1) {
      const skipped = entries.slice(1).map(([c, v]) => `${v} ${c}`).join(", ");
      console.log(`[fix-budget] trip "${trip.title}" — mixed currencies, using ${primaryCurrency}; skipping: ${skipped}`);
    }

    const finalCurrency = trip.budgetCurrency ?? primaryCurrency;

    await db.trip.update({
      where: { id: trip.id },
      data: {
        budgetSpent: primaryTotal,
        ...(trip.budgetCurrency ? {} : { budgetCurrency: primaryCurrency }),
      },
    });

    console.log(`[fix-budget] trip "${trip.title}" → budgetSpent: ${primaryTotal} budgetCurrency: ${finalCurrency}`);
  }

  console.log("[fix-budget] done");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
