import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { inferCuisine, inferLodgingType, CUISINE_MARKERS } from "../src/lib/cuisines";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    // ── Cuisine: food_and_drink spots ─────────────────────────────────────────
    const foodSpots = await db.communitySpot.findMany({
      where: { category: "food_and_drink", cuisine: null },
      select: { id: true, name: true, country: true },
    });
    console.log(`[cuisine] populating ${foodSpots.length} food spots`);
    for (const s of foodSpots) {
      const cuisine = inferCuisine(s.name, s.country ?? "");
      await db.communitySpot.update({ where: { id: s.id }, data: { cuisine } });
    }

    // ── Cuisine: 'other' spots where a marker explicitly matches ──────────────
    const otherSpots = await db.communitySpot.findMany({
      where: { category: "other", cuisine: null },
      select: { id: true, name: true, country: true },
    });
    let otherCuisineCount = 0;
    for (const s of otherSpots) {
      for (const m of CUISINE_MARKERS) {
        if (m.patterns.test(s.name)) {
          await db.communitySpot.update({ where: { id: s.id }, data: { cuisine: m.cuisine } });
          otherCuisineCount++;
          break;
        }
      }
    }
    console.log(`[cuisine] populated ${otherCuisineCount} 'other' spots via name marker`);

    // ── LodgingType: explicit lodging category + hotel-named 'other' spots ────
    const lodgingSpots = await db.communitySpot.findMany({
      where: {
        OR: [
          { category: "lodging" },
          { category: "other", name: { contains: "Hotel", mode: "insensitive" } },
          { category: "other", name: { contains: "Hostel", mode: "insensitive" } },
          { category: "other", name: { contains: "Resort", mode: "insensitive" } },
          { category: "other", name: { contains: "Inn", mode: "insensitive" } },
          { category: "other", name: { contains: "Hyatt", mode: "insensitive" } },
          { category: "other", name: { contains: "Marriott", mode: "insensitive" } },
          { category: "other", name: { contains: "Hilton", mode: "insensitive" } },
        ],
        lodgingType: null,
      },
      select: { id: true, name: true },
    });
    console.log(`[lodgingType] populating ${lodgingSpots.length} lodging spots`);
    for (const s of lodgingSpots) {
      const lodgingType = inferLodgingType(s.name);
      await db.communitySpot.update({ where: { id: s.id }, data: { lodgingType } });
    }

    // ── Final tallies ─────────────────────────────────────────────────────────
    const foodWithCuisine = await db.communitySpot.count({ where: { cuisine: { not: null } } });
    const lodgingWithType = await db.communitySpot.count({ where: { lodgingType: { not: null } } });
    console.log(`[done] spots with cuisine: ${foodWithCuisine}, spots with lodgingType: ${lodgingWithType}`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
