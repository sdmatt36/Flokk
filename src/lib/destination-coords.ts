// [lng, lat] coordinates for common destinations
const COORDS: Array<{ cities: string[]; countries: string[]; coords: [number, number] }> = [
  { cities: ["okinawa", "naha", "ishigaki", "miyako"], countries: ["japan"], coords: [127.6809, 26.2124] },
  { cities: ["tokyo", "shinjuku", "shibuya", "akihabara", "harajuku"], countries: [], coords: [139.6917, 35.6895] },
  { cities: ["kyoto", "osaka", "nara", "kobe"], countries: [], coords: [135.7681, 35.0116] },
  { cities: ["hiroshima"], countries: [], coords: [132.4596, 34.3853] },
  { cities: ["sapporo", "hokkaido"], countries: [], coords: [141.3544, 43.0618] },
  { cities: ["fukuoka"], countries: [], coords: [130.4017, 33.5904] },
  { cities: ["seoul", "incheon", "busan", "jeju"], countries: ["korea", "south korea"], coords: [126.9780, 37.5665] },
  { cities: ["busan"], countries: [], coords: [129.0756, 35.1796] },
  { cities: ["bangkok"], countries: ["thailand"], coords: [100.5018, 13.7563] },
  { cities: ["chiang rai"], countries: [], coords: [99.8324, 19.9105] },
  { cities: ["chiang mai"], countries: [], coords: [98.9817, 18.7883] },
  { cities: ["phuket"], countries: [], coords: [98.3923, 7.8804] },
  { cities: ["krabi"], countries: [], coords: [98.9186, 8.0863] },
  { cities: ["koh samui"], countries: [], coords: [100.0641, 9.5120] },
  { cities: ["pattaya"], countries: [], coords: [100.8840, 12.9236] },
  { cities: ["hua hin"], countries: [], coords: [99.9576, 12.5684] },
  { cities: ["pai"], countries: [], coords: [98.4410, 19.3587] },
  { cities: ["bali", "denpasar", "ubud", "canggu", "seminyak"], countries: ["indonesia"], coords: [115.1889, -8.4095] },
  { cities: ["singapore"], countries: ["singapore"], coords: [103.8198, 1.3521] },
  { cities: ["hong kong"], countries: ["hong kong"], coords: [114.1694, 22.3193] },
  { cities: ["taipei", "taichung", "kaohsiung"], countries: ["taiwan"], coords: [121.5654, 25.0330] },
  { cities: ["sydney", "melbourne", "brisbane", "perth"], countries: ["australia"], coords: [151.2093, -33.8688] },
  { cities: ["paris"], countries: ["france"], coords: [2.3522, 48.8566] },
  { cities: ["london"], countries: ["uk", "united kingdom", "england"], coords: [-0.1276, 51.5074] },
  { cities: ["rome", "florence", "venice", "milan", "naples"], countries: ["italy"], coords: [12.4964, 41.9028] },
  { cities: ["barcelona", "madrid", "seville"], countries: ["spain"], coords: [2.1734, 41.3851] },
  { cities: ["amsterdam"], countries: ["netherlands"], coords: [4.9041, 52.3676] },
  { cities: ["berlin", "munich", "hamburg"], countries: ["germany"], coords: [13.4050, 52.5200] },
  { cities: ["lisbon", "porto"], countries: ["portugal"], coords: [-9.1393, 38.7223] },
  { cities: ["zurich", "geneva", "bern"], countries: ["switzerland"], coords: [8.5417, 47.3769] },
  { cities: ["prague"], countries: ["czech republic", "czechia"], coords: [14.4208, 50.0880] },
  { cities: ["vienna"], countries: ["austria"], coords: [16.3738, 48.2082] },
  { cities: ["dubai", "abu dhabi"], countries: ["uae", "united arab emirates"], coords: [55.2708, 25.2048] },
  { cities: ["new york", "nyc", "brooklyn", "manhattan"], countries: [], coords: [-74.0060, 40.7128] },
  { cities: ["los angeles", "la", "santa monica", "hollywood"], countries: [], coords: [-118.2437, 34.0522] },
  { cities: ["san francisco", "sf", "bay area"], countries: [], coords: [-122.4194, 37.7749] },
  { cities: ["chicago"], countries: [], coords: [-87.6298, 41.8781] },
  { cities: ["miami", "miami beach"], countries: [], coords: [-80.1918, 25.7617] },
  { cities: ["honolulu", "maui", "hawaii", "kauai", "big island"], countries: [], coords: [-157.8583, 21.3069] },
  { cities: ["cancun", "playa del carmen", "tulum"], countries: ["mexico"], coords: [-86.8515, 21.1619] },
  { cities: ["mexico city"], countries: ["mexico"], coords: [-99.1332, 19.4326] },
  { cities: ["toronto", "ontario"], countries: [], coords: [-79.3832, 43.6532] },
  { cities: ["vancouver", "british columbia"], countries: [], coords: [-123.1207, 49.2827] },
  { cities: ["montreal"], countries: [], coords: [-73.5674, 45.5019] },
  { cities: ["buenos aires"], countries: ["argentina"], coords: [-58.3816, -34.6037] },
  // Additional Asia
  { cities: ["chengdu"], countries: [], coords: [104.0657, 30.5728] },
  { cities: ["xian", "xi an", "xi'an"], countries: [], coords: [108.9402, 34.3416] },
  { cities: ["guilin"], countries: [], coords: [110.2990, 25.2736] },
  { cities: ["zhangjiajie"], countries: [], coords: [110.4792, 29.1175] },
  { cities: ["ha long bay", "halong"], countries: ["vietnam"], coords: [107.0840, 20.9101] },
  { cities: ["hoi an"], countries: [], coords: [108.3280, 15.8800] },
  { cities: ["siem reap"], countries: ["cambodia"], coords: [103.8567, 13.3633] },
  { cities: ["luang prabang"], countries: ["laos"], coords: [102.1302, 19.8845] },
  { cities: ["yangon"], countries: ["myanmar"], coords: [96.1951, 16.8409] },
  { cities: ["colombo"], countries: ["sri lanka"], coords: [79.8612, 6.9271] },
  { cities: ["kathmandu"], countries: ["nepal"], coords: [85.3240, 27.7172] },
  { cities: ["maldives", "male"], countries: ["maldives"], coords: [73.5089, 4.1755] },
  // Middle East
  { cities: ["jerusalem"], countries: ["israel"], coords: [35.2137, 31.7683] },
  { cities: ["tel aviv"], countries: [], coords: [34.7818, 32.0853] },
  { cities: ["amman"], countries: ["jordan"], coords: [35.9106, 31.9539] },
  { cities: ["muscat"], countries: ["oman"], coords: [58.5922, 23.5880] },
  // Africa
  { cities: ["marrakech", "marrakesh"], countries: ["morocco"], coords: [-7.9811, 31.6295] },
  { cities: ["casablanca"], countries: [], coords: [-7.5898, 33.5731] },
  { cities: ["cairo"], countries: ["egypt"], coords: [31.2357, 30.0444] },
  { cities: ["nairobi"], countries: ["kenya"], coords: [36.8219, -1.2921] },
  { cities: ["cape town"], countries: ["south africa"], coords: [18.4241, -33.9249] },
  { cities: ["zanzibar"], countries: ["tanzania"], coords: [39.2083, -6.1659] },
  // Americas
  { cities: ["new york city", "nyc"], countries: [], coords: [-74.0059, 40.7128] },
  { cities: ["havana"], countries: ["cuba"], coords: [-82.3666, 23.1136] },
  { cities: ["bogota"], countries: ["colombia"], coords: [-74.0721, 4.7110] },
  { cities: ["medellin"], countries: [], coords: [-75.5636, 6.2518] },
  { cities: ["cartagena"], countries: [], coords: [-75.5144, 10.3910] },
  { cities: ["cusco", "cuzco"], countries: ["peru"], coords: [-71.9675, -13.5319] },
  { cities: ["machu picchu"], countries: [], coords: [-72.5450, -13.1631] },
  { cities: ["rio de janeiro", "rio"], countries: ["brazil"], coords: [-43.1729, -22.9068] },
  { cities: ["patagonia"], countries: [], coords: [-70.9179, -53.1638] },
  // Europe extras
  { cities: ["dubrovnik", "zagreb", "croatia"], countries: ["croatia"], coords: [18.0944, 42.6507] },
  { cities: ["split"], countries: [], coords: [16.4402, 43.5081] },
  { cities: ["santorini"], countries: [], coords: [25.4615, 36.3932] },
  { cities: ["mykonos"], countries: [], coords: [25.3289, 37.4467] },
  { cities: ["amalfi", "amalfi coast"], countries: [], coords: [14.6027, 40.6340] },
  { cities: ["cinque terre"], countries: [], coords: [9.7155, 44.1461] },
  { cities: ["tuscany"], countries: [], coords: [11.2558, 43.7711] },
  { cities: ["bruges"], countries: ["belgium"], coords: [3.2247, 51.2093] },
  { cities: ["reykjavik"], countries: ["iceland"], coords: [-21.9426, 64.1355] },
  { cities: ["bergen"], countries: ["norway"], coords: [5.3221, 60.3913] },
  { cities: ["tallinn"], countries: ["estonia"], coords: [24.7536, 59.4370] },
  { cities: ["krakow", "kraków"], countries: ["poland"], coords: [19.9450, 50.0647] },
  { cities: ["seville"], countries: [], coords: [-5.9845, 37.3891] },
  { cities: ["granada"], countries: [], coords: [-3.5986, 37.1773] },
  // UK / Ireland
  { cities: ["edinburgh"], countries: ["scotland", "uk", "united kingdom"], coords: [-3.1883, 55.9533] },
  { cities: ["glasgow"], countries: ["scotland", "uk", "united kingdom"], coords: [-4.2518, 55.8642] },
  { cities: ["dublin", "ireland"], countries: ["ireland"], coords: [-6.2603, 53.3498] },
  { cities: ["belfast", "northern ireland"], countries: ["northern ireland", "uk", "united kingdom"], coords: [-5.9301, 54.5973] },
  // Production coverage gaps (from inventory 2026-04-30)
  { cities: ["athens", "thessaloniki", "syros", "greece"], countries: ["greece"], coords: [23.7275, 37.9838] },
  { cities: ["san diego"], countries: [], coords: [-117.1611, 32.7157] },
  { cities: ["portland"], countries: [], coords: [-122.6765, 45.5231] },
  { cities: ["detroit"], countries: [], coords: [-83.0458, 42.3314] },
  { cities: ["kamakura", "hakone"], countries: [], coords: [139.5523, 35.3197] },
  { cities: ["lombok", "mataram", "gili"], countries: [], coords: [116.2744, -8.7280] },
  { cities: ["kotor", "podgorica"], countries: ["montenegro"], coords: [18.7712, 42.4246] },
  { cities: ["manila", "cebu", "palawan", "boracay", "philippines"], countries: ["philippines"], coords: [120.9842, 14.5995] },
];

