import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { verifyWebsiteUrl } from "../src/lib/activity-intelligence";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const activities = await prisma.manualActivity.findMany({
    where: { website: { not: null } },
    select: { id: true, title: true, website: true },
  });

  console.log(`Verifying ${activities.length} website URLs...`);

  let nulled = 0;
  let ok = 0;

  for (const act of activities) {
    const url = act.website!;
    const verified = await verifyWebsiteUrl(url);
    if (!verified) {
      await prisma.manualActivity.update({
        where: { id: act.id },
        data: { website: null },
      });
      console.log(`  ✗ nulled: ${act.title} — ${url}`);
      nulled++;
    } else {
      console.log(`  ✓ ok:    ${act.title}`);
      ok++;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\nDone. ${ok} OK, ${nulled} nulled.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
