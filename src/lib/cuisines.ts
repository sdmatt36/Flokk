export const COUNTRY_TO_CUISINE: Record<string, string> = {
  "Japan": "Japanese",
  "Italy": "Italian",
  "France": "French",
  "Spain": "Spanish",
  "Mexico": "Mexican",
  "Thailand": "Thai",
  "China": "Chinese",
  "Korea": "Korean",
  "South Korea": "Korean",
  "India": "Indian",
  "Vietnam": "Vietnamese",
  "Greece": "Greek",
  "Turkey": "Turkish",
  "Lebanon": "Lebanese",
  "Morocco": "Moroccan",
  "Egypt": "Egyptian",
  "Brazil": "Brazilian",
  "Argentina": "Argentine",
  "Peru": "Peruvian",
  "Portugal": "Portuguese",
  "Germany": "German",
  "United Kingdom": "British",
  "Ireland": "Irish",
  "Indonesia": "Indonesian",
  "Malaysia": "Malaysian",
  "Singapore": "Singaporean",
  "Philippines": "Filipino",
  "United States": "American",
  "Canada": "Canadian",
  "Australia": "Australian",
  "New Zealand": "New Zealand",
  "Ethiopia": "Ethiopian",
  "Israel": "Israeli",
  "Iran": "Persian",
  "United Arab Emirates": "Emirati",
};

export function getLocalCuisine(countryName: string): string {
  return COUNTRY_TO_CUISINE[countryName] ?? "Local";
}

export const CUISINE_MARKERS: Array<{ cuisine: string; patterns: RegExp }> = [
  { cuisine: "Japanese",      patterns: /\b(ramen|sushi|izakaya|tempura|teppanyaki|sake|kaiseki|soba|udon|tonkatsu|donburi|yakiniku|okonomiyaki|takoyaki|onigiri|ichiran|ippudo|sukiya|yoshinoya)\b/i },
  { cuisine: "Italian",       patterns: /\b(pizza|pizzeria|pasta|trattoria|osteria|ristorante|gelato|panini|focaccia)\b/i },
  { cuisine: "Mexican",       patterns: /\b(taco|tacos|taqueria|cantina|burrito|tamale|nacho|enchilada|mexican)\b/i },
  { cuisine: "Thai",          patterns: /\b(thai|pad thai|tom yum|som tam|larb)\b/i },
  { cuisine: "Chinese",       patterns: /\b(dim sum|dumpling|hot pot|hotpot|peking|chinese|szechuan|cantonese)\b/i },
  { cuisine: "Korean",        patterns: /\b(korean|kimchi|bulgogi|bibimbap|kbbq)\b/i },
  { cuisine: "Indian",        patterns: /\b(indian|curry|tandoor|tandoori|biryani|masala|naan|dosa)\b/i },
  { cuisine: "French",        patterns: /\b(bistro|brasserie|patisserie|boulangerie|crêperie|creperie)\b/i },
  { cuisine: "American",      patterns: /\b(bbq|barbecue|burger|smokehouse|diner|steakhouse|sports bar|wings)\b/i },
  { cuisine: "Spanish",       patterns: /\b(tapas|paella|jamón|jamon|pintxos)\b/i },
  { cuisine: "Vietnamese",    patterns: /\b(pho|banh mi|banh|vietnamese)\b/i },
  { cuisine: "Greek",         patterns: /\b(greek|gyro|souvlaki|tzatziki)\b/i },
  { cuisine: "Mediterranean", patterns: /\b(mediterranean|falafel|hummus|kebab|shawarma|mezze)\b/i },
  { cuisine: "Cafe",          patterns: /\b(café|cafe|coffee|espresso|pâtisserie|patisserie|bakery)\b/i },
  { cuisine: "Bar",           patterns: /\b(brewery|brewing|brew|tap room|cocktail|wine bar|gastropub)\b/i },
];

export function inferCuisine(name: string, countryName: string): string {
  for (const m of CUISINE_MARKERS) {
    if (m.patterns.test(name)) return m.cuisine;
  }
  return getLocalCuisine(countryName);
}

export const LODGING_TYPE_MARKERS: Array<{ type: string; patterns: RegExp }> = [
  { type: "Hostel",          patterns: /\bhostel\b/i },
  { type: "Resort",          patterns: /\b(resort|spa resort)\b/i },
  { type: "Vacation Rental", patterns: /\b(airbnb|vrbo|homestay|villa|apartment|rental|guesthouse|guest house|bed and breakfast|b&b)\b/i },
  { type: "Boutique",        patterns: /\bboutique\b/i },
  { type: "Hotel",           patterns: /\b(hotel|inn|regency|marriott|hilton|hyatt|ritz|four seasons|westin|sheraton|intercontinental|wyndham|metropolitan|edition|park hyatt|grand hyatt)\b/i },
];

export function inferLodgingType(name: string): string {
  for (const m of LODGING_TYPE_MARKERS) {
    if (m.patterns.test(name)) return m.type;
  }
  return "Hotel";
}