// World center — obviously wrong rather than misleadingly wrong
const DEFAULT: [number, number] = [20.0, 20.0];

export const KNOWN_CITIES: string[] = Array.from(
  new Set(COORDS.flatMap((e) => e.cities).map((c) => c.replace(/\b\w/g, (l) => l.toUpperCase())))
).sort();

// Safe substring match: requires key to be ≥4 chars to avoid
// short aliases like "la" matching substrings of "sri lanka"
function cityMatch(input: string, key: string): boolean {
  if (input === key) return true;
  if (key.length >= 4 && input.includes(key)) return true;
  if (input.length >= 4 && key.includes(input)) return true;
  return false;
}

export function getDestinationCoords(
  city: string | null | undefined,
  country: string | null | undefined,
): [number, number] {
  const c = (city ?? "").toLowerCase().trim();
  const co = (country ?? "").toLowerCase().trim();

  // Pass 1: city-only match across all entries (prevents early country fallback)
  if (c) {
    for (const entry of COORDS) {
      if (entry.cities.some((ec) => cityMatch(c, ec))) {
        return entry.coords;
      }
    }
  }

  // Pass 2: country-only match across all entries
  if (co) {
    for (const entry of COORDS) {
      if (entry.countries.some((ec) => co.includes(ec) || ec.includes(co))) {
        return entry.coords;
      }
    }
  }

  return DEFAULT;
}
