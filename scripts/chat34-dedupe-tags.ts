import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) as any });

  const saves = await db.savedItem.findMany({
    select: { id: true, rawTitle: true, categoryTags: true },
  });
  const saveDupes = saves.filter((s) => {
    const tags = (s.categoryTags ?? []).map((t) => t.toLowerCase());
    return new Set(tags).size !== tags.length;
  });
  console.log(`SavedItem dupes: ${saveDupes.length}`);

  // NOTE: CommunitySpot uses category: String? (not categoryTags: String[]) — no dedupe needed there.
  console.log(`CommunitySpot dupes: 0 (model uses category: String?, not categoryTags: String[])`);

  // DRY RUN ONLY. Updates commented out until ship prompt approves.
  for (const s of saveDupes) {
    const deduped = Array.from(new Set((s.categoryTags ?? []).map((t) => t.toLowerCase())));
    // await db.savedItem.update({ where: { id: s.id }, data: { categoryTags: { set: deduped } } });
    console.log(`[save] ${s.rawTitle}: ${JSON.stringify(s.categoryTags)} -> ${JSON.stringify(deduped)}`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
