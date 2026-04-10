import { NextResponse } from "next/server";
import { enrichActivityImage } from "@/lib/activity-intelligence";

const PLACEHOLDER_PICKS = [
  { id: "ph-1", title: "Senso-ji Temple", type: "CULTURE", city: "Tokyo", ratingNotes: "One of Tokyo's most iconic landmarks. Best visited at dawn before the crowds arrive.", websiteUrl: "https://www.senso-ji.jp", fallbackImageUrl: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800" },
  { id: "ph-2", title: "Shibuya Crossing", type: "ACTIVITY", city: "Tokyo", ratingNotes: "The world's busiest pedestrian crossing. Mesmerising at any time of day.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800" },
  { id: "ph-3", title: "Meiji Shrine", type: "CULTURE", city: "Tokyo", ratingNotes: "Peaceful forested shrine in the heart of the city. Best at dawn.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800" },
  { id: "ph-4", title: "Harajuku Takeshita Street", type: "SHOPPING", city: "Tokyo", ratingNotes: "Wild street food and fashion. Kids love the crepes and candy burritos.", websiteUrl: null, fallbackImageUrl: null },
  { id: "ph-5", title: "Tokyo Skytree", type: "ACTIVITY", city: "Tokyo", ratingNotes: "Best views in the city. Book online in advance.", websiteUrl: "https://www.tokyo-skytree.jp", fallbackImageUrl: null },
  { id: "ph-6", title: "teamLab Borderless", type: "FAMILY", city: "Tokyo", ratingNotes: "Unmissable digital art experience. Book well in advance.", websiteUrl: "https://www.teamlab.art", fallbackImageUrl: null },
  { id: "ph-7", title: "Eiffel Tower", type: "CULTURE", city: "Paris", ratingNotes: "Book skip-the-line tickets. Second floor view is the sweet spot.", websiteUrl: "https://www.toureiffel.paris", fallbackImageUrl: null },
  { id: "ph-8", title: "Le Marais District", type: "OUTDOOR", city: "Paris", ratingNotes: "Best neighbourhood to wander. Great falafel on Rue des Rosiers.", websiteUrl: null, fallbackImageUrl: null },
  { id: "ph-9", title: "Musée d'Orsay", type: "CULTURE", city: "Paris", ratingNotes: "More accessible than the Louvre. The Impressionist collection alone is worth it.", websiteUrl: "https://www.musee-orsay.fr", fallbackImageUrl: null },
  { id: "ph-10", title: "Park Güell", type: "OUTDOOR", city: "Barcelona", ratingNotes: "Timed entry required. Kids love the mosaic lizard.", websiteUrl: "https://parkguell.barcelona", fallbackImageUrl: null },
  { id: "ph-11", title: "La Boqueria Market", type: "SHOPPING", city: "Barcelona", ratingNotes: "Go for the atmosphere. Buy from stalls deeper in.", websiteUrl: null, fallbackImageUrl: null },
  { id: "ph-12", title: "Sagrada Familia", type: "CULTURE", city: "Barcelona", ratingNotes: "Book well in advance. Tower tickets sell out weeks ahead.", websiteUrl: "https://sagradafamilia.org", fallbackImageUrl: null },
  { id: "ph-13", title: "Chatuchak Weekend Market", type: "SHOPPING", city: "Bangkok", ratingNotes: "Go early, bring cash. One of the world's largest markets.", websiteUrl: null, fallbackImageUrl: null },
  { id: "ph-14", title: "Wat Pho Temple", type: "CULTURE", city: "Bangkok", ratingNotes: "Home of the giant reclining Buddha.", websiteUrl: null, fallbackImageUrl: null },
  { id: "ph-15", title: "Alfama District Walk", type: "OUTDOOR", city: "Lisbon", ratingNotes: "Cobblestone streets with the best city views. Wear comfortable shoes.", websiteUrl: null, fallbackImageUrl: null },
  { id: "ph-16", title: "Kyoto Bamboo Grove", type: "OUTDOOR", city: "Kyoto", ratingNotes: "Go at 6am before the tour groups arrive.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800" },
  { id: "ph-17", title: "Fushimi Inari Shrine", type: "CULTURE", city: "Kyoto", ratingNotes: "The thousand torii gates. Halfway up is stunning.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800" },
  { id: "ph-18", title: "Nishiki Market", type: "FOOD", city: "Kyoto", ratingNotes: "Kyoto's kitchen. Narrow covered market with incredible street food.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800" },
  { id: "ph-19", title: "Arashiyama Monkey Park", type: "FAMILY", city: "Kyoto", ratingNotes: "Short hike up, monkeys at the top. Kids absolutely love it.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=800" },
  { id: "ph-20", title: "Tower of London", type: "CULTURE", city: "London", ratingNotes: "The Crown Jewels are unmissable. Book in advance to skip the queues.", websiteUrl: "https://www.hrp.org.uk/tower-of-london", fallbackImageUrl: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800" },
  { id: "ph-21", title: "Borough Market", type: "FOOD", city: "London", ratingNotes: "London's best food market. Arrive hungry on a weekday to avoid weekend crowds.", websiteUrl: "https://boroughmarket.org.uk", fallbackImageUrl: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800" },
  { id: "ph-22", title: "Hyde Park", type: "OUTDOOR", city: "London", ratingNotes: "Perfect for picnics and a morning run. Diana Memorial Fountain is a hit with kids.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1569880153113-76e33fc52d5f?w=800" },
  { id: "ph-23", title: "Natural History Museum", type: "FAMILY", city: "London", ratingNotes: "Free entry. The dinosaur skeleton in the main hall alone is worth the trip.", websiteUrl: "https://www.nhm.ac.uk", fallbackImageUrl: "https://images.unsplash.com/photo-1574958269340-fa927503f3dd?w=800" },
  { id: "ph-24", title: "Tate Modern", type: "CULTURE", city: "London", ratingNotes: "Free and world-class. The Turbine Hall installations are always spectacular.", websiteUrl: "https://www.tate.org.uk/visit/tate-modern", fallbackImageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800" },
  { id: "ph-25", title: "Nara Deer Park", type: "OUTDOOR", city: "Nara", ratingNotes: "Free-roaming deer throughout the park. Buy shika senbei crackers from vendors to feed them.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800" },
  { id: "ph-26", title: "Teramachi", type: "SHOPPING", city: "Kyoto", ratingNotes: "Covered shopping arcade with traditional crafts, tea shops, and local snacks.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800" },
  { id: "ph-27", title: "Philosopher's Path", type: "OUTDOOR", city: "Kyoto", ratingNotes: "A quiet canal-side walk lined with cherry trees. Best in early spring.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=800" },
  { id: "ph-28", title: "Ninna-Ji Temple", type: "CULTURE", city: "Kyoto", ratingNotes: "UNESCO World Heritage site. Famous for late-blooming dwarf cherry trees.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800" },
  { id: "ph-29", title: "Dinner at Yorozuya", type: "FOOD", city: "Kyoto", ratingNotes: "Traditional Kyoto kaiseki in a quiet machiya townhouse. Reserve well ahead.", websiteUrl: null, fallbackImageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800" },
];

const imageCache = new Map<string, string | null>();

export async function GET() {
  const enriched = await Promise.all(
    PLACEHOLDER_PICKS.map(async p => {
      if (!imageCache.has(p.id)) {
        const imageUrl = await enrichActivityImage(p.title, p.city, p.type);
        imageCache.set(p.id, imageUrl);
      }
      return {
        ...p,
        rating: null,
        wouldReturn: null,
        imageUrl: imageCache.get(p.id) ?? p.fallbackImageUrl ?? null,
        tripId: "",
        shareToken: null,
        familyName: null,
        isAnonymous: true,
        visitorCount: 0,
        source: "placeholder" as const,
      };
    })
  );

  return NextResponse.json({ activities: enriched });
}
