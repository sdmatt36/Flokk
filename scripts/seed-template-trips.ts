/**
 * Seeds 10 public community template trips for the Discover page.
 * Run: npx tsx --env-file=.env.local scripts/seed-template-trips.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { normalizeAndDedupeCategoryTags } from "../src/lib/category-tags";

const pool = new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Template data ─────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    title: "Tokyo Family Week",
    destinationCity: "Tokyo",
    destinationCountry: "Japan",
    startDate: new Date("2024-04-01"),
    endDate: new Date("2024-04-08"),
    saves: [
      { day: 1, title: "teamLab Borderless", desc: "Immersive digital art museum — kids go wild for the light forests and crystal worlds.", tags: ["art", "family", "kids"] },
      { day: 1, title: "Shibuya Crossing", desc: "World's busiest pedestrian scramble. Best viewed from Starbucks Shibuya Sky.", tags: ["iconic", "photo"] },
      { day: 2, title: "Senso-ji Temple, Asakusa", desc: "Tokyo's oldest temple, Nakamise shopping street, and street food stalls.", tags: ["culture", "temple"] },
      { day: 2, title: "Tokyo Skytree", desc: "634m observation deck with views to Mt Fuji on clear days.", tags: ["views", "family"] },
      { day: 3, title: "Harajuku Takeshita Street", desc: "Crazy crepes, purikura booths, kawaii everything. Kids love it.", tags: ["food", "shopping"] },
      { day: 3, title: "Meiji Shrine", desc: "Serene forested shrine in the heart of the city — perfect morning walk.", tags: ["culture", "nature"] },
      { day: 4, title: "Shinjuku Gyoen Garden", desc: "Best cherry blossom picnic spot in Tokyo. Bring a tarp and snacks.", tags: ["nature", "picnic"] },
      { day: 4, title: "Robot Restaurant Shinjuku", desc: "Over-the-top robot dinner show — loud, fun, and totally unique.", tags: ["dinner", "entertainment"] },
      { day: 5, title: "Odaiba Palette Town", desc: "Gundam statue, teamLab Planets, beach boardwalk, and great ramen.", tags: ["family", "tech"] },
      { day: 5, title: "Tsukiji Outer Market", desc: "Fresh sushi breakfast by 7am. The tuna tamagoyaki is legendary.", tags: ["food", "market"] },
    ],
  },
  {
    title: "Paris with Kids",
    destinationCity: "Paris",
    destinationCountry: "France",
    startDate: new Date("2024-07-10"),
    endDate: new Date("2024-07-17"),
    saves: [
      { day: 1, title: "Eiffel Tower", desc: "Book tickets online 2 months ahead. Sunset visit is worth the wait.", tags: ["iconic", "views"] },
      { day: 1, title: "Champ de Mars Picnic", desc: "Grab a baguette from Rue Cler and picnic under the tower.", tags: ["food", "picnic"] },
      { day: 2, title: "Musée d'Orsay", desc: "Impressionist masterpieces in a beautiful old train station. Kids love the giant clocks.", tags: ["art", "culture"] },
      { day: 2, title: "Berthillon Ice Cream, Île Saint-Louis", desc: "Best ice cream in Paris. Lavender and caramel are standouts.", tags: ["food", "dessert"] },
      { day: 3, title: "Disneyland Paris", desc: "45 min from city centre by RER A. Full family day — book fast passes.", tags: ["family", "theme park"] },
      { day: 4, title: "Sacré-Cœur & Montmartre", desc: "Hike up or take the funicular. Artists, crêpes, and panoramic views.", tags: ["culture", "views"] },
      { day: 4, title: "Le Marais Walking Tour", desc: "Jewish quarter, Place des Vosges, falafel on Rue des Rosiers.", tags: ["food", "history"] },
      { day: 5, title: "Palace of Versailles", desc: "Train from Invalides, 35 min. Book early entry. Hall of Mirrors is unmissable.", tags: ["history", "culture"] },
      { day: 5, title: "Jardin d'Acclimatation", desc: "Bois de Boulogne amusement park with rides, ponies, and a mini train.", tags: ["family", "kids"] },
      { day: 6, title: "Seine River Cruise", desc: "Bateaux Mouches evening cruise past floodlit monuments. Kids love it.", tags: ["scenic", "family"] },
    ],
  },
  {
    title: "Barcelona Sun & Culture",
    destinationCity: "Barcelona",
    destinationCountry: "Spain",
    startDate: new Date("2024-08-05"),
    endDate: new Date("2024-08-12"),
    saves: [
      { day: 1, title: "Sagrada Família", desc: "Book tower tickets + morning entry. The stained glass nave is breathtaking.", tags: ["architecture", "iconic"] },
      { day: 1, title: "Park Güell", desc: "Mosaic terraces, gingerbread gatehouses, and city views. Go at opening.", tags: ["art", "views"] },
      { day: 2, title: "Barceloneta Beach", desc: "Central city beach. Good waves, chiringuito bars, and easy walk from Born.", tags: ["beach", "family"] },
      { day: 2, title: "La Boqueria Market", desc: "Best jamón, fresh juice, and pintxos in the city. Come hungry at 9am.", tags: ["food", "market"] },
      { day: 3, title: "Gothic Quarter Walk", desc: "Roman ruins, hidden plazas, and the best churros con chocolate at Granja Viader.", tags: ["history", "food"] },
      { day: 3, title: "MNAC Art Museum", desc: "Romanesque collection on Montjuïc hill with magic fountain below.", tags: ["art", "culture"] },
      { day: 4, title: "Camp Nou Stadium Tour", desc: "Barça museum + pitch-side access. Book ahead. Kids love the trophies.", tags: ["sports", "family"] },
      { day: 4, title: "El Born & Santa Maria del Mar", desc: "Most beautiful Gothic church in Barcelona, surrounded by great tapas bars.", tags: ["culture", "food"] },
      { day: 5, title: "Tibidabo Amusement Park", desc: "Mountain-top funfair with vintage rides and panoramic city views.", tags: ["family", "kids", "views"] },
      { day: 5, title: "Tapas Bar Hopping in Gràcia", desc: "Vermouth and pintxos crawl through the best neighbourhood bars.", tags: ["food", "nightlife"] },
    ],
  },
  {
    title: "Bangkok Adventure",
    destinationCity: "Bangkok",
    destinationCountry: "Thailand",
    startDate: new Date("2024-12-20"),
    endDate: new Date("2024-12-27"),
    saves: [
      { day: 1, title: "Grand Palace & Wat Phra Kaew", desc: "Emerald Buddha and golden spires. Arrive at 8:30am before the crowds.", tags: ["culture", "temple"] },
      { day: 1, title: "Wat Pho Reclining Buddha", desc: "45m gold reclining Buddha, famous Thai massage school, 5-min walk from Palace.", tags: ["culture", "wellness"] },
      { day: 2, title: "Chatuchak Weekend Market", desc: "8,000+ stalls of everything. Best street food in the city. Go Saturday AM.", tags: ["market", "food", "shopping"] },
      { day: 2, title: "Rooftop Bar at Vertigo (Banyan Tree)", desc: "Most dramatic rooftop view in Bangkok. Sunset drinks with kids before dinner.", tags: ["views", "drinks"] },
      { day: 3, title: "Floating Market — Damnoen Saduak", desc: "90 min from city. Longtail boats, fresh coconut, and Pad Thai cooked on a boat.", tags: ["culture", "food"] },
      { day: 3, title: "Asiatique The Riverfront", desc: "Night market by the Chao Phraya — Ferris wheel, Muay Thai shows, street food.", tags: ["family", "nightlife"] },
      { day: 4, title: "Wat Arun at Sunrise", desc: "Short ferry across the river at 6am. Serene, cool, and completely crowd-free.", tags: ["temple", "sunrise"] },
      { day: 4, title: "Chinatown Yaowarat", desc: "Bangkok's Chinatown at night — gold shops, roast duck, dim sum, and chaos.", tags: ["food", "culture"] },
      { day: 5, title: "Lumphini Park Morning", desc: "Bangkok's Central Park — monitor lizards, Tai Chi, paddleboats.", tags: ["nature", "family"] },
      { day: 5, title: "Thai Cooking Class", desc: "Half-day class with morning market tour. Kids make mango sticky rice.", tags: ["food", "activity", "kids"] },
    ],
  },
  {
    title: "Seoul in 7 Days",
    destinationCity: "Seoul",
    destinationCountry: "South Korea",
    startDate: new Date("2024-10-01"),
    endDate: new Date("2024-10-08"),
    saves: [
      { day: 1, title: "Gyeongbokgung Palace", desc: "Most iconic palace — best at opening for the changing of the guard ceremony at 10am.", tags: ["culture", "history"] },
      { day: 1, title: "Bukchon Hanok Village", desc: "600-year-old neighbourhood of hanok houses. Hanbok rental included for photos.", tags: ["culture", "photo"] },
      { day: 2, title: "Namsan Tower (N Seoul Tower)", desc: "Cable car up, city views, love locks, and a great family lunch at the top.", tags: ["views", "family"] },
      { day: 2, title: "Insadong Antique Street", desc: "Traditional tea houses, street food pancakes, and craft shops.", tags: ["culture", "food"] },
      { day: 3, title: "DMZ Day Tour", desc: "Organized tour from Seoul — Joint Security Area, Infiltration Tunnel, Dora Observatory.", tags: ["history", "tour"] },
      { day: 4, title: "Lotte World Theme Park", desc: "World's largest indoor theme park. Fast pass essential. Amazing for kids.", tags: ["family", "theme park", "kids"] },
      { day: 4, title: "Gwangjang Market Night Food", desc: "Bindaetteok pancakes, yukhoe raw beef, and soju under neon lights.", tags: ["food", "market", "nightlife"] },
      { day: 5, title: "Dongdaemun Design Plaza (DDP)", desc: "Futuristic Zaha Hadid building — market below, design exhibitions inside.", tags: ["design", "shopping"] },
      { day: 5, title: "Han River Picnic & Bike Ride", desc: "Rent bikes from Ttareungyi app, grab convenience store kimbap, and ride at sunset.", tags: ["nature", "family", "outdoor"] },
      { day: 6, title: "Korean BBQ in Mapo-gu", desc: "Best samgyeopsal neighbourhood. Order pork belly + makgeolli and go family-style.", tags: ["food", "dinner"] },
    ],
  },
  {
    title: "Lisbon Long Weekend",
    destinationCity: "Lisbon",
    destinationCountry: "Portugal",
    startDate: new Date("2024-05-15"),
    endDate: new Date("2024-05-22"),
    saves: [
      { day: 1, title: "Alfama Tram 28", desc: "Iconic yellow tram through narrow streets. Ride it early morning before queues.", tags: ["iconic", "transport"] },
      { day: 1, title: "Pastéis de Belém", desc: "Original custard tart bakery since 1837. Order a dozen — they're addictive.", tags: ["food", "iconic"] },
      { day: 2, title: "Jerónimos Monastery", desc: "Portugal's greatest Manueline monument. Free on Sunday mornings.", tags: ["history", "architecture"] },
      { day: 2, title: "LX Factory Sunday Market", desc: "Hipster market in old industrial complex — books, food trucks, and live music.", tags: ["market", "food"] },
      { day: 3, title: "Sintra Palace Day Trip", desc: "40-min train from Rossio. Pena Palace + Quinta da Regaleira is a full day.", tags: ["day trip", "history"] },
      { day: 3, title: "Cascais Beach Afternoon", desc: "Continue west from Sintra for a sunset beach visit. Take the train back to Lisbon.", tags: ["beach", "sunset"] },
      { day: 4, title: "Time Out Market Lisboa", desc: "Best food market in Europe — 40+ chefs, rooftop bar, and zero bad options.", tags: ["food", "market"] },
      { day: 4, title: "Fado Show in Mouraria", desc: "Authentic fado in a small restaurant — book ahead for weekend shows.", tags: ["culture", "music"] },
      { day: 5, title: "Oceanarium Lisbon", desc: "One of Europe's best aquariums. Central ocean tank with sharks and rays.", tags: ["family", "kids", "aquarium"] },
      { day: 5, title: "Bairro Alto Night Walk", desc: "Densely packed bars and restaurants. Ginjinha cherry liqueur from a hole-in-the-wall.", tags: ["nightlife", "food"] },
    ],
  },
  {
    title: "London Family Trip",
    destinationCity: "London",
    destinationCountry: "United Kingdom",
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-06-08"),
    saves: [
      { day: 1, title: "British Museum", desc: "Rosetta Stone, Elgin Marbles, and an Egyptian mummies gallery kids love. Free entry.", tags: ["culture", "history", "kids"] },
      { day: 1, title: "Borough Market", desc: "Best food market in London. Go for lunch on Thursday–Saturday for maximum stalls.", tags: ["food", "market"] },
      { day: 2, title: "Tower of London", desc: "Crown Jewels, Beefeaters, and great views from the battlements. Book ahead.", tags: ["history", "iconic"] },
      { day: 2, title: "Tower Bridge Walk", desc: "Glass floor walkway with views over the Thames. Combined ticket with Tower.", tags: ["iconic", "views"] },
      { day: 3, title: "Natural History Museum", desc: "Diplodocus skeleton, earthquake simulator, and free for all ages.", tags: ["family", "kids", "science"] },
      { day: 3, title: "Hyde Park Kensington", desc: "Row a boat on the Serpentine, visit the Diana Memorial Playground.", tags: ["outdoor", "family"] },
      { day: 4, title: "Harry Potter Studio Tour", desc: "40 min from London by shuttle. Book months in advance. Worth every penny.", tags: ["family", "kids", "tour"] },
      { day: 5, title: "Greenwich & Royal Observatory", desc: "DLR to Greenwich. Stand on the Prime Meridian. Brilliant for kids.", tags: ["history", "family"] },
      { day: 5, title: "Camden Market", desc: "Wildly eclectic market with global street food from every country.", tags: ["market", "food", "shopping"] },
      { day: 6, title: "West End Show", desc: "Book 6–8 weeks ahead for Lion King, Matilda, or Mamma Mia. Family matinee.", tags: ["entertainment", "culture"] },
    ],
  },
  {
    title: "Montreal Summer",
    destinationCity: "Montreal",
    destinationCountry: "Canada",
    startDate: new Date("2024-07-20"),
    endDate: new Date("2024-07-27"),
    saves: [
      { day: 1, title: "Old Montreal Cobblestone Walk", desc: "Notre-Dame Basilica, Place Jacques-Cartier, and waterfront views.", tags: ["history", "culture"] },
      { day: 1, title: "Schwartz's Deli Smoked Meat", desc: "Most famous deli in Canada. Always a line — worth the wait. Get the medium fat.", tags: ["food", "iconic"] },
      { day: 2, title: "Parc du Mont-Royal", desc: "Frederick Law Olmsted's urban mountain park. Belvedere lookout is stunning.", tags: ["nature", "views", "outdoor"] },
      { day: 2, title: "Jean-Talon Market", desc: "Best farmers market in Canada. Quebec cheese, maple syrup, and poutine.", tags: ["food", "market"] },
      { day: 3, title: "Just for Laughs Festival", desc: "World's largest comedy festival runs mid-July. Free outdoor shows for all ages.", tags: ["festival", "entertainment"] },
      { day: 3, title: "Biosphere Museum", desc: "Buckminster Fuller dome turned environment museum. Great for curious kids.", tags: ["science", "family"] },
      { day: 4, title: "Plateau-Mont-Royal Brunch", desc: "Best brunch neighbourhood — Comptoir 21, L'Avenue, and Beautys Luncheonette.", tags: ["food", "neighbourhood"] },
      { day: 4, title: "Biodôme", desc: "Four ecosystems under one roof: tropical, boreal, Laurentian, sub-Arctic.", tags: ["nature", "family", "kids"] },
      { day: 5, title: "Île Sainte-Hélène & La Ronde", desc: "Island amusement park across the St. Lawrence. Great for kids.", tags: ["family", "theme park"] },
      { day: 5, title: "Mile End Bagels at Fairmount", desc: "Wood-fired bagels baked at 4am. Smoked salmon + cream cheese = perfect.", tags: ["food", "breakfast"] },
    ],
  },
  {
    title: "Buenos Aires Cultural Week",
    destinationCity: "Buenos Aires",
    destinationCountry: "Argentina",
    startDate: new Date("2024-09-15"),
    endDate: new Date("2024-09-22"),
    saves: [
      { day: 1, title: "La Boca & Caminito", desc: "Colourful neighbourhood, tango street dancers, and the best bife de chorizo.", tags: ["culture", "art", "food"] },
      { day: 1, title: "Estadio La Bombonera Tour", desc: "Boca Juniors stadium tour — museum, locker rooms, and pitch-side access.", tags: ["sports", "tour"] },
      { day: 2, title: "San Telmo Sunday Market", desc: "Antiques, tango performances, empanadas, and local crafts. Best on Sunday.", tags: ["market", "culture"] },
      { day: 2, title: "MALBA Museum of Latin American Art", desc: "Stunning collection in a modern building. Frida Kahlo, Diego Rivera, and Borges.", tags: ["art", "culture"] },
      { day: 3, title: "Recoleta Cemetery", desc: "Eva Perón's tomb and 14,000 mausoleums. Eerily beautiful and fascinating.", tags: ["history", "culture"] },
      { day: 3, title: "Parrilla Don Julio Steakhouse", desc: "Consistently best asado in the city. Book 2 weeks ahead. Order the tira de ancho.", tags: ["food", "dinner"] },
      { day: 4, title: "Palermo Soho Walking Tour", desc: "Best neighbourhood for cafés, boutiques, and parks. Sunday flea market.", tags: ["neighbourhood", "shopping"] },
      { day: 4, title: "Tango Show — Café de los Angelitos", desc: "Authentic milonga dinner show in a historic café. Book directly for family rate.", tags: ["culture", "music", "dinner"] },
      { day: 5, title: "Tigre Delta Day Trip", desc: "1 hr by Tren de la Costa. Fruit market, wooden boats, and waterway restaurants.", tags: ["day trip", "nature"] },
      { day: 5, title: "Floralis Genérica", desc: "Giant steel flower in Recoleta — opens at dawn, closes at dusk. Photogenic.", tags: ["art", "photo"] },
    ],
  },
  {
    title: "Marrakesh Magic",
    destinationCity: "Marrakesh",
    destinationCountry: "Morocco",
    startDate: new Date("2024-11-01"),
    endDate: new Date("2024-11-08"),
    saves: [
      { day: 1, title: "Djemaa el-Fna Square at Night", desc: "Snake charmers, henna artists, food stalls, and acrobats. Pure sensory overload.", tags: ["culture", "iconic", "food"] },
      { day: 1, title: "Jardin Majorelle", desc: "Yves Saint Laurent's cobalt blue garden. Buy tickets online — sells out.", tags: ["garden", "art", "photo"] },
      { day: 2, title: "Medina Souks Walking Tour", desc: "Spice souk, leather tanneries (Chouara), and the dyers' quarter. Hire a guide.", tags: ["culture", "shopping"] },
      { day: 2, title: "Bahia Palace", desc: "19th-century palace with lush courtyards, carved cedar ceilings, and tile work.", tags: ["history", "architecture"] },
      { day: 3, title: "Atlas Mountains Day Trip", desc: "Imlil village, Berber lunch, and donkey trek to 3,000m. Unforgettable.", tags: ["day trip", "outdoor", "adventure"] },
      { day: 4, title: "Saadian Tombs", desc: "16th-century royal mausoleum — only rediscovered in 1917. Exquisite detail.", tags: ["history", "culture"] },
      { day: 4, title: "Cooking Class in a Riad", desc: "Morning spice market, then cook tagine and couscous with a local family.", tags: ["food", "activity", "culture"] },
      { day: 5, title: "Hammam Dar el-Bacha", desc: "Historic royal bathhouse — exfoliating scrub, steam room, mint tea after.", tags: ["wellness", "culture"] },
      { day: 5, title: "Le Jardin Restaurant", desc: "Hidden garden restaurant in the medina — best pastilla and chicken tagine.", tags: ["food", "dinner"] },
      { day: 6, title: "Essaouira Day Trip", desc: "2.5 hrs west by shared taxi. UNESCO port city, wind surfers, and fresh grilled fish.", tags: ["day trip", "beach", "culture"] },
    ],
  },
];

// ── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  // Need a familyProfileId — use the first profile, or create a system one
  let profile = await db.familyProfile.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!profile) {
    console.error("No family profiles found. Run the app and complete onboarding first.");
    return;
  }

  console.log(`Seeding template trips under profile: ${profile.id} (${profile.familyName})`);

  for (const template of TEMPLATES) {
    // Skip if already seeded
    const existing = await db.trip.findFirst({
      where: { familyProfileId: profile.id, title: template.title },
    });
    if (existing) {
      console.log(`  SKIP: "${template.title}" already exists`);
      continue;
    }

    const trip = await db.trip.create({
      data: {
        familyProfileId: profile.id,
        title: template.title,
        destinationCity: template.destinationCity,
        destinationCountry: template.destinationCountry,
        startDate: template.startDate,
        endDate: template.endDate,
        status: "COMPLETED",
        privacy: "PUBLIC",
        savedItems: {
          create: template.saves.map((s) => ({
            familyProfileId: profile!.id,
            sourceType: "MANUAL",
            rawTitle: s.title,
            rawDescription: s.desc,
            extractionStatus: "ENRICHED",
            status: "TRIP_ASSIGNED",
            categoryTags: normalizeAndDedupeCategoryTags(s.tags),
            dayIndex: s.day,
            destinationCity: template.destinationCity,
            destinationCountry: template.destinationCountry,
            isBooked: true,
            bookedAt: new Date(),
          })),
        },
      },
    });

    console.log(`  CREATED: "${template.title}" → ${trip.id}`);
  }

  console.log("\nDone. 10 template trips seeded.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
