export interface Airline {
  code: string;
  name: string;
}

export const AIRLINES: Airline[] = [
  { code: "AA", name: "American Airlines" },
  { code: "AC", name: "Air Canada" },
  { code: "AF", name: "Air France" },
  { code: "AK", name: "AirAsia" },
  { code: "AL", name: "Alaska Airlines" },
  { code: "AM", name: "Aeromexico" },
  { code: "AS", name: "Alaska Airlines" },
  { code: "AY", name: "Finnair" },
  { code: "AZ", name: "ITA Airways" },
  { code: "B6", name: "JetBlue" },
  { code: "BA", name: "British Airways" },
  { code: "BR", name: "EVA Air" },
  { code: "CA", name: "Air China" },
  { code: "CI", name: "China Airlines" },
  { code: "CX", name: "Cathay Pacific" },
  { code: "DL", name: "Delta Air Lines" },
  { code: "EK", name: "Emirates" },
  { code: "EY", name: "Etihad Airways" },
  { code: "F9", name: "Frontier Airlines" },
  { code: "FJ", name: "Fiji Airways" },
  { code: "GA", name: "Garuda Indonesia" },
  { code: "HA", name: "Hawaiian Airlines" },
  { code: "IB", name: "Iberia" },
  { code: "JL", name: "Japan Airlines" },
  { code: "JQ", name: "Jetstar" },
  { code: "KE", name: "Korean Air" },
  { code: "KL", name: "KLM" },
  { code: "LA", name: "LATAM Airlines" },
  { code: "LH", name: "Lufthansa" },
  { code: "LO", name: "LOT Polish Airlines" },
  { code: "LX", name: "Swiss International" },
  { code: "MH", name: "Malaysia Airlines" },
  { code: "MU", name: "China Eastern" },
  { code: "NH", name: "ANA All Nippon Airways" },
  { code: "NK", name: "Spirit Airlines" },
  { code: "NZ", name: "Air New Zealand" },
  { code: "OZ", name: "Asiana Airlines" },
  { code: "PR", name: "Philippine Airlines" },
  { code: "QF", name: "Qantas" },
  { code: "QR", name: "Qatar Airways" },
  { code: "RJ", name: "Royal Jordanian" },
  { code: "SA", name: "South African Airways" },
  { code: "SK", name: "Scandinavian Airlines" },
  { code: "SQ", name: "Singapore Airlines" },
  { code: "SU", name: "Aeroflot" },
  { code: "TG", name: "Thai Airways" },
  { code: "TK", name: "Turkish Airlines" },
  { code: "TP", name: "TAP Air Portugal" },
  { code: "UA", name: "United Airlines" },
  { code: "UL", name: "SriLankan Airlines" },
  { code: "US", name: "US Airways" },
  { code: "VN", name: "Vietnam Airlines" },
  { code: "VS", name: "Virgin Atlantic" },
  { code: "VX", name: "Virgin America" },
  { code: "WN", name: "Southwest Airlines" },
  { code: "WS", name: "WestJet" },
  { code: "ZH", name: "Shenzhen Airlines" },
];


export function parseFlightNumber(raw: string): { airline: string; number: string } {
  const match = raw.trim().toUpperCase().match(/^([A-Z]{2,3})(\d+)$/);
  if (match) return { airline: match[1], number: match[2] };
  return { airline: "", number: raw.trim() };
}
