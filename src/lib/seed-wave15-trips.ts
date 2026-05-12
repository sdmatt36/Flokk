import { nanoid } from "nanoid";
import { db } from "@/lib/db";

const DEMO_PROFILE_ID = "cmmemrfz9000004kzgkk26f5f";

interface TripSave {
  day: number;
  title: string;
  desc: string;
  tags: string[];
}

interface TripTemplate {
  title: string;
  destinationCity: string;
  destinationCountry: string;
  startDate: Date;
  endDate: Date;
  saves: TripSave[];
}

const TEMPLATES: TripTemplate[] = [
  {
    title: "Orlando Theme Parks Week",
    destinationCity: "Orlando",
    destinationCountry: "United States",
    startDate: new Date("2024-12-26"),
    endDate: new Date("2024-12-31"),
    saves: [
      { day: 1, title: "Disney's Wilderness Lodge", desc: "Check in to this Pacific Northwest lodge-style resort — the lobby geyser erupts every hour and the boat dock puts Magic Kingdom 10 minutes away by water. Best value on the Disney side for families who want resort atmosphere without the price of the Contemporary.", tags: ["lodging"] },
      { day: 1, title: "Magic Kingdom", desc: "Arrive at rope drop and go straight for Seven Dwarfs Mine Train before the queue triples. Stay for Happily Ever After — the evening fireworks projection show is the best 20 minutes in any theme park.", tags: ["kids_and_family"] },
      { day: 2, title: "EPCOT", desc: "Hit Guardians of the Galaxy: Cosmic Rewind first on the virtual queue, then let the kids lead a lap through the World Showcase eating their way from Mexico to Japan. The Japan pavilion has the best ramen in the park.", tags: ["culture"] },
      { day: 2, title: "Disney's Animal Kingdom", desc: "Book the Kilimanjaro Safari for first thing in the morning — giraffe, rhino, and elephant sightings are best before the heat sets in. Pandora's bioluminescent night glow is the park's most surprising visual.", tags: ["nature_and_outdoors"] },
      { day: 3, title: "Universal Studios Florida", desc: "Sprint to Diagon Alley at park open for Escape from Gringotts before the line forms. The butterbeer (cold, not frozen) is the one family ritual no one skips.", tags: ["adventure"] },
      { day: 3, title: "Islands of Adventure", desc: "Hagrid's Magical Creatures Motorbike Adventure consistently ranks as the best theme park ride on earth — time your visit for late afternoon when the morning crowd thins. Hogsmeade and Jurassic World are right next to each other for an efficient back half.", tags: ["adventure"] },
      { day: 4, title: "Hollywood Studios", desc: "Reserve the Millennium Falcon in Smugglers Run using the boarding group system at park open, then save Star Wars: Rise of the Resistance for afternoon when the virtual queue refreshes. Galaxy's Edge genuinely feels like another planet.", tags: ["kids_and_family"] },
      { day: 4, title: "Gideon's Bakehouse", desc: "The half-pound cookies at this Disney Springs cult shop easily split between two kids. Pull a number on the app and browse Disney Springs while you wait — the cold brew coffee cookie is the parent's reward.", tags: ["food_and_drink"] },
      { day: 5, title: "Discovery Cove", desc: "This all-inclusive reservation-only park covers meals, gear, and the dolphin swim — book the Ray Lagoon add-on for younger kids who can't meet the swim requirements. Unlimited SeaWorld access for 14 days is included in the ticket.", tags: ["experiences"] },
      { day: 5, title: "Winter Park Scenic Boat Tour", desc: "A one-hour pontoon glide through cypress-shaded lakes revealing lakefront mansions and nesting osprey — running since 1938. The perfect low-key wind-down after a week of sensory overload.", tags: ["experiences"] },
    ],
  },
  {
    title: "New York City Family Week",
    destinationCity: "New York City",
    destinationCountry: "United States",
    startDate: new Date("2025-03-10"),
    endDate: new Date("2025-03-15"),
    saves: [
      { day: 1, title: "The Plaza Hotel", desc: "The storybook corner of Central Park South puts families a 3-minute walk from the park and a block from Fifth Avenue — kids who know Eloise find it genuinely magical. Book a high-floor park-view room for the morning light over the trees.", tags: ["lodging"] },
      { day: 1, title: "American Museum of Natural History", desc: "The dinosaur halls and blue whale room alone justify an entire afternoon. Use the free kids' audio guide to turn the ocean life exhibit into a scavenger hunt — the Rose Center planetarium show is worth adding for evening.", tags: ["culture"] },
      { day: 2, title: "Statue of Liberty", desc: "Book crown access months ahead — the narrow staircase is an adventure kids talk about long after. Ferry from Battery Park, and pair with Ellis Island on the way back for a full harbor morning.", tags: ["culture"] },
      { day: 2, title: "Brooklyn Bridge", desc: "Start from the Brooklyn side at DUMBO for the best photo angles of both bridge and skyline. Reward the walk with a slice at Grimaldi's under the bridge or a hand-pulled noodle in nearby Chinatown.", tags: ["experiences"] },
      { day: 2, title: "Katz's Delicatessen", desc: "Open since 1888, the pastrami here is hand-carved to order and portions are so large two kids split one sandwich and still struggle. The ticket system and communal tables are part of the ritual.", tags: ["food_and_drink"] },
      { day: 3, title: "Metropolitan Museum of Art", desc: "The Egyptian Temple of Dendur and the Arms & Armor hall are guaranteed crowd-pleasers for kids who haven't yet found their way into impressionism. The roof garden sculpture installation adds a skyline bonus most visitors miss.", tags: ["culture"] },
      { day: 3, title: "The High Line", desc: "This elevated rail-turned-park stretches 1.45 miles above the West Side with rotating public art and food vendors making the walk feel curated rather than just a stroll. Kids love spotting the city from above street level while parents appreciate the thoughtful design at every turn.", tags: ["nature_and_outdoors"] },
      { day: 4, title: "Coney Island", desc: "The original American amusement destination still delivers with the historic Cyclone, Luna Park rides, and a genuine boardwalk Nathan's hot dog stop. Summer weekends feel like stepping into a postcard from another era.", tags: ["adventure"] },
      { day: 4, title: "Chelsea Market", desc: "Built inside a former Nabisco cookie factory, this indoor market packs tacos, lobster rolls, artisan pizza, and ramen under one industrial-chic roof — the answer when the family can't agree on where to eat. Wide enough for strollers and all vendors are genuinely local.", tags: ["food_and_drink"] },
      { day: 5, title: "Staten Island Ferry", desc: "This completely free 25-minute crossing passes within a quarter mile of the Statue of Liberty — arguably the best free attraction in New York. Kids love the open bow as the skyline shrinks and Lady Liberty appears on the horizon.", tags: ["experiences"] },
    ],
  },
  {
    title: "Rome with Kids",
    destinationCity: "Rome",
    destinationCountry: "Italy",
    startDate: new Date("2025-04-20"),
    endDate: new Date("2025-04-25"),
    saves: [
      { day: 1, title: "Hotel Artemide", desc: "On Via Nazionale with generous family rooms and a rooftop terrace, this four-star puts families within walking distance of the Colosseum and Trevi Fountain. The buffet breakfast is substantial enough to skip a morning café stop.", tags: ["lodging"] },
      { day: 1, title: "Trevi Fountain", desc: "Arrive just after sunrise to see the fountain nearly empty — the coin toss legend (one coin means you'll return to Rome) lands differently with an empty piazza around you. Book the underground aqueduct tour beneath for an extra level of history.", tags: ["culture"] },
      { day: 1, title: "Pantheon", desc: "The 2,000-year-old temple with its open oculus is one of Rome's most mind-bending sights — when it rains, water falls straight through and drains via the ancient floor. Entry requires a timed ticket now; book ahead and allow time to linger in the piazza outside.", tags: ["culture"] },
      { day: 2, title: "Colosseum", desc: "Book skip-the-line family tickets with underground and arena-floor access — standing where gladiators fought at ground level is completely different from the standard tier. The combo ticket covers the Roman Forum and Palatine Hill, so plan a full day for all three.", tags: ["culture"] },
      { day: 2, title: "Roman Forum", desc: "Walking through the civic heart of the ancient empire alongside the Palatine Hill gives kids a sense of how vast Rome actually was. Bring water and hats in spring — the site is almost entirely exposed.", tags: ["culture"] },
      { day: 3, title: "Vatican Museums", desc: "Pre-book a guided family tour designed for kids — the stories make the Sistine Chapel click in a way that date-and-artist wall labels never will. Early access slots are worth every extra euro to avoid the crowd that builds by mid-morning.", tags: ["culture"] },
      { day: 3, title: "Castel Sant'Angelo", desc: "The cylindrical fortress built as Hadrian's mausoleum feels like a real-life adventure game as families wind up the spiral ramp through dungeons, papal apartments, and onto a rooftop terrace with panoramic views of Rome. The kid-friendly audioguide turns the history into stories.", tags: ["culture"] },
      { day: 3, title: "Pizzarium Bonci", desc: "Chef Bonci's al-taglio shop near the Vatican serves thick-crust pizza by weight with creative toppings — even the pickiest kids fall for the classic margherita here. Standing room and grab-and-go, so it's a fast, exceptional lunch between Vatican and the castle.", tags: ["food_and_drink"] },
      { day: 4, title: "Borghese Gallery", desc: "Bernini's sculptures look like frozen motion and the strictly timed entry keeps groups small enough that children can actually get close. Combine with a long play session in the surrounding Villa Borghese park to balance art with outdoor energy.", tags: ["culture"] },
      { day: 4, title: "Trastevere", desc: "Rome's most atmospheric neighbourhood weaves golden-lit medieval lanes, ivy-draped buildings, and some of the city's most honest trattorias into an evening families won't forget. The neighbourhood is compact, pedestrian-friendly, and safe for kids to wander while parents linger over cacio e pepe.", tags: ["culture"] },
    ],
  },
  {
    title: "Banff Family Adventure",
    destinationCity: "Banff",
    destinationCountry: "Canada",
    startDate: new Date("2025-07-14"),
    endDate: new Date("2025-07-18"),
    saves: [
      { day: 1, title: "Fairmont Banff Springs", desc: "The 'Castle in the Rockies' sets the tone the moment families walk in — kids explore stone corridors while parents plan tomorrow's hike from the spa. Book the family suite with mountain views and arrive early enough for a Bow Falls walk before dinner.", tags: ["lodging"] },
      { day: 1, title: "Vermilion Lakes", desc: "Just minutes from downtown Banff, these shallow lakes are the best wildlife-watching spot in the park — elk, beavers, and great blue herons are regularly seen from roadside pullouts. At sunset the still water mirrors the surrounding peaks in shades of pink and gold.", tags: ["nature_and_outdoors"] },
      { day: 1, title: "Bear Street Tavern", desc: "Family-friendly wood-fired pizzas in the heart of Banff, consistently ranked among the best in town and generous enough to satisfy post-hike appetites. The atmosphere is relaxed enough for tired children without any of the tourist-trap pricing.", tags: ["food_and_drink"] },
      { day: 2, title: "Lake Louise", desc: "The famously turquoise glacial lake is one of Canada's most iconic sights and kids are often left speechless by the vivid color. Rent a canoe in summer — arrive before 8am via the Parks Canada shuttle to beat the crowds and get first pick of boats.", tags: ["nature_and_outdoors"] },
      { day: 2, title: "Moraine Lake", desc: "Nestled in the Valley of the Ten Peaks, Moraine Lake's impossibly blue water and rocky amphitheater make it feel like stepping inside a postcard. Let kids scramble the nearby rockpile for a sweeping panoramic view that rewards the 10-minute climb.", tags: ["nature_and_outdoors"] },
      { day: 3, title: "Banff Gondola", desc: "The 8-minute gondola ride reaches the summit of Sulphur Mountain at 2,281 metres, where an enclosed interpretive boardwalk makes the alpine environment accessible for all ages. Kids love spotting bighorn sheep along the ridge while adults soak in 360-degree views of six mountain ranges.", tags: ["experiences"] },
      { day: 3, title: "Johnston Canyon", desc: "Catwalk-style metal walkways bolted into the canyon walls lead families past rushing waterfalls and limestone formations. The Lower Falls are an easy 1.1 km walk for young children; the Upper Falls add a rewarding extra kilometre for older kids.", tags: ["nature_and_outdoors"] },
      { day: 3, title: "Banff Upper Hot Springs", desc: "Soaking in mineral-rich pools at 1,585 metres with Sulphur Mountain rising directly above is the perfect reward after a full day on the trails. Children aged three and up are welcome, and the warm 37–40°C water soothes trail-weary legs for everyone.", tags: ["wellness"] },
      { day: 4, title: "Lake Minnewanka", desc: "The largest lake in Banff National Park offers boat cruises, kayak rentals, and one of the few fishing spots in the park, making it a full-day family playground. The 90-minute interpretive cruise tells the story of the submerged ghost town beneath the surface — kids love this detail.", tags: ["nature_and_outdoors"] },
      { day: 4, title: "Wild Flour Bakery", desc: "This beloved local bakery turns out enormous cinnamon buns and fresh-baked sourdough that families line up for on weekend mornings before hitting the trails. The perfect pre-hike fuel stop to end a Banff week on a sweet, slow note.", tags: ["food_and_drink"] },
    ],
  },
  {
    title: "Iceland Family Adventure",
    destinationCity: "Reykjavík",
    destinationCountry: "Iceland",
    startDate: new Date("2025-06-21"),
    endDate: new Date("2025-06-25"),
    saves: [
      { day: 1, title: "Icelandair Hotel Reykjavik Marina", desc: "Housed in a converted boat warehouse right on the Old Harbour, this design-forward hotel puts families within walking distance of whale-watching piers, Harpa, and the best fish-and-chips in the city. The nautical industrial décor makes kids feel like they're on an expedition from the moment they arrive.", tags: ["lodging"] },
      { day: 1, title: "Hallgrímskirkja", desc: "Reykjavík's volcanic-basalt-inspired church towers over the city at 74 metres and is the first landmark kids spot on the skyline. Take the lift to the observation tower for sweeping 360-degree views of colourful rooftops and distant mountains.", tags: ["culture"] },
      { day: 1, title: "Harpa Concert Hall", desc: "Harpa's honeycomb glass façade reflecting the harbour is one of the most photographed buildings in Iceland, and the interior geometry is just as striking for architecturally curious kids. The building hosts free lobby events and the gift shop carries quality Icelandic design.", tags: ["culture"] },
      { day: 1, title: "Sandholt Bakery", desc: "This beloved Laugavegur bakery has been run by the same family for three generations and produces some of Iceland's best sourdough, pastries, and open-faced sandwiches. Grab a cinnamon roll and hot cocoa for the kids before a morning of sightseeing — the queue moves fast.", tags: ["food_and_drink"] },
      { day: 2, title: "Golden Circle Day Tour", desc: "This iconic loop connects Þingvellir (tectonic plates), the Geysir geothermal field, and Gullfoss waterfall in one unforgettable day — kids lose their minds watching Strokkur erupt every few minutes. Book a guided family tour so the geology and Viking history actually land with younger travellers.", tags: ["experiences"] },
      { day: 3, title: "Blue Lagoon", desc: "Iceland's famous milky-blue geothermal spa sits in the middle of a lava field and stays a soothing 37–39°C year-round. Children 2 and under enter free, and the silica mud masks are a genuine hit with kids who enjoy getting gloriously messy.", tags: ["wellness"] },
      { day: 3, title: "Whale Watching Tour Reykjavik", desc: "Boats depart right from the Old Harbour and regularly spot minke whales, humpbacks, and harbour porpoises in Faxaflói Bay. Most operators provide warm overalls so even small kids stay toasty on the water — book the afternoon sailing for best light.", tags: ["nature_and_outdoors"] },
      { day: 3, title: "Matur og Drykkur", desc: "Chef Gísli Matthías Auðunsson reinvents old Icelandic recipes in a beautifully converted building in the Old Harbour district. The menu is adventurous enough for foodie parents while flavours still land for older kids — reserve ahead.", tags: ["food_and_drink"] },
      { day: 4, title: "Perlan Museum", desc: "Built on massive geothermal hot-water tanks, Perlan houses Iceland's only indoor real-ice glacier tunnel, a planetarium, and interactive natural-history exhibits that make Iceland's forces of nature click for curious kids. The rooftop observation deck adds a panoramic bonus at the end.", tags: ["kids_and_family"] },
      { day: 4, title: "Laugardalslaug", desc: "Reykjavík's largest geothermal swimming complex features a 50-metre outdoor pool, a children's pool, waterslides, and several hot pots of varying temperatures. Entry costs just a few hundred krónur per person — the most affordable family activity in the city and the one locals actually do.", tags: ["kids_and_family"] },
    ],
  },
  {
    title: "Sydney Family Adventure",
    destinationCity: "Sydney",
    destinationCountry: "Australia",
    startDate: new Date("2025-09-28"),
    endDate: new Date("2025-10-03"),
    saves: [
      { day: 1, title: "Nickelodeon Hotels & Resorts Sydney (Novotel Sydney on Darling Harbour)", desc: "Overlooking Darling Harbour with the aquarium and playgrounds a two-minute walk away, this family-configured hotel offers interconnecting rooms, a rooftop pool, and kids' club programming during school holidays. The Saturday night harbour fireworks are visible from the balcony.", tags: ["lodging"] },
      { day: 1, title: "SEA LIFE Sydney Aquarium", desc: "Walk through underwater tunnels as sharks and rays glide overhead in one of the Southern Hemisphere's largest aquariums, home to dugongs, penguins, and a Great Barrier Reef exhibit. Daily feeding sessions and touch pools keep children engaged for a full half-day.", tags: ["kids_and_family"] },
      { day: 2, title: "Sydney Opera House", desc: "The forecourt and harbour views alone make for a memorable afternoon, but the dedicated family tours and children's performances throughout the year make a ticketed visit worth it. Book the Backstage Tour with older kids — seeing the construction details behind the shells is genuinely mind-bending.", tags: ["culture"] },
      { day: 2, title: "Manly Ferry", desc: "The 30-minute public ferry from Circular Quay passes the Opera House, Harbour Bridge, and dozens of secluded coves — one of the world's great harbour rides for the price of a bus ticket. Kids love sitting on the open upper deck as the ocean swell kicks in near the Heads.", tags: ["experiences"] },
      { day: 2, title: "Pancakes on the Rocks", desc: "A Sydney institution since 1975, this 24-hour diner in The Rocks piles towers of sweet and savoury pancakes in a cosy heritage sandstone setting kids absolutely love. The perfect post-harbour-walk fuel stop that famously never turns a family away at any hour.", tags: ["food_and_drink"] },
      { day: 3, title: "Taronga Zoo", desc: "Over 4,000 animals including koalas and platypuses with a sky safari cable car offering sweeping views of the Sydney skyline. Kids can hand-feed giraffes and catch keeper talks throughout the day — arrive by ferry from Circular Quay for the full experience.", tags: ["kids_and_family"] },
      { day: 3, title: "The Rocks Markets", desc: "Every Saturday and Sunday, Sydney's oldest neighbourhood fills with 150-plus stalls selling handmade jewellery, Indigenous art, vintage finds, and freshly cooked street food beneath the Harbour Bridge. Kids enjoy the buskers and free face-painting that regularly pop up between the cobblestone laneways.", tags: ["shopping"] },
      { day: 4, title: "Blue Mountains National Park", desc: "Just 90 minutes from Sydney, this UNESCO World Heritage wilderness features the famous Three Sisters and the world's steepest railway at Scenic World. Echo Point lookout delivers jaw-dropping valley views that genuinely stop kids mid-sentence — go on a weekday morning to avoid weekend crowds.", tags: ["nature_and_outdoors"] },
      { day: 4, title: "Featherdale Wildlife Park", desc: "This intimate Western Sydney sanctuary lets families hand-feed kangaroos freely roaming the grounds and get a photo cuddling a koala — one of the few places in NSW where this is still permitted. The park's small scale means animals are always within arm's reach, not behind distant fences.", tags: ["kids_and_family"] },
      { day: 5, title: "Bondi to Coogee Coastal Walk", desc: "This 6km clifftop trail connects six stunning beaches with ocean rock pools perfect for little ones to splash in — mostly paved and pushchair-friendly for much of its length. Start at Bondi early and work south, finishing with a swim and fish and chips at Coogee.", tags: ["nature_and_outdoors"] },
    ],
  },
  {
    title: "Cape Town Family Week",
    destinationCity: "Cape Town",
    destinationCountry: "South Africa",
    startDate: new Date("2025-07-26"),
    endDate: new Date("2025-07-31"),
    saves: [
      { day: 1, title: "The Silo Hotel", desc: "Perched above the Zeitz Museum in a converted grain silo on the V&A Waterfront, the bulging porthole windows and rooftop pool views feel surreal from the moment you arrive. The aquarium, harbour seals, and restaurants are all within a five-minute walk for families.", tags: ["lodging"] },
      { day: 1, title: "V&A Waterfront", desc: "Cape Town's iconic working harbour combines hundreds of shops, restaurants, street performers, and boat trips in one walkable precinct. Families can graze at the Market on the Wharf, catch a harbour seal lazing on the jetties, and easily fill an entire day.", tags: ["shopping"] },
      { day: 1, title: "Two Oceans Aquarium", desc: "Right on the V&A Waterfront, this world-class aquarium lets kids touch sea creatures in the touch pool and watch ragged-tooth sharks glide overhead through the kelp forest tunnel. Daily penguin and turtle feeding presentations are timed perfectly for younger attention spans.", tags: ["kids_and_family"] },
      { day: 2, title: "Table Mountain Aerial Cableway", desc: "Ride the rotating cable car 1,086 metres to the flat-topped summit for jaw-dropping 360° views over Cape Town and the Atlantic. Kids love spotting rock hyraxes on the plateau — book the first cable car of the day to guarantee clear visibility.", tags: ["adventure"] },
      { day: 2, title: "Kirstenbosch National Botanical Garden", desc: "These world-famous gardens feature a treetop canopy walkway called the Boomslang that gives kids a snake-like aerial view through the forest. Weekends often bring live concerts on the lawn where families picnic on the grass as the mountain glows behind the stage.", tags: ["nature_and_outdoors"] },
      { day: 3, title: "Boulders Beach Penguin Colony", desc: "This sheltered cove near Simon's Town is home to over 3,000 African penguins waddling within arm's reach on the boardwalks. Children are absolutely mesmerised watching the penguins swim, nest, and squabble just metres away — arrive before 10am to beat the tour buses.", tags: ["nature_and_outdoors"] },
      { day: 3, title: "Cape Point", desc: "The dramatic rocky headland at the tip of the Cape Peninsula rewards families with a funicular ride up to the old lighthouse and some of the most theatrical coastal scenery on earth. Keep an eye on your snacks — the resident baboons are bold and surprisingly quick.", tags: ["adventure"] },
      { day: 4, title: "Robben Island", desc: "The ferry across Table Bay delivers families to the island where Nelson Mandela was imprisoned for 18 years, with former political prisoners often leading the tours. It is a profoundly moving history lesson for older children — allow a full morning for the ferry, tour, and return.", tags: ["culture"] },
      { day: 4, title: "Bo-Kaap", desc: "Cape Town's most photogenic neighbourhood tumbles down Signal Hill in a cascade of candy-coloured houses reflecting the vibrant Cape Malay heritage of its residents. Join a cooking class to make bobotie or koeksisters, and photograph what may be the most colourful street in Africa.", tags: ["culture"] },
      { day: 5, title: "Signal Hill & Lion's Head Sunrise Hike", desc: "The circular hike up Lion's Head uses chains and ladders near the summit for a panoramic view stretching from Table Mountain to Robben Island — early morning starts with kids feel like a real expedition. The flat Signal Hill road offers easy walks for younger families who want the views without the scramble.", tags: ["adventure"] },
    ],
  },
];

