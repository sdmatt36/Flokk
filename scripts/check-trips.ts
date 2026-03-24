import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const trips = await db.trip.findMany({
    where: { privacy: "PUBLIC", status: "COMPLETED" },
    select: { id: true, title: true, destinationCity: true, destinationCountry: true },
  });
  console.log(JSON.stringify(trips, null, 2));
  await db.$disconnect();
}

main();
