// scripts/data/curated-cities.ts
//
// Curated top 150 globally-relevant travel cities for families.
// Used by scripts/backfill-curated-city-photos.mjs to populate City.priorityRank
// and City.heroPhotoUrl / City.heroPhotoAttribution.
//
// V2 (May 10) — DB-spelling corrections applied per pre-check audit.
// 12 entries corrected for accents, country names, and DB-canonical spellings.
// 35 entries with no DB match are retained — they will skip cleanly during run
// and are tracked for seeding in a follow-up workstream.

export interface CuratedCity {
  name: string;
  country: string;
  priorityRank: number;
  unsplashKeyword: string;
}

export const CURATED_CITIES: CuratedCity[] = [
  // ============ TIER 1: ICONIC GLOBAL DESTINATIONS (1-30) ============
  { name: "Paris", country: "France", priorityRank: 1, unsplashKeyword: "Paris Eiffel Tower Seine" },
  { name: "Rome", country: "Italy", priorityRank: 2, unsplashKeyword: "Rome Colosseum sunset" },
  { name: "London", country: "United Kingdom", priorityRank: 3, unsplashKeyword: "London Tower Bridge Thames" },
  { name: "New York City", country: "United States", priorityRank: 4, unsplashKeyword: "New York skyline Brooklyn Bridge" }, // FIXED
  { name: "Barcelona", country: "Spain", priorityRank: 5, unsplashKeyword: "Barcelona Sagrada Familia Park Guell" },
  { name: "Tokyo", country: "Japan", priorityRank: 6, unsplashKeyword: "Tokyo Mount Fuji skyline" },
  { name: "Venice", country: "Italy", priorityRank: 7, unsplashKeyword: "Venice Grand Canal gondola" }, // No DB match
  { name: "Florence", country: "Italy", priorityRank: 8, unsplashKeyword: "Florence Duomo Tuscany" }, // No DB match
  { name: "Amsterdam", country: "Netherlands", priorityRank: 9, unsplashKeyword: "Amsterdam canals architecture" },
  { name: "Prague", country: "Czech Republic", priorityRank: 10, unsplashKeyword: "Prague Charles Bridge castle" },
  { name: "Kyoto", country: "Japan", priorityRank: 11, unsplashKeyword: "Kyoto Fushimi Inari torii gates" },
  { name: "Sydney", country: "Australia", priorityRank: 12, unsplashKeyword: "Sydney Opera House Harbour Bridge" },
  { name: "Santorini", country: "Greece", priorityRank: 13, unsplashKeyword: "Santorini Oia blue domes sunset" },
  { name: "Reykjavík", country: "Iceland", priorityRank: 14, unsplashKeyword: "Reykjavik Hallgrimskirkja mountains" }, // FIXED accent
  { name: "Cusco", country: "Peru", priorityRank: 15, unsplashKeyword: "Machu Picchu sunrise Andes" },
  { name: "Marrakesh", country: "Morocco", priorityRank: 16, unsplashKeyword: "Marrakesh medina Atlas mountains" },
  { name: "Cape Town", country: "South Africa", priorityRank: 17, unsplashKeyword: "Cape Town Table Mountain harbor" },
  { name: "Dubai", country: "United Arab Emirates", priorityRank: 18, unsplashKeyword: "Dubai Burj Khalifa Marina" },
  { name: "Singapore", country: "Singapore", priorityRank: 19, unsplashKeyword: "Singapore Marina Bay Sands skyline" },
  { name: "Bangkok", country: "Thailand", priorityRank: 20, unsplashKeyword: "Bangkok Wat Arun temple river" },
  { name: "Istanbul", country: "Turkey", priorityRank: 21, unsplashKeyword: "Istanbul Hagia Sophia Bosphorus" },
  { name: "Petra", country: "Jordan", priorityRank: 22, unsplashKeyword: "Petra Treasury rose city Jordan" }, // No DB match
  { name: "Cairo", country: "Egypt", priorityRank: 23, unsplashKeyword: "Cairo Pyramids Giza Sphinx" },
  { name: "Rio de Janeiro", country: "Brazil", priorityRank: 24, unsplashKeyword: "Rio de Janeiro Christ Redeemer Sugarloaf" },
  { name: "Buenos Aires", country: "Argentina", priorityRank: 25, unsplashKeyword: "Buenos Aires La Boca colorful" },
  { name: "Hong Kong", country: "China", priorityRank: 26, unsplashKeyword: "Hong Kong Victoria Harbor skyline" },
  { name: "Edinburgh", country: "Scotland", priorityRank: 27, unsplashKeyword: "Edinburgh Castle Royal Mile" }, // FIXED country
  { name: "Dubrovnik", country: "Croatia", priorityRank: 28, unsplashKeyword: "Dubrovnik old city walls Adriatic" },
  { name: "Lisbon", country: "Portugal", priorityRank: 29, unsplashKeyword: "Lisbon Tram 28 Alfama" },
  { name: "Vienna", country: "Austria", priorityRank: 30, unsplashKeyword: "Vienna Schonbrunn palace" },

  // ============ TIER 2: MAJOR DESTINATIONS (31-70) ============
  { name: "Athens", country: "Greece", priorityRank: 31, unsplashKeyword: "Athens Acropolis Parthenon" },
  { name: "Chiang Mai", country: "Thailand", priorityRank: 32, unsplashKeyword: "Chiang Mai temples mountains" },
  { name: "Siem Reap", country: "Cambodia", priorityRank: 33, unsplashKeyword: "Siem Reap Angkor Wat sunrise" }, // No DB match
  { name: "Madrid", country: "Spain", priorityRank: 34, unsplashKeyword: "Madrid Plaza Mayor Retiro" },
  { name: "Berlin", country: "Germany", priorityRank: 35, unsplashKeyword: "Berlin Brandenburg Gate" },
  { name: "Munich", country: "Germany", priorityRank: 36, unsplashKeyword: "Munich Bavaria Marienplatz" },
  { name: "Budapest", country: "Hungary", priorityRank: 37, unsplashKeyword: "Budapest Parliament Danube" },
  { name: "Copenhagen", country: "Denmark", priorityRank: 38, unsplashKeyword: "Copenhagen Nyhavn colorful houses" },
  { name: "Stockholm", country: "Sweden", priorityRank: 39, unsplashKeyword: "Stockholm Gamla Stan archipelago" },
  { name: "Dublin", country: "Ireland", priorityRank: 40, unsplashKeyword: "Dublin Trinity College Ha'penny Bridge" },
  { name: "Mexico City", country: "Mexico", priorityRank: 41, unsplashKeyword: "Mexico City Zocalo cathedral" },
  { name: "Havana", country: "Cuba", priorityRank: 42, unsplashKeyword: "Havana classic cars Malecon" },
  { name: "Cartagena", country: "Colombia", priorityRank: 43, unsplashKeyword: "Cartagena old city colonial" },
  { name: "Galápagos", country: "Ecuador", priorityRank: 44, unsplashKeyword: "Galapagos islands wildlife" }, // No DB match
  { name: "Lima", country: "Peru", priorityRank: 45, unsplashKeyword: "Lima coastline Miraflores cliffs" },
  { name: "Seoul", country: "South Korea", priorityRank: 46, unsplashKeyword: "Seoul Gyeongbokgung palace" },
  { name: "Beijing", country: "China", priorityRank: 47, unsplashKeyword: "Beijing Forbidden City Great Wall" },
  { name: "Shanghai", country: "China", priorityRank: 48, unsplashKeyword: "Shanghai Bund skyline night" },
  { name: "Mumbai", country: "India", priorityRank: 49, unsplashKeyword: "Mumbai Gateway India Marine Drive" },
  { name: "Agra", country: "India", priorityRank: 50, unsplashKeyword: "Agra Taj Mahal sunrise" },
  { name: "Jaipur", country: "India", priorityRank: 51, unsplashKeyword: "Jaipur Hawa Mahal pink city" },
  { name: "Bali", country: "Indonesia", priorityRank: 52, unsplashKeyword: "Bali Ubud rice terraces temple" }, // No DB match
  { name: "Hanoi", country: "Vietnam", priorityRank: 53, unsplashKeyword: "Hanoi old quarter Hoan Kiem" },
  { name: "Hoi An", country: "Vietnam", priorityRank: 54, unsplashKeyword: "Hoi An lanterns old town" },
  { name: "Phuket", country: "Thailand", priorityRank: 55, unsplashKeyword: "Phuket beach long-tail boats" },
  { name: "Krabi", country: "Thailand", priorityRank: 56, unsplashKeyword: "Krabi limestone cliffs Railay" }, // No DB match
  { name: "Honolulu", country: "United States", priorityRank: 57, unsplashKeyword: "Honolulu Diamond Head Waikiki" }, // No DB match
  { name: "Bora Bora", country: "France", priorityRank: 58, unsplashKeyword: "Bora Bora overwater bungalow lagoon" }, // FIXED country
  { name: "Auckland", country: "New Zealand", priorityRank: 59, unsplashKeyword: "Auckland Sky Tower harbor" },
  { name: "Queenstown", country: "New Zealand", priorityRank: 60, unsplashKeyword: "Queenstown Lake Wakatipu mountains" },
  { name: "San Francisco", country: "United States", priorityRank: 61, unsplashKeyword: "San Francisco Golden Gate Bridge" }, // No DB match
  { name: "Los Angeles", country: "United States", priorityRank: 62, unsplashKeyword: "Los Angeles palm trees skyline" },
  { name: "Chicago", country: "United States", priorityRank: 63, unsplashKeyword: "Chicago skyline Cloud Gate Bean" },
  { name: "Las Vegas", country: "United States", priorityRank: 64, unsplashKeyword: "Las Vegas Strip night neon" }, // No DB match
  { name: "Miami", country: "United States", priorityRank: 65, unsplashKeyword: "Miami Beach Art Deco ocean" }, // No DB match
  { name: "New Orleans", country: "United States", priorityRank: 66, unsplashKeyword: "New Orleans French Quarter balcony" }, // No DB match
  { name: "Washington", country: "United States", priorityRank: 67, unsplashKeyword: "Washington DC Capitol cherry blossoms" },
  { name: "Boston", country: "United States", priorityRank: 68, unsplashKeyword: "Boston historic skyline Charles River" }, // No DB match
  { name: "Seattle", country: "United States", priorityRank: 69, unsplashKeyword: "Seattle Space Needle Mount Rainier" }, // No DB match
  { name: "Vancouver", country: "Canada", priorityRank: 70, unsplashKeyword: "Vancouver skyline mountains harbor" }, // No DB match

  // ============ TIER 3: STRONG REGIONAL DESTINATIONS (71-110) ============
  { name: "Toronto", country: "Canada", priorityRank: 71, unsplashKeyword: "Toronto CN Tower skyline" },
  { name: "Montréal", country: "Canada", priorityRank: 72, unsplashKeyword: "Montreal Old Port Notre-Dame" }, // FIXED accent
  { name: "Quebec City", country: "Canada", priorityRank: 73, unsplashKeyword: "Quebec City Chateau Frontenac old town" }, // No DB match
  { name: "Antigua", country: "Guatemala", priorityRank: 74, unsplashKeyword: "Antigua Guatemala volcano arch" }, // FIXED name
  { name: "Tulum", country: "Mexico", priorityRank: 75, unsplashKeyword: "Tulum Mayan ruins beach" },
  { name: "Cancún", country: "Mexico", priorityRank: 76, unsplashKeyword: "Cancun beach turquoise Caribbean" }, // No DB match
  { name: "Panama City", country: "Panama", priorityRank: 77, unsplashKeyword: "Panama City skyline Casco Viejo" },
  { name: "San José", country: "Costa Rica", priorityRank: 78, unsplashKeyword: "Costa Rica rainforest cloud forest" }, // FIXED accent
  { name: "Quito", country: "Ecuador", priorityRank: 79, unsplashKeyword: "Quito old town Andes Pichincha" },
  { name: "Santiago", country: "Chile", priorityRank: 80, unsplashKeyword: "Santiago Andes mountains Chile" },
  { name: "Bogotá", country: "Colombia", priorityRank: 81, unsplashKeyword: "Bogota Monserrate mountains" }, // FIXED accent
  { name: "Puerto Iguazú", country: "Argentina", priorityRank: 82, unsplashKeyword: "Iguazu Falls waterfall jungle" }, // FIXED name
  { name: "Salvador", country: "Brazil", priorityRank: 83, unsplashKeyword: "Salvador Bahia Pelourinho colorful" },
  { name: "Milan", country: "Italy", priorityRank: 84, unsplashKeyword: "Milan Duomo cathedral piazza" },
  { name: "Naples", country: "Italy", priorityRank: 85, unsplashKeyword: "Naples Vesuvius bay" },
  { name: "Seville", country: "Spain", priorityRank: 86, unsplashKeyword: "Seville Plaza España Alcázar" }, // No DB match
  { name: "Granada", country: "Spain", priorityRank: 87, unsplashKeyword: "Granada Alhambra palace Andalusia" }, // No DB match
  { name: "Porto", country: "Portugal", priorityRank: 88, unsplashKeyword: "Porto Douro River bridges" }, // No DB match
  { name: "Sintra", country: "Portugal", priorityRank: 89, unsplashKeyword: "Sintra Pena Palace Portugal" },
  { name: "Salzburg", country: "Austria", priorityRank: 90, unsplashKeyword: "Salzburg fortress mountains old town" },
  { name: "Innsbruck", country: "Austria", priorityRank: 91, unsplashKeyword: "Innsbruck alps mountain town" },
  { name: "Zermatt", country: "Switzerland", priorityRank: 92, unsplashKeyword: "Zermatt Matterhorn Switzerland" },
  { name: "Lucerne", country: "Switzerland", priorityRank: 93, unsplashKeyword: "Lucerne Chapel Bridge mountains" },
  { name: "Mykonos", country: "Greece", priorityRank: 94, unsplashKeyword: "Mykonos windmills harbor" },
  { name: "Bruges", country: "Belgium", priorityRank: 95, unsplashKeyword: "Bruges medieval canals" },
  { name: "Krakow", country: "Poland", priorityRank: 96, unsplashKeyword: "Krakow main square medieval cathedral" }, // No DB match
  { name: "Tallinn", country: "Estonia", priorityRank: 97, unsplashKeyword: "Tallinn old town medieval towers" },
  { name: "Bergen", country: "Norway", priorityRank: 98, unsplashKeyword: "Bergen Norway harbor wooden houses" }, // No DB match
  { name: "Oslo", country: "Norway", priorityRank: 99, unsplashKeyword: "Oslo Opera House fjord" },
  { name: "Tromsø", country: "Norway", priorityRank: 100, unsplashKeyword: "Tromso northern lights Norway" }, // FIXED accent
  { name: "Helsinki", country: "Finland", priorityRank: 101, unsplashKeyword: "Helsinki Senate Square cathedral" },
  { name: "Fes", country: "Morocco", priorityRank: 102, unsplashKeyword: "Fez medina tannery old city" }, // FIXED romanization
  { name: "Wadi Rum", country: "Jordan", priorityRank: 103, unsplashKeyword: "Wadi Rum desert valley red rock" },
  { name: "Abu Dhabi", country: "United Arab Emirates", priorityRank: 104, unsplashKeyword: "Abu Dhabi Sheikh Zayed Mosque" },
  { name: "Doha", country: "Qatar", priorityRank: 105, unsplashKeyword: "Doha skyline corniche" },
  { name: "Muscat", country: "Oman", priorityRank: 106, unsplashKeyword: "Muscat sultan palace coast" },
  { name: "Jerusalem", country: "Israel", priorityRank: 107, unsplashKeyword: "Jerusalem Old City Western Wall" },
  { name: "Tel Aviv", country: "Israel", priorityRank: 108, unsplashKeyword: "Tel Aviv Mediterranean coastline" }, // No DB match
  { name: "Stone Town", country: "Tanzania", priorityRank: 109, unsplashKeyword: "Stone Town Zanzibar architecture" }, // No DB match
  { name: "Nairobi", country: "Kenya", priorityRank: 110, unsplashKeyword: "Nairobi Kenya safari giraffe" },

  // ============ TIER 4: SPECIALTY + GATEWAY DESTINATIONS (111-150) ============
  { name: "Osaka", country: "Japan", priorityRank: 111, unsplashKeyword: "Osaka castle cherry blossom" },
  { name: "Hiroshima", country: "Japan", priorityRank: 112, unsplashKeyword: "Hiroshima Peace Memorial dome" },
  { name: "Busan", country: "South Korea", priorityRank: 113, unsplashKeyword: "Busan Gamcheon village beach" },
  { name: "Ho Chi Minh City", country: "Vietnam", priorityRank: 114, unsplashKeyword: "Ho Chi Minh City Saigon notre dame" },
  { name: "Ha Long", country: "Vietnam", priorityRank: 115, unsplashKeyword: "Halong Bay limestone karst" },
  { name: "Luang Prabang", country: "Laos", priorityRank: 116, unsplashKeyword: "Luang Prabang temples Mekong monks" },
  { name: "Yangon", country: "Myanmar", priorityRank: 117, unsplashKeyword: "Yangon Shwedagon Pagoda" },
  { name: "Bagan", country: "Myanmar", priorityRank: 118, unsplashKeyword: "Bagan temples sunrise balloon" },
  { name: "Kathmandu", country: "Nepal", priorityRank: 119, unsplashKeyword: "Kathmandu Boudhanath stupa" },
  { name: "Pokhara", country: "Nepal", priorityRank: 120, unsplashKeyword: "Pokhara lake Annapurna mountains" },
  { name: "New Delhi", country: "India", priorityRank: 121, unsplashKeyword: "Delhi India Gate Red Fort" },
  { name: "Colombo", country: "Sri Lanka", priorityRank: 122, unsplashKeyword: "Colombo coast Sri Lanka temple" },
  { name: "Galle", country: "Sri Lanka", priorityRank: 123, unsplashKeyword: "Galle fort lighthouse Sri Lanka" },
  { name: "Samarkand", country: "Uzbekistan", priorityRank: 124, unsplashKeyword: "Samarkand Registan Uzbekistan" }, // No DB match
  { name: "Bukhara", country: "Uzbekistan", priorityRank: 125, unsplashKeyword: "Bukhara silk road architecture" }, // No DB match
  { name: "Aswan", country: "Egypt", priorityRank: 126, unsplashKeyword: "Aswan Nile felucca temple" },
  { name: "Luxor", country: "Egypt", priorityRank: 127, unsplashKeyword: "Luxor Karnak temple columns" },
  { name: "Melbourne", country: "Australia", priorityRank: 128, unsplashKeyword: "Melbourne laneway street art" },
  { name: "Cairns", country: "Australia", priorityRank: 129, unsplashKeyword: "Cairns Great Barrier Reef rainforest" }, // No DB match
  { name: "Tahiti", country: "France", priorityRank: 130, unsplashKeyword: "Tahiti waterfall mountains lagoon" }, // No DB match; FP under France
  { name: "Anaheim", country: "United States", priorityRank: 131, unsplashKeyword: "Disneyland California castle" }, // No DB match
  { name: "Orlando", country: "United States", priorityRank: 132, unsplashKeyword: "Orlando Disney Magic Kingdom castle" }, // No DB match
  { name: "Nashville", country: "United States", priorityRank: 133, unsplashKeyword: "Nashville Broadway music neon" }, // No DB match
  { name: "Charleston", country: "United States", priorityRank: 134, unsplashKeyword: "Charleston historic Rainbow Row" },
  { name: "San Diego", country: "United States", priorityRank: 135, unsplashKeyword: "San Diego coast La Jolla cove" },
  { name: "Aspen", country: "United States", priorityRank: 136, unsplashKeyword: "Aspen Colorado mountains snow" },
  { name: "Jackson Hole", country: "United States", priorityRank: 137, unsplashKeyword: "Jackson Hole Tetons Wyoming" }, // FIXED name
  { name: "Moab", country: "United States", priorityRank: 138, unsplashKeyword: "Moab Arches Delicate Arch Utah" },
  { name: "Springdale", country: "United States", priorityRank: 139, unsplashKeyword: "Zion National Park canyon Utah" },
  { name: "West Yellowstone", country: "United States", priorityRank: 140, unsplashKeyword: "Yellowstone geyser bison" },
  { name: "Whitefish", country: "United States", priorityRank: 141, unsplashKeyword: "Glacier National Park lake Montana" }, // No DB match
  { name: "Talkeetna", country: "United States", priorityRank: 142, unsplashKeyword: "Denali Alaska mountains" },
  { name: "Estes Park", country: "United States", priorityRank: 143, unsplashKeyword: "Rocky Mountain National Park lake" },
  { name: "Grand Canyon Village", country: "United States", priorityRank: 144, unsplashKeyword: "Grand Canyon South Rim sunset" }, // No DB match
  { name: "Banff", country: "Canada", priorityRank: 145, unsplashKeyword: "Banff Lake Louise Canadian Rockies" },
  { name: "Roatán", country: "Honduras", priorityRank: 146, unsplashKeyword: "Roatan beach Caribbean diving" }, // No DB match
  { name: "Maldives", country: "Maldives", priorityRank: 147, unsplashKeyword: "Maldives overwater bungalow lagoon" }, // No DB match
  { name: "Malé", country: "Maldives", priorityRank: 148, unsplashKeyword: "Male Maldives island aerial" },
  { name: "Marrakech", country: "Morocco", priorityRank: 149, unsplashKeyword: "Marrakech Jemaa el-Fnaa souks" }, // Idempotent fallback for rank 16
  { name: "Reykjavik", country: "Iceland", priorityRank: 150, unsplashKeyword: "Reykjavik Hallgrimskirkja harbor" }, // Idempotent fallback for rank 14
];
