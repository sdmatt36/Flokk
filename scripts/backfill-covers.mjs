// Backfill heroImageUrl for trips with null cover images using static destination map
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const FAMILY_PROFILE_ID = "cmmmv15y7000104jvocfz5kt6";
const DEFAULT_COVER = "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&q=80";

const DESTINATION_IMAGES = {
  tokyo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80",
  kyoto: "https://images.unsplash.com/photo-1624601573012-efb68931cc8f?w=1200&q=80",
  osaka: "https://images.unsplash.com/photo-1589452271712-64b8a66c1d7a?w=1200&q=80",
  seoul: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200&q=80",
  busan: "https://images.unsplash.com/photo-1605289355680-75fb41239154?w=1200&q=80",
  okinawa: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200&q=80",
  naha: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200&q=80",
  kamakura: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1200&q=80",
  "chiang mai": "https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=1200&q=80",
  "chiang rai": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1200&q=80",
  "sri lanka": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&q=80",
  colombo: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&q=80",
  paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80",
  london: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=80",
  "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&q=80",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80",
  singapore: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=80",
  bangkok: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&q=80",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80",
};

function getCoverForCity(city) {
  if (!city) return null;
  const key = city.toLowerCase().trim();
  if (DESTINATION_IMAGES[key]) return DESTINATION_IMAGES[key];
  // Partial match
  const match = Object.keys(DESTINATION_IMAGES).find(k => key.includes(k) || k.includes(key));
  return match ? DESTINATION_IMAGES[match] : null;
}

async function main() {
  const trips = await db.trip.findMany({
    where: { familyProfileId: FAMILY_PROFILE_ID, heroImageUrl: null },
    select: { id: true, title: true, destinationCity: true, destinationCountry: true },
  });

  console.log(`Found ${trips.length} trips without cover images`);

  for (const trip of trips) {
    const photoUrl = getCoverForCity(trip.destinationCity) || getCoverForCity(trip.destinationCountry) || DEFAULT_COVER;
    await db.trip.update({ where: { id: trip.id }, data: { heroImageUrl: photoUrl } });
    console.log(`✓ ${trip.title} (${trip.destinationCity}) → cover set`);
  }

  console.log("Done.");
  await db.$disconnect();
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
