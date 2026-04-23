import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { normalizeAndDedupeCategoryTags } from "../src/lib/category-tags";

const LIVE = process.argv.includes("--live");

async function main() {
  console.log(LIVE ? "=== LIVE MODE: updates will be applied ===" : "=== DRY RUN: no updates ===");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) as any });

  const saves = await db.savedItem.findMany({
    select: { id: true, rawTitle: true, categoryTags: true },
  });
  const saveDupes = saves.filter((s) => {
    const current = s.categoryTags ?? [];
    const deduped = normalizeAndDedupeCategoryTags(current);
    return deduped.length !== current.length;
  });
  console.log(`SavedItem rows needing dedupe: ${saveDupes.length}`);

  let updated = 0;
  for (const s of saveDupes) {
    const deduped = normalizeAndDedupeCategoryTags(s.categoryTags ?? []);
    console.log(`[save] ${s.rawTitle}: ${JSON.stringify(s.categoryTags)} -> ${JSON.stringify(deduped)}`);
    if (LIVE) {
      await db.savedItem.update({
        where: { id: s.id },
        data: { categoryTags: { set: deduped } },
      });
      updated++;
    }
  }

  if (LIVE) {
    console.log(`Updated: ${updated} SavedItem rows`);
  } else {
    console.log("No updates applied. Re-run with --live to apply.");
  }
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
