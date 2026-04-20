import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter } as any);

const SEED_USER_ID = "seed_community_user_v1";
const SEED_CLERK_ID = "seed_community_clerk_v1";
const SEED_EMAIL = "community@flokk.seed";
const SEED_PROFILE_ID = "seed_community_profile_v1";

const KYOTO_ID = "cmtrip-kyoto-may25";
const MADRID_ID = "cmtrip-madrid-jun25";
const LISBON_ID = "cmtrip-lisbon-jul25";

async function main() {
  console.log("Seeding community trips...");

  // 1. Seed user + family profile
  await db.user.upsert({
    where: { id: SEED_USER_ID },
    create: {
      id: SEED_USER_ID,
      clerkId: SEED_CLERK_ID,
      email: SEED_EMAIL,
    },
    update: {},
  });

  await db.familyProfile.upsert({
    where: { id: SEED_PROFILE_ID },
    create: {
      id: SEED_PROFILE_ID,
      userId: SEED_USER_ID,
      familyName: "Community",
    },
    update: {},
  });

  // 2. Kyoto trip
  await db.trip.upsert({
    where: { id: KYOTO_ID },
    create: {
      id: KYOTO_ID,
      familyProfileId: SEED_PROFILE_ID,
      title: "Kyoto with Kids",
      destinationCity: "Kyoto",
      destinationCountry: "Japan",
      startDate: new Date("2025-05-10"),
      endDate: new Date("2025-05-15"),
      status: "COMPLETED",
      privacy: "PUBLIC",
      heroImageUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&auto=format&fit=crop&q=80",
    },
    update: {},
  });

  // Clear and recreate saved items for Kyoto
  await db.savedItem.deleteMany({ where: { tripId: KYOTO_ID } });
  await db.savedItem.createMany({
    data: [
      // Day 0 = metadata
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Family of 4 · Kids ages 6 & 9", rawDescription: "5 days · Completed May 2025", categoryTags: ["Culture", "Kid-friendly", "UNESCO sites"], dayIndex: 0 },
      // Day 1
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Fushimi Inari Shrine", rawDescription: "Head here early morning — before 8am the thousands of torii gates are nearly empty. Kids love the tunnel effect. Allow 1.5–2 hours.", categoryTags: ["culture", "outdoors", "kids"], dayIndex: 1, lat: 34.9671, lng: 135.7727 },
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Nishiki Market", rawDescription: "Kyoto's 'kitchen' — a covered arcade packed with street food, pickles, fresh tofu and grilled skewers. Great for a strolling lunch.", categoryTags: ["food", "culture"], dayIndex: 1, lat: 35.0042, lng: 135.7657 },
      // Day 2
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Arashiyama Bamboo Grove", rawDescription: "The iconic bamboo path — arrive by 8am to beat the tour groups. The rustling sound of the bamboo is unforgettable.", categoryTags: ["outdoors", "culture", "kids"], dayIndex: 2, lat: 35.0175, lng: 135.6727 },
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Tenryu-ji Garden", rawDescription: "UNESCO World Heritage Zen garden right next to the bamboo grove. The dry landscape and pond garden are stunning. Kids can spot koi.", categoryTags: ["culture", "kids"], dayIndex: 2, lat: 35.0171, lng: 135.6736 },
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Hozu River Boat Ride", rawDescription: "A 16km scenic boat ride through the Arashiyama gorge. Takes about 2 hours. Kids are mesmerised — book ahead.", categoryTags: ["outdoors", "kids"], dayIndex: 2, lat: 35.0090, lng: 135.6700 },
      // Day 3
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Kinkaku-ji (Golden Pavilion)", rawDescription: "Kyoto's most photographed sight — the gold-leaf covered temple reflecting in the mirror pond. Arrive at opening to avoid the worst crowds.", categoryTags: ["culture", "kids", "unesco"], dayIndex: 3, lat: 35.0394, lng: 135.7292 },
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Ryoan-ji Rock Garden", rawDescription: "The world's most famous karesansui garden — 15 stones arranged so you can never see all of them at once. A great conversation starter with kids.", categoryTags: ["culture", "unesco"], dayIndex: 3, lat: 35.0345, lng: 135.7184 },
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Philosopher's Path", rawDescription: "A canal-side stone path lined with hundreds of cherry trees. Walk it in the late afternoon. Lined with small cafés and temples.", categoryTags: ["outdoors", "culture"], dayIndex: 3, lat: 35.0266, lng: 135.7938 },
      // Day 4
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Todai-ji Temple, Nara", rawDescription: "Home to Japan's largest bronze Buddha — the scale is genuinely jaw-dropping even for adults. Kids love it.", categoryTags: ["culture", "kids", "unesco"], dayIndex: 4, lat: 34.6889, lng: 135.8398 },
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Nara Deer Park", rawDescription: "Over 1,000 wild deer roam freely. Buy deer crackers and prepare for total chaos. One of the most memorable family travel moments in Japan.", categoryTags: ["kids", "outdoors", "wildlife"], dayIndex: 4, lat: 34.6847, lng: 135.8475 },
      // Day 5
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Gion District Morning Walk", rawDescription: "Early morning is the best time — quiet cobblestone lanes, wooden machiya townhouses, chance of spotting geiko heading to appointments.", categoryTags: ["culture", "kids"], dayIndex: 5, lat: 35.0034, lng: 135.7753 },
      { familyProfileId: SEED_PROFILE_ID, tripId: KYOTO_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Sanjusangendo", rawDescription: "Hall of 1,001 golden warrior statues. The sheer scale is eerie and stunning. Kids are completely silent inside — which says everything.", categoryTags: ["culture", "kids"], dayIndex: 5, lat: 34.9878, lng: 135.7741 },
    ],
  });

  console.log("✓ Kyoto trip seeded");

  // 3. Madrid trip
  await db.trip.upsert({
    where: { id: MADRID_ID },
    create: {
      id: MADRID_ID,
      familyProfileId: SEED_PROFILE_ID,
      title: "Madrid Long Weekend",
      destinationCity: "Madrid",
      destinationCountry: "Spain",
      startDate: new Date("2025-06-05"),
      endDate: new Date("2025-06-09"),
      status: "COMPLETED",
      privacy: "PUBLIC",
      heroImageUrl: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200&auto=format&fit=crop&q=80",
    },
    update: {},
  });

  await db.savedItem.deleteMany({ where: { tripId: MADRID_ID } });
  await db.savedItem.createMany({
    data: [
      // Metadata
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Family of 3 · Kid age 8", rawDescription: "4 days · Completed June 2025", categoryTags: ["Food", "Culture", "City"], dayIndex: 0 },
      // Day 1
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Retiro Park", rawDescription: "Madrid's central park — rent a rowboat on the lake, watch street performers, and let the kids run. Locals come here on Sunday mornings.", categoryTags: ["outdoors", "kids"], dayIndex: 1, lat: 40.4153, lng: -3.6846 },
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Rooftop Sunset — Círculo de Bellas Artes", rawDescription: "The best rooftop view in Madrid. €5 entry for the terrace. Order a caña and watch the city go golden. Kids are welcome.", categoryTags: ["views", "food"], dayIndex: 1, lat: 40.4177, lng: -3.6990 },
      // Day 2
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Prado Museum — Kids' Highlights Tour", rawDescription: "Don't attempt all of it. Focus: Velázquez's Las Meninas, Goya's Saturn, and the Egyptian Temple of Debod nearby. 90 minutes max with kids.", categoryTags: ["culture", "kids", "art"], dayIndex: 2, lat: 40.4138, lng: -3.6920 },
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Mercado de San Miguel", rawDescription: "The finest food market in the city. Order jamón, tortilla, croquetas and share everything. Go at noon when it's buzzing.", categoryTags: ["food"], dayIndex: 2, lat: 40.4151, lng: -3.7091 },
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Puerta del Sol", rawDescription: "Madrid's central square — the 'km 0' of all Spanish roads. Walk to the bear statue, catch the atmosphere, then head into the lanes behind.", categoryTags: ["culture", "kids"], dayIndex: 2, lat: 40.4168, lng: -3.7038 },
      // Day 3
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Royal Palace", rawDescription: "The largest royal palace in Western Europe by floor area. The frescoed ceilings alone justify the visit. Kids like the armour collection.", categoryTags: ["culture", "history", "kids"], dayIndex: 3, lat: 40.4181, lng: -3.7146 },
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Almudena Cathedral", rawDescription: "Right next to the palace. Rooftop visit offers the best view of Casa de Campo and the mountains beyond Madrid.", categoryTags: ["culture", "history"], dayIndex: 3, lat: 40.4163, lng: -3.7139 },
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Malasaña Neighbourhood Lunch", rawDescription: "Madrid's creative quarter — great indie restaurants, street art and the best churros con chocolate in the city at Chocolatería San Ginés nearby.", categoryTags: ["food", "culture"], dayIndex: 3, lat: 40.4256, lng: -3.7034 },
      // Day 4
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Thyssen-Bornemisza Museum", rawDescription: "More manageable than the Prado for kids — focus on the Impressionist rooms. Monet, Renoir, Van Gogh, Hopper. 1 hour is enough.", categoryTags: ["culture", "art", "kids"], dayIndex: 4, lat: 40.4166, lng: -3.6940 },
      { familyProfileId: SEED_PROFILE_ID, tripId: MADRID_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "El Rastro Flea Market", rawDescription: "Madrid's famous Sunday flea market. 3,000+ stalls. Great for vintage finds, ceramics and people-watching. Go early before it gets too crowded.", categoryTags: ["shopping", "culture"], dayIndex: 4, lat: 40.4082, lng: -3.7060 },
    ],
  });

  console.log("✓ Madrid trip seeded");

  // 4. Lisbon trip
  await db.trip.upsert({
    where: { id: LISBON_ID },
    create: {
      id: LISBON_ID,
      familyProfileId: SEED_PROFILE_ID,
      title: "Lisbon & Sintra",
      destinationCity: "Lisbon",
      destinationCountry: "Portugal",
      startDate: new Date("2025-07-14"),
      endDate: new Date("2025-07-20"),
      status: "COMPLETED",
      privacy: "PUBLIC",
      heroImageUrl: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&auto=format&fit=crop&q=80",
    },
    update: {},
  });

  await db.savedItem.deleteMany({ where: { tripId: LISBON_ID } });
  await db.savedItem.createMany({
    data: [
      // Metadata
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Family of 5 · Kids ages 5, 8 & 12", rawDescription: "6 days · Completed July 2025", categoryTags: ["Adventure", "History", "Beach"], dayIndex: 0 },
      // Day 1
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Alfama District", rawDescription: "Lisbon's oldest neighbourhood — winding alleys, miradouros (viewpoints), and the sound of fado drifting from restaurants. Walk it slowly.", categoryTags: ["culture", "history"], dayIndex: 1, lat: 38.7136, lng: -9.1319 },
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "São Jorge Castle", rawDescription: "Moorish castle with sweeping 360° views over Lisbon and the Tagus. Kids can explore the towers and battlements freely. Great at sunset.", categoryTags: ["history", "kids", "views"], dayIndex: 1, lat: 38.7137, lng: -9.1335 },
      // Day 2
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Belém Tower", rawDescription: "The iconic Manueline tower on the Tagus estuary — symbol of Portugal's Age of Discovery. Queues can be long so book tickets online.", categoryTags: ["history", "unesco"], dayIndex: 2, lat: 38.6916, lng: -9.2158 },
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Jerónimos Monastery", rawDescription: "One of the most beautiful buildings in Portugal. The cloister is extraordinary. Free on Sunday mornings. Kids find the stone carvings incredible.", categoryTags: ["history", "culture", "unesco", "kids"], dayIndex: 2, lat: 38.6978, lng: -9.2057 },
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Pastéis de Belém", rawDescription: "The original pastel de nata. A queue outside always — but moves fast. Order six, dust with cinnamon, eat standing at the counter.", categoryTags: ["food"], dayIndex: 2, lat: 38.6975, lng: -9.2063 },
      // Day 3
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Pena Palace, Sintra", rawDescription: "A fairytale palace perched on a cliff in the forest — vivid yellow and red turrets, drawbridges, battlements. Kids think it's a real Disney castle.", categoryTags: ["history", "kids", "views", "unesco"], dayIndex: 3, lat: 38.7880, lng: -9.3912 },
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Moorish Castle, Sintra", rawDescription: "Ancient castle walls snaking along the ridge above Sintra. The 10-minute uphill walk is worth it — views extend to the ocean.", categoryTags: ["history", "outdoors", "kids"], dayIndex: 3, lat: 38.7900, lng: -9.3881 },
      // Day 4
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Cascais Beach Day", rawDescription: "30 minutes from Lisbon by train — a beautiful Atlantic beach town. Blue-flag beaches, calm water in summer, great for younger kids.", categoryTags: ["beach", "kids", "outdoors"], dayIndex: 4, lat: 38.6979, lng: -9.4193 },
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Seafood Lunch in Cascais", rawDescription: "Order grilled fish (robalo or dourada), amêijoas à bulhão pato (clams), and fresh bread. Eat outside facing the water.", categoryTags: ["food", "seafood"], dayIndex: 4, lat: 38.6972, lng: -9.4200 },
      // Day 5
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "LX Factory Sunday Market", rawDescription: "Lisbon's hippest market — housed in a converted 19th-century industrial complex. Books, vintage, ceramics, street food trucks. Great for all ages.", categoryTags: ["shopping", "food", "culture"], dayIndex: 5, lat: 38.7057, lng: -9.1769 },
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Mouraria Neighbourhood", rawDescription: "Lisbon's most authentic quarter — birthplace of fado, full of street art, cheap tascas and neighbourhood life. Walk the alleys before dinner.", categoryTags: ["culture", "food"], dayIndex: 5, lat: 38.7172, lng: -9.1369 },
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Tram 28", rawDescription: "The iconic yellow tram that creaks through Alfama and Graça. It's crowded but the experience is worth it — kids love it. Hold on tight.", categoryTags: ["culture", "kids", "experience"], dayIndex: 5, lat: 38.7111, lng: -9.1387 },
      // Day 6
      { familyProfileId: SEED_PROFILE_ID, tripId: LISBON_ID, sourceMethod: "IN_APP_SAVE", sourcePlatform: "direct", extractionStatus: "ENRICHED", status: "TRIP_ASSIGNED", rawTitle: "Time Out Market", rawDescription: "Lisbon's landmark food market — 35+ chef counters under one roof. Perfect last morning: everyone picks their own breakfast. Then airport.", categoryTags: ["food", "kids"], dayIndex: 6, lat: 38.7061, lng: -9.1753 },
    ],
  });

  console.log("✓ Lisbon trip seeded");
  console.log("\nAll community trips seeded successfully.");
  console.log(`Kyoto ID: ${KYOTO_ID}`);
  console.log(`Madrid ID: ${MADRID_ID}`);
  console.log(`Lisbon ID: ${LISBON_ID}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); await pool.end(); });
