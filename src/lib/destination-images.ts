// Curated venue-level images — checked before any dynamic source.
// Keys are lowercase substrings; a match is found if the key appears in the item title or vice versa.
export const VENUE_IMAGES: Record<string, string> = {
  // Tokyo
  "teamlab borderless":         "https://images.unsplash.com/photo-1554136835-98b2c56c6e20?w=800&q=80",
  "teamlab":                    "https://images.unsplash.com/photo-1554136835-98b2c56c6e20?w=800&q=80",
  "shibuya crossing":           "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&q=80",
  "shibuya":                    "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800&q=80",
  "tokyo skytree":              "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=800&q=80",
  "skytree":                    "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=800&q=80",
  "senso-ji":                   "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  "sensoji":                    "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  "asakusa":                    "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  "meiji shrine":               "https://images.unsplash.com/photo-1583400421673-32a765f5e0c2?w=800&q=80",
  "meiji":                      "https://images.unsplash.com/photo-1583400421673-32a765f5e0c2?w=800&q=80",
  "harajuku":                   "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80",
  "takeshita":                  "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80",
  "shinjuku":                   "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  "akihabara":                  "https://images.unsplash.com/photo-1519638831568-d9897f54ed69?w=800&q=80",
  "tsukiji":                    "https://images.unsplash.com/photo-1601823984263-4b73e74c3fd6?w=800&q=80",
  "ueno":                       "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  "odaiba":                     "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",

  // Seoul
  "gyeongbokgung":              "https://images.unsplash.com/photo-1578637387939-43c525550085?w=800&q=80",
  "bukchon hanok":              "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80",
  "bukchon":                    "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80",
  "namsan tower":               "https://images.unsplash.com/photo-1601621915196-2621bfb0cd6e?w=800&q=80",
  "n seoul tower":              "https://images.unsplash.com/photo-1601621915196-2621bfb0cd6e?w=800&q=80",
  "namsan":                     "https://images.unsplash.com/photo-1601621915196-2621bfb0cd6e?w=800&q=80",
  "insadong":                   "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80",
  "lotte world":                "https://images.unsplash.com/photo-1562408590-e32931084e23?w=800&q=80",
  "gwangjang market":           "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80",
  "gwangjang":                  "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80",
  "coex":                       "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80",
  "dmz":                        "https://images.unsplash.com/photo-1569701813229-33284b643e3c?w=800&q=80",
  "changdeokgung":              "https://images.unsplash.com/photo-1578637387939-43c525550085?w=800&q=80",
  "hongdae":                    "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80",
  "myeongdong":                 "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80",

  // Kyoto
  "fushimi inari":              "https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=800&q=80",
  "fushimi":                    "https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=800&q=80",
  "arashiyama":                 "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  "bamboo grove":               "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  "kinkaku-ji":                 "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80",
  "kinkakuji":                  "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80",
  "golden pavilion":            "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80",
  "gion":                       "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80",
  "nishiki market":             "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80",
  "philosopher's path":         "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",

  // Osaka
  "dotonbori":                  "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&q=80",
  "osaka castle":               "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&q=80",
  "universal studios japan":    "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&q=80",
  "kuromon market":             "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&q=80",

  // Marrakesh
  "djemaa el-fna":              "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "djemaa":                     "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "jemaa el fnaa":              "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "medina souks":               "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80",
  "souks":                      "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80",
  "majorelle garden":           "https://images.unsplash.com/photo-1548531853-2ac7d6d0b5af?w=800&q=80",
  "majorelle":                  "https://images.unsplash.com/photo-1548531853-2ac7d6d0b5af?w=800&q=80",
  "atlas mountains":            "https://images.unsplash.com/photo-1531176175280-dd4f6b261d60?w=800&q=80",
  "atlas":                      "https://images.unsplash.com/photo-1531176175280-dd4f6b261d60?w=800&q=80",
  "bahia palace":               "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",

  // Okinawa
  "shuri castle":               "https://images.unsplash.com/photo-1580640810088-1ac1d5f0ffe2?w=800&q=80",
  "shuri":                      "https://images.unsplash.com/photo-1580640810088-1ac1d5f0ffe2?w=800&q=80",
  "churaumi aquarium":          "https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=800&q=80",
  "churaumi":                   "https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=800&q=80",
  "katsuren castle":            "https://images.unsplash.com/photo-1580640810088-1ac1d5f0ffe2?w=800&q=80",

  // Thailand
  "wat phra kaew":              "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80",
  "grand palace":               "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80",
  "wat arun":                   "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80",
  "chiang mai temple":          "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80",
  "doi suthep":                 "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80",
  "night bazaar":               "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80",

  // Bali
  "tanah lot":                  "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80",
  "ubud":                       "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80",
  "tegallalang":                "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80",
  "rice terraces":              "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80",

  // Paris
  "eiffel tower":               "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
  "eiffel":                     "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
  "louvre":                     "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
  "notre dame":                 "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
  "montmartre":                 "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
  "champs elysees":             "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",

  // London
  "tower of london":            "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  "big ben":                    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  "buckingham palace":          "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  "british museum":             "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",

  // Singapore
  "marina bay sands":           "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80",
  "gardens by the bay":         "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80",
  "sentosa":                    "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80",
  "universal studios singapore": "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80",
};

