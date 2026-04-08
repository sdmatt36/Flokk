import { NextResponse } from "next/server";
import { enrichActivityImage } from "@/lib/activity-intelligence";

const PLACEHOLDER_PICKS = [
  { id: "ph-1", title: "Senso-ji Temple", type: "CULTURE", city: "Tokyo", ratingNotes: "One of Tokyo's most iconic landmarks. Best visited at dawn before the crowds arrive.", websiteUrl: "https://www.senso-ji.jp" },
  { id: "ph-2", title: "Shibuya Crossing", type: "ACTIVITY", city: "Tokyo", ratingNotes: "The world's busiest pedestrian crossing. Mesmerising at any time of day.", websiteUrl: null },
  { id: "ph-3", title: "Meiji Shrine", type: "CULTURE", city: "Tokyo", ratingNotes: "Peaceful forested shrine in the heart of the city. Best at dawn.", websiteUrl: null },
  { id: "ph-4", title: "Harajuku Takeshita Street", type: "SHOPPING", city: "Tokyo", ratingNotes: "Wild street food and fashion. Kids love the crepes and candy burritos.", websiteUrl: null },
  { id: "ph-5", title: "Tokyo Skytree", type: "ACTIVITY", city: "Tokyo", ratingNotes: "Best views in the city. Book online in advance.", websiteUrl: "https://www.tokyo-skytree.jp" },
  { id: "ph-6", title: "teamLab Borderless", type: "FAMILY", city: "Tokyo", ratingNotes: "Unmissable digital art experience. Book well in advance.", websiteUrl: "https://www.teamlab.art" },
  { id: "ph-7", title: "Eiffel Tower", type: "CULTURE", city: "Paris", ratingNotes: "Book skip-the-line tickets. Second floor view is the sweet spot.", websiteUrl: "https://www.toureiffel.paris" },
  { id: "ph-8", title: "Le Marais District", type: "OUTDOOR", city: "Paris", ratingNotes: "Best neighbourhood to wander. Great falafel on Rue des Rosiers.", websiteUrl: null },
  { id: "ph-9", title: "Musée d'Orsay", type: "CULTURE", city: "Paris", ratingNotes: "More accessible than the Louvre. The Impressionist collection alone is worth it.", websiteUrl: "https://www.musee-orsay.fr" },
  { id: "ph-10", title: "Park Güell", type: "OUTDOOR", city: "Barcelona", ratingNotes: "Timed entry required. Kids love the mosaic lizard.", websiteUrl: "https://parkguell.barcelona" },
  { id: "ph-11", title: "La Boqueria Market", type: "SHOPPING", city: "Barcelona", ratingNotes: "Go for the atmosphere. Buy from stalls deeper in.", websiteUrl: null },
  { id: "ph-12", title: "Sagrada Familia", type: "CULTURE", city: "Barcelona", ratingNotes: "Book well in advance. Tower tickets sell out weeks ahead.", websiteUrl: "https://sagradafamilia.org" },
  { id: "ph-13", title: "Chatuchak Weekend Market", type: "SHOPPING", city: "Bangkok", ratingNotes: "Go early, bring cash. One of the world's largest markets.", websiteUrl: null },
  { id: "ph-14", title: "Wat Pho Temple", type: "CULTURE", city: "Bangkok", ratingNotes: "Home of the giant reclining Buddha.", websiteUrl: null },
  { id: "ph-15", title: "Alfama District Walk", type: "OUTDOOR", city: "Lisbon", ratingNotes: "Cobblestone streets with the best city views. Wear comfortable shoes.", websiteUrl: null },
  { id: "ph-16", title: "Kyoto Bamboo Grove", type: "OUTDOOR", city: "Kyoto", ratingNotes: "Go at 6am before the tour groups arrive.", websiteUrl: null },
  { id: "ph-17", title: "Fushimi Inari Shrine", type: "CULTURE", city: "Kyoto", ratingNotes: "The thousand torii gates. Halfway up is stunning.", websiteUrl: null },
  { id: "ph-18", title: "Nishiki Market", type: "FOOD", city: "Kyoto", ratingNotes: "Kyoto's kitchen. Narrow covered market with incredible street food.", websiteUrl: null },
  { id: "ph-19", title: "Arashiyama Monkey Park", type: "FAMILY", city: "Kyoto", ratingNotes: "Short hike up, monkeys at the top. Kids absolutely love it.", websiteUrl: null },
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
        imageUrl: imageCache.get(p.id) ?? null,
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
