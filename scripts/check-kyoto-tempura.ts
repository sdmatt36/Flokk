import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const SAVE_ID = "cmo84yd01000004jmvimn0aze";

async function main() {
  const item = await db.savedItem.findUnique({
    where: { id: SAVE_ID },
    select: {
      id: true,
      rawTitle: true,
      extractionStatus: true,
      destinationCity: true,
      destinationCountry: true,
      sourcePlatform: true,
      sourceUrl: true,
      lat: true,
      lng: true,
    },
  });
  console.log("Current state:", JSON.stringify(item, null, 2));
  await db.$disconnect();
}

main().catch(console.error);