/** Returns a curated Unsplash URL for a known venue, or null if not in the map. */
export function getVenueImage(title: string): string | null {
  const t = title.toLowerCase().trim();
  for (const [key, url] of Object.entries(VENUE_IMAGES)) {
    if (t.includes(key) || key.includes(t)) return url;
  }
  return null;
}

export const DESTINATION_IMAGES: Record<string, string> = {
  // Japan
  "tokyo": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  "kyoto": "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  "osaka": "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&q=80",
  "okinawa": "https://images.unsplash.com/photo-1580640810088-1ac1d5f0ffe2?w=800&q=80",
  "naha": "https://images.unsplash.com/photo-1580640810088-1ac1d5f0ffe2?w=800&q=80",
  "kamakura": "https://images.unsplash.com/photo-1571890246824-795f3f28b4c4?w=800&q=80",
  "hiroshima": "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80",
  "nara": "https://images.unsplash.com/photo-1590245349325-b90a35b30a9e?w=800&q=80",
  "fukuoka": "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80",
  "sapporo": "https://images.unsplash.com/photo-1578637387939-43c525550085?w=800&q=80",

  // Korea
  "seoul": "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80",
  "busan": "https://images.unsplash.com/photo-1578637387939-43c525550085?w=800&q=80",
  "incheon": "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80",

  // Thailand
  "chiang mai": "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80",
  "chiang rai": "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80",
  "bangkok": "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80",
  "phuket": "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=800&q=80",
  "koh samui": "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=800&q=80",

  // Southeast Asia
  "bali": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80",
  "singapore": "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80",
  "hong kong": "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=800&q=80",
  "taipei": "https://images.unsplash.com/photo-1570640820741-ebb1b80f92da?w=800&q=80",
  "hanoi": "https://images.unsplash.com/photo-1528127269322-539801943592?w=800&q=80",
  "ho chi minh": "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&q=80",
  "phnom penh": "https://images.unsplash.com/photo-1508159452718-d22f6734a236?w=800&q=80",
  "siem reap": "https://images.unsplash.com/photo-1508159452718-d22f6734a236?w=800&q=80",
  "kuala lumpur": "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&q=80",

  // Middle East
  "dubai": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
  "abu dhabi": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
  "istanbul": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80",

  // South Asia
  "colombo": "https://images.unsplash.com/photo-1567591370078-c3a7f7c91b88?w=800&q=80",
  "galle": "https://images.unsplash.com/photo-1567591370078-c3a7f7c91b88?w=800&q=80",
  "kathmandu": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80",

  // Europe
  "paris": "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
  "london": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  "barcelona": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80",
  "rome": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  "florence": "https://images.unsplash.com/photo-1543429776-2782fc8e1acd?w=800&q=80",
  "venice": "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800&q=80",
  "lisbon": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80",
  "madrid": "https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&q=80",
  "amsterdam": "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&q=80",
  "berlin": "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80",
  "prague": "https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&q=80",
  "vienna": "https://images.unsplash.com/photo-1516550893885-985c836c5113?w=800&q=80",
  "zurich": "https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=800&q=80",
  "dubrovnik": "https://images.unsplash.com/photo-1555990538-1e05be37f9d8?w=800&q=80",
  "santorini": "https://images.unsplash.com/photo-1530841377377-3ff06c0ca713?w=800&q=80",
  "athens": "https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&q=80",
  "reykjavik": "https://images.unsplash.com/photo-1520769669658-f07657f5a307?w=800&q=80",
  "ireland": "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&q=80",
  "edinburgh": "https://images.unsplash.com/photo-1506377585622-bedcbb027afc?w=800&q=80",
  "scotland": "https://images.unsplash.com/photo-1506377585622-bedcbb027afc?w=800&q=80",

  // Africa / Middle East
  "marrakech": "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "marrakesh": "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "tangier": "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "fez": "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "casablanca": "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "chefchaouen": "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "merzouga": "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "cairo": "https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=800&q=80",
  "cape town": "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&q=80",

  // Americas
  "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80",
  "los angeles": "https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=800&q=80",
  "san diego": "https://images.unsplash.com/photo-1538397288585-5cf8a85d6c4c?w=800&q=80",
  "san francisco": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80",
  "chicago": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80",
  "miami": "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=800&q=80",
  "honolulu": "https://images.unsplash.com/photo-1542259009477-d625272157b7?w=800&q=80",
  "maui": "https://images.unsplash.com/photo-1542259009477-d625272157b7?w=800&q=80",
  "cancun": "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=800&q=80",
  "tulum": "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=800&q=80",
  "mexico city": "https://images.unsplash.com/photo-1518659526054-190340b32735?w=800&q=80",
  "montreal": "https://images.unsplash.com/photo-1519178614-68673b201f36?w=800&q=80",
  "toronto": "https://images.unsplash.com/photo-1517090186835-e348b621c9ca?w=800&q=80",
  "rio de janeiro": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80",
  "buenos aires": "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=800&q=80",
  "cusco": "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=800&q=80",

  // Oceania
  "sydney": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80",
  "melbourne": "https://images.unsplash.com/photo-1514395462725-fb4566210144?w=800&q=80",

  // Maldives / Islands
  "maldives": "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80",

  // Country fallbacks (only for countries not covered by city keys above)
  "japan": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  "thailand": "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80",
  "indonesia": "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80",
  "korea": "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80",
  "south korea": "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&q=80",
  "sri lanka": "https://images.unsplash.com/photo-1567591370078-c3a7f7c91b88?w=800&q=80",
  "morocco": "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=800&q=80",
  "italy": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  "france": "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
  "spain": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80",
  "portugal": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80",
  "australia": "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80",
  "mexico": "https://images.unsplash.com/photo-1518659526054-190340b32735?w=800&q=80",
  "vietnam": "https://images.unsplash.com/photo-1528127269322-539801943592?w=800&q=80",
  "cambodia": "https://images.unsplash.com/photo-1508159452718-d22f6734a236?w=800&q=80",
  "nepal": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80",
  "peru": "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=800&q=80",
  "iceland": "https://images.unsplash.com/photo-1520769669658-f07657f5a307?w=800&q=80",
  "greece": "https://images.unsplash.com/photo-1530841377377-3ff06c0ca713?w=800&q=80",
  "turkey": "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80",
  "uae": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
  "united arab emirates": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
  "hawaii": "https://images.unsplash.com/photo-1542259009477-d625272157b7?w=800&q=80",
};