export interface Wave15Result {
  citySlug: string;
  tripId: string | null;
  tripTitle: string;
  totalDays: number;
  picksReferenced: number;
  skipped: boolean;
  skipReason?: string;
  errors: string[];
}

export async function seedWave15Trips(): Promise<Wave15Result[]> {
  const results: Wave15Result[] = [];

  for (const template of TEMPLATES) {
    const result: Wave15Result = {
      citySlug: template.destinationCity.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      tripId: null,
      tripTitle: template.title,
      totalDays: Math.max(...template.saves.map((s) => s.day)),
      picksReferenced: template.saves.length,
      skipped: false,
      errors: [],
    };

    try {
      const existing = await db.trip.findFirst({
        where: { familyProfileId: DEMO_PROFILE_ID, destinationCity: template.destinationCity, isFlokkerExample: true },
        select: { id: true },
      });

      if (existing) {
        result.skipped = true;
        result.skipReason = "trip already exists";
        result.tripId = existing.id;
        results.push(result);
        console.log(`[wave-1.5] SKIP: "${template.title}" already exists (${existing.id})`);
        continue;
      }

      const trip = await db.trip.create({
        data: {
          familyProfileId: DEMO_PROFILE_ID,
          title: template.title,
          destinationCity: template.destinationCity,
          destinationCountry: template.destinationCountry,
          startDate: template.startDate,
          endDate: template.endDate,
          status: "COMPLETED",
          privacy: "PUBLIC",
          isPublic: true,
          shareToken: nanoid(12),
          isFlokkerExample: true,
          savedItems: {
            create: template.saves.map((s, i) => ({
              familyProfileId: DEMO_PROFILE_ID,
              rawTitle: s.title,
              rawDescription: s.desc,
              sourceMethod: "URL_PASTE",
              extractionStatus: "ENRICHED",
              status: "TRIP_ASSIGNED",
              categoryTags: s.tags,
              dayIndex: s.day,
              sortOrder: i,
              destinationCity: template.destinationCity,
              destinationCountry: template.destinationCountry,
              isBooked: true,
              bookedAt: new Date(),
            })),
          },
        },
        select: { id: true },
      });

      result.tripId = trip.id;
      results.push(result);
      console.log(`[wave-1.5] CREATED: "${template.title}" → ${trip.id} (${template.saves.length} picks across ${result.totalDays} days)`);
    } catch (e) {
      result.errors.push(String(e));
      results.push(result);
      console.error(`[wave-1.5] ERROR: "${template.title}": ${String(e)}`);
    }
  }

  return results;
}
