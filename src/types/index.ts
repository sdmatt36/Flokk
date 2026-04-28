// =============================================================================
// Shared TypeScript types
// =============================================================================

export type InterestCategory =
  | "FOOD"
  | "OUTDOOR"
  | "CULTURE"
  | "KIDS"
  | "ENTERTAINMENT"
  | "SHOPPING"
  | "WELLNESS"
  | "STYLE";

export type TripPrivacy = "PUBLIC" | "NETWORK" | "PRIVATE";
export type TripStatus = "PLANNING" | "ACTIVE" | "COMPLETED";
export type SubTier = "FREE" | "PREMIUM";
export type CommunityTier = "EXPLORER" | "NAVIGATOR" | "PIONEER";
export type MemberRole = "ADULT" | "CHILD";

export interface Interest {
  key: string;
  label: string;
  category: InterestCategory;
  emoji: string;
}

// Master interest list — 50 interests across 8 categories
export const INTERESTS: Interest[] = [
  // FOOD
  { key: "street_food", label: "Street Food", category: "FOOD", emoji: "🌮" },
  { key: "local_markets", label: "Local Markets", category: "FOOD", emoji: "🛒" },
  { key: "fine_dining", label: "Fine Dining", category: "FOOD", emoji: "🍽️" },
  { key: "food_tours", label: "Food Tours", category: "FOOD", emoji: "🗺️" },
  { key: "cooking_classes", label: "Cooking Classes", category: "FOOD", emoji: "👨‍🍳" },
  { key: "cafes", label: "Cafes & Coffee", category: "FOOD", emoji: "☕" },
  // OUTDOOR
  { key: "hiking", label: "Hiking", category: "OUTDOOR", emoji: "🥾" },
  { key: "beaches", label: "Beaches", category: "OUTDOOR", emoji: "🏖️" },
  { key: "national_parks", label: "National Parks", category: "OUTDOOR", emoji: "🌲" },
  { key: "cycling", label: "Cycling", category: "OUTDOOR", emoji: "🚴" },
  { key: "water_sports", label: "Water Sports", category: "OUTDOOR", emoji: "🏄" },
  { key: "wildlife", label: "Wildlife & Nature", category: "OUTDOOR", emoji: "🦁" },
  // CULTURE
  { key: "museums", label: "Museums", category: "CULTURE", emoji: "🏛️" },
  { key: "history", label: "History & Heritage", category: "CULTURE", emoji: "🏰" },
  { key: "art", label: "Art & Galleries", category: "CULTURE", emoji: "🎨" },
  { key: "architecture", label: "Architecture", category: "CULTURE", emoji: "🏗️" },
  { key: "local_festivals", label: "Local Festivals", category: "CULTURE", emoji: "🎉" },
  { key: "music", label: "Live Music", category: "CULTURE", emoji: "🎵" },
  // KIDS
  { key: "theme_parks", label: "Theme Parks", category: "KIDS", emoji: "🎢" },
  { key: "playgrounds", label: "Playgrounds & Parks", category: "KIDS", emoji: "🛝" },
  { key: "zoos", label: "Zoos & Aquariums", category: "KIDS", emoji: "🦒" },
  { key: "educational", label: "Educational Activities", category: "KIDS", emoji: "📚" },
  { key: "sports", label: "Sports & Games", category: "KIDS", emoji: "⚽" },
  { key: "hands_on", label: "Hands-On Experiences", category: "KIDS", emoji: "🤲" },
  // ENTERTAINMENT
  { key: "shows", label: "Shows & Theater", category: "ENTERTAINMENT", emoji: "🎭" },
  { key: "sports_events", label: "Sports Events", category: "ENTERTAINMENT", emoji: "🏟️" },
  { key: "nightlife", label: "Nightlife", category: "ENTERTAINMENT", emoji: "🌙" },
  { key: "movies", label: "Cinemas", category: "ENTERTAINMENT", emoji: "🎬" },
  { key: "family_kids", label: "Family & Kids", category: "ENTERTAINMENT", emoji: "👨‍👩‍👧" },
  { key: "kid_friendly", label: "Kid Friendly", category: "ENTERTAINMENT", emoji: "🧒" },
  // SHOPPING
  { key: "boutiques", label: "Boutiques", category: "SHOPPING", emoji: "🛍️" },
  { key: "vintage", label: "Vintage & Thrift", category: "SHOPPING", emoji: "👗" },
  { key: "souvenirs", label: "Souvenirs & Gifts", category: "SHOPPING", emoji: "🎁" },
  { key: "antiques", label: "Antiques", category: "SHOPPING", emoji: "🏺" },
  // WELLNESS
  { key: "spas", label: "Spas & Wellness", category: "WELLNESS", emoji: "💆" },
  { key: "yoga", label: "Yoga & Meditation", category: "WELLNESS", emoji: "🧘" },
  { key: "hot_springs", label: "Hot Springs & Onsen", category: "WELLNESS", emoji: "♨️" },
  { key: "slow_travel", label: "Slow Travel", category: "WELLNESS", emoji: "🌿" },
  // STYLE
  { key: "luxury", label: "Luxury Experiences", category: "STYLE", emoji: "✨" },
  { key: "budget_travel", label: "Budget Travel", category: "STYLE", emoji: "💰" },
  { key: "off_beaten_path", label: "Off the Beaten Path", category: "STYLE", emoji: "🧭" },
  { key: "photography", label: "Photography Spots", category: "STYLE", emoji: "📸" },
  { key: "road_trips", label: "Road Trips", category: "STYLE", emoji: "🚗" },
  { key: "multi_generational", label: "Multigenerational Travel", category: "STYLE", emoji: "👨‍👩‍👧‍👦" },
];

export const INTEREST_CATEGORIES: { key: InterestCategory; label: string }[] = [
  { key: "FOOD", label: "Food & Drink" },
  { key: "OUTDOOR", label: "Outdoors" },
  { key: "CULTURE", label: "Culture" },
  { key: "KIDS", label: "Kids & Family" },
  { key: "ENTERTAINMENT", label: "Entertainment" },
  { key: "SHOPPING", label: "Shopping" },
  { key: "WELLNESS", label: "Wellness" },
  { key: "STYLE", label: "Travel Style" },
];