export const DEFAULT_COVER = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80";

// Type-based fallback images — used before city/destination fallback
export const TYPE_IMAGES: Record<string, string> = {
  train: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80",
  rail: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80",
  transit: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80",
  flight: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80",
  airline: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80",
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  lodging: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  hostel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  resort: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  food: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  dining: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
};

function lookupDestination(city?: string | null, country?: string | null): string | null {
  const cityKey = (city ?? "").toLowerCase().trim();
  const countryKey = (country ?? "").toLowerCase().trim();

  // 1. Exact city match
  if (cityKey && DESTINATION_IMAGES[cityKey]) return DESTINATION_IMAGES[cityKey];

  // 2. Partial city match — "Naha, Okinawa" contains "naha"
  if (cityKey) {
    const match = Object.keys(DESTINATION_IMAGES).find(
      (k) => cityKey.includes(k) || (k.length >= 4 && k.includes(cityKey))
    );
    if (match) return DESTINATION_IMAGES[match];
  }

  // 3. Exact country match
  if (countryKey && DESTINATION_IMAGES[countryKey]) return DESTINATION_IMAGES[countryKey];

  // 4. Partial country match
  if (countryKey) {
    const match = Object.keys(DESTINATION_IMAGES).find(
      (k) => countryKey.includes(k) || (k.length >= 4 && k.includes(countryKey))
    );
    if (match) return DESTINATION_IMAGES[match];
  }

  return null;
}

export function getTripCoverImage(
  city?: string | null,
  country?: string | null,
  heroImageUrl?: string | null,
): string {
  if (heroImageUrl) return heroImageUrl;
  return lookupDestination(city, country) ?? DEFAULT_COVER;
}

/**
 * Full priority chain for SavedItem / activity card images:
 * 1. getVenueImage(title) — curated venue photo (single source of truth)
 * 2. placePhotoUrl  — Google Places photo (dynamic fallback)
 * 3. mediaThumbnailUrl — scraped thumbnail
 * 4. type-based Unsplash fallback (train, flight, hotel, food)
 * 5. destination photo (city or country)
 * 6. generic travel fallback
 */
export function getItemImage(
  title?: string | null,
  placePhotoUrl?: string | null,
  mediaThumbnailUrl?: string | null,
  type?: string | null,
  city?: string | null,
  country?: string | null,
): string {
  const place = placePhotoUrl?.trim();
  if (place) return place.replace("http://", "https://");

  const venue = title ? getVenueImage(title) : null;
  if (venue) return venue;

  const thumb = mediaThumbnailUrl?.trim();
  if (thumb) return thumb.replace("http://", "https://");

  // Type-based fallback (before destination)
  const t = (type ?? "").toLowerCase();
  for (const key of Object.keys(TYPE_IMAGES)) {
    if (t.includes(key)) return TYPE_IMAGES[key];
  }

  return lookupDestination(city, country) ?? DEFAULT_COVER;
}
