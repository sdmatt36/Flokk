import * as dotenv from "dotenv";
dotenv.config({ path: ".env.production" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { lookupPlace, isJunkPlaceName } from "../src/lib/google-places";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const items = await prisma.savedItem.findMany({
    where: {
      websiteUrl: null,
      rawTitle: { not: null },
      destinationCity: { not: null },
    },
    select: {
      id: true,
      rawTitle: true,
      destinationCity: true,
    },
  });

  const eligible = items.filter((item) => !isJunkPlaceName(item.rawTitle!));
  const skippedJunk = items.length - eligible.length;

  console.log(
    `Found ${items.length} items with no websiteUrl. ${skippedJunk} junk skipped. Processing ${eligible.length}...`
  );

  let processed = 0;
  let filled = 0;
  let skipped = 0;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      const title = item.rawTitle!;
      const city = item.destinationCity!;
      const result = await lookupPlace(title, city);
      processed++;

      if (!result) {
        console.log(`[website] "${title}" -> no match or name mismatch`);
        skipped++;
        continue;
      }

      if (!result.website) {
        console.log(`[website] "${title}" -> no website (Places: "${result.name}")`);
        skipped++;
        continue;
      }

      await prisma.savedItem.update({
        where: { id: item.id },
        data: { websiteUrl: result.website },
      });
      console.log(`[website] "${title}" -> ${result.website}`);
      filled++;
    }

    if (i + BATCH_SIZE < eligible.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(
    `\nDone. processed=${processed} filled=${filled} skipped=${skipped} skipped(junk)=${skippedJunk}`
  );
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
