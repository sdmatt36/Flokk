// Wave 2 itinerary batch seeder
// Run: npx tsx --tsconfig tsconfig.scripts.json scripts/run-wave-2-batch.ts
// Env: DATABASE_URL, ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
//      loaded from .env.local via dotenv
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import { generateCityItinerary } from "@/lib/generate-city-itinerary";

const LOG_FILE = "/tmp/wave-2-batch.log";
const SLEEP_MS = 60_000;

interface CityEntry {
  slug: string;
  tier: "Boundless" | "Europe" | "Asia/ME" | "Americas";
}

const CITIES: CityEntry[] = [
  // Tier 1: Boundless partnership (highest strategic value — run first)
  { slug: "sintra",       tier: "Boundless" },
  { slug: "estepona",     tier: "Boundless" },
  { slug: "kamakura",     tier: "Boundless" },
  { slug: "kotor",        tier: "Boundless" },
  { slug: "syros",        tier: "Boundless" },
  { slug: "ubud",         tier: "Boundless" },
  { slug: "la-barra",     tier: "Boundless" },
  { slug: "pistoia",      tier: "Boundless" },
  // Tier 2: Top 75 Europe
  { slug: "venice",       tier: "Europe" },
  { slug: "florence",     tier: "Europe" },
  { slug: "prague",       tier: "Europe" },
  { slug: "istanbul",     tier: "Europe" },
  { slug: "athens",       tier: "Europe" },
  { slug: "berlin",       tier: "Europe" },
  { slug: "vienna",       tier: "Europe" },
  { slug: "dublin",       tier: "Europe" },
  { slug: "edinburgh",    tier: "Europe" },
  { slug: "dubrovnik",    tier: "Europe" },
  { slug: "santorini",    tier: "Europe" },
  { slug: "budapest",     tier: "Europe" },
  { slug: "copenhagen",   tier: "Europe" },
  { slug: "stockholm",    tier: "Europe" },
  { slug: "oslo",         tier: "Europe" },
  { slug: "helsinki",     tier: "Europe" },
  { slug: "munich",       tier: "Europe" },
  { slug: "salzburg",     tier: "Europe" },
  { slug: "zurich",       tier: "Europe" },
  { slug: "geneva",       tier: "Europe" },
  { slug: "lucerne",      tier: "Europe" },
  { slug: "zermatt",      tier: "Europe" },
  { slug: "interlaken",   tier: "Europe" },
  { slug: "milan",        tier: "Europe" },
  { slug: "naples",       tier: "Europe" },
  { slug: "seville",      tier: "Europe" },
  { slug: "granada",      tier: "Europe" },
  { slug: "porto",        tier: "Europe" },
  { slug: "krakow",       tier: "Europe" },
  { slug: "warsaw",       tier: "Europe" },
  { slug: "tallinn",      tier: "Europe" },
  { slug: "bruges",       tier: "Europe" },
  { slug: "brussels",     tier: "Europe" },
  { slug: "bergen",       tier: "Europe" },
  { slug: "tromso",       tier: "Europe" },
  // Tier 3: Top 75 Asia / Middle East
  { slug: "singapore",    tier: "Asia/ME" },
  { slug: "hong-kong",    tier: "Asia/ME" },
  { slug: "cairo",        tier: "Asia/ME" },
  { slug: "wadi-musa",    tier: "Asia/ME" }, // Petra gateway — petra-wadi-musa slug absent from DB
  // Tier 4: Top 75 Americas
  { slug: "cusco",        tier: "Americas" },
  { slug: "mexico-city",  tier: "Americas" },
  { slug: "oaxaca",       tier: "Americas" },
  { slug: "tulum",        tier: "Americas" },
  { slug: "cancun",       tier: "Americas" },
  { slug: "havana",       tier: "Americas" },
  { slug: "cartagena",    tier: "Americas" },
  { slug: "rio-de-janeiro", tier: "Americas" },
  { slug: "iguazu-falls", tier: "Americas" },
  { slug: "santiago",     tier: "Americas" },
  { slug: "bogota",       tier: "Americas" },
  { slug: "lima",         tier: "Americas" },
  { slug: "quito",        tier: "Americas" },
  { slug: "toronto",      tier: "Americas" },
  { slug: "vancouver",    tier: "Americas" },
  { slug: "montreal",     tier: "Americas" },
  { slug: "quebec-city",  tier: "Americas" },
];

// ── Logging ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface BatchResult extends CityEntry {
  httpStatus?: number;
  status?: string;
  tripId?: string | null;
  savedItemCount?: number;
  enrichedCount?: number;
  heroImageUrl?: string | null;
  skipReason?: string;
  error?: string;
  elapsedSec?: number;
}

async function main() {
  fs.writeFileSync(LOG_FILE, `Wave 2 Batch — started ${new Date().toISOString()}\nCities: ${CITIES.length}\n\n`);
  log(`Starting Wave 2 batch: ${CITIES.length} cities, ${SLEEP_MS / 1000}s sleep between each`);
  log(`Estimated duration: ~${Math.round((CITIES.length * (60 + SLEEP_MS / 1000)) / 60)} minutes`);
  log("");

  const results: BatchResult[] = [];
  const batchStart = Date.now();

  for (let i = 0; i < CITIES.length; i++) {
    const { slug, tier } = CITIES[i];
    const cityStart = Date.now();

    log(`[${i + 1}/${CITIES.length}] ${slug} (${tier})`);

    let result: BatchResult;
    try {
      const r = await generateCityItinerary(slug);
      const elapsedSec = parseFloat(((Date.now() - cityStart) / 1000).toFixed(1));
      result = { slug, tier, elapsedSec, ...r };

      if (r.status === "success") {
        log(`  ✓ success | tripId=${r.tripId} | items=${r.savedItemCount} | enriched=${r.enrichedCount}/${r.savedItemCount} | hero=${!!r.heroImageUrl} | ${elapsedSec}s`);
      } else if (r.status === "skipped") {
        log(`  — skipped | ${r.skipReason} | tripId=${r.tripId}`);
      } else {
        log(`  ✗ error   | ${r.error}`);
      }
    } catch (e: unknown) {
      const elapsedSec = parseFloat(((Date.now() - cityStart) / 1000).toFixed(1));
      const msg = e instanceof Error ? e.message : String(e);
      result = { slug, tier, elapsedSec, status: "error", tripId: null, error: msg };
      log(`  ✗ THROW   | ${msg.slice(0, 120)}`);
    }

    results.push(result);

    // Watchdog: halt on 3 consecutive non-success results
    if (results.length >= 3) {
      const last3 = results.slice(-3);
      const allBad = last3.every((r) => r.status !== "success" && r.status !== "skipped");
      if (allBad) {
        log("");
        log("WATCHDOG: 3 consecutive errors — halting batch. Investigate before resuming.");
        log(`Last errors: ${last3.map((r) => `${r.slug}:${r.error}`).join(" | ")}`);
        break;
      }
    }

    if (i < CITIES.length - 1) {
      log(`  sleeping ${SLEEP_MS / 1000}s...`);
      await sleep(SLEEP_MS);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  const totalMinutes = ((Date.now() - batchStart) / 1000 / 60).toFixed(1);
  const success  = results.filter((r) => r.status === "success");
  const skipped  = results.filter((r) => r.status === "skipped");
  const errored  = results.filter((r) => r.status !== "success" && r.status !== "skipped");

  log("");
  log("═".repeat(64));
  log("WAVE 2 BATCH COMPLETE");
  log("═".repeat(64));
  log(`Attempted : ${results.length} / ${CITIES.length}`);
  log(`Success   : ${success.length}`);
  log(`Skipped   : ${skipped.length}`);
  log(`Errors    : ${errored.length}`);
  log(`Elapsed   : ${totalMinutes} min`);
  log("");

  const tiers = ["Boundless", "Europe", "Asia/ME", "Americas"] as const;
  log("Per-tier breakdown:");
  for (const tier of tiers) {
    const tr = results.filter((r) => r.tier === tier);
    const s  = tr.filter((r) => r.status === "success").length;
    const sk = tr.filter((r) => r.status === "skipped").length;
    const e  = tr.filter((r) => r.status !== "success" && r.status !== "skipped").length;
    log(`  ${tier.padEnd(10)} ${tr.length} cities — ${s} success, ${sk} skipped, ${e} error`);
  }

  log("");
  log("Per-city results:");
  for (const r of results) {
    if (r.status === "success") {
      log(`  ✓ ${r.slug.padEnd(22)} tripId=${r.tripId}`);
    } else if (r.status === "skipped") {
      log(`  — ${r.slug.padEnd(22)} ${r.skipReason ?? "already exists"}`);
    } else {
      log(`  ✗ ${r.slug.padEnd(22)} ${r.error ?? "unknown error"}`);
    }
  }

  if (errored.length > 0) {
    log("");
    log("Errors requiring attention:");
    for (const r of errored) {
      log(`  ${r.slug}: ${r.error}`);
    }
  }

  log("");
  log(`Full log written to: ${LOG_FILE}`);
}

main().catch((e) => {
  console.error("Fatal batch error:", e);
  process.exit(1);
});
