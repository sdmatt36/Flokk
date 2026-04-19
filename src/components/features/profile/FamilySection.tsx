"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const FREQUENCY_OPTIONS = [
  { value: "ONE_TWO", label: "1–2x per year" },
  { value: "THREE_FIVE", label: "3–5x per year" },
  { value: "SIX_PLUS", label: "6+ per year" },
];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma",
  "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
];

interface AirportDef {
  code: string;
  name: string;
  city: string;
  country: string;
}

const AIRPORTS: AirportDef[] = [
  // US — Major hubs
  { code: "ATL", name: "Hartsfield-Jackson Atlanta International", city: "Atlanta", country: "US" },
  { code: "LAX", name: "Los Angeles International", city: "Los Angeles", country: "US" },
  { code: "ORD", name: "O'Hare International", city: "Chicago", country: "US" },
  { code: "DFW", name: "Dallas/Fort Worth International", city: "Dallas", country: "US" },
  { code: "DEN", name: "Denver International", city: "Denver", country: "US" },
  { code: "JFK", name: "John F. Kennedy International", city: "New York", country: "US" },
  { code: "SFO", name: "San Francisco International", city: "San Francisco", country: "US" },
  { code: "SEA", name: "Seattle-Tacoma International", city: "Seattle", country: "US" },
  { code: "LAS", name: "Harry Reid International", city: "Las Vegas", country: "US" },
  { code: "MCO", name: "Orlando International", city: "Orlando", country: "US" },
  { code: "EWR", name: "Newark Liberty International", city: "Newark", country: "US" },
  { code: "PHX", name: "Phoenix Sky Harbor International", city: "Phoenix", country: "US" },
  { code: "IAH", name: "George Bush Intercontinental", city: "Houston", country: "US" },
  { code: "MIA", name: "Miami International", city: "Miami", country: "US" },
  { code: "BOS", name: "Logan International", city: "Boston", country: "US" },
  { code: "MSP", name: "Minneapolis-St. Paul International", city: "Minneapolis", country: "US" },
  { code: "DTW", name: "Detroit Metropolitan Wayne County", city: "Detroit", country: "US" },
  { code: "FLL", name: "Fort Lauderdale-Hollywood International", city: "Fort Lauderdale", country: "US" },
  { code: "PHL", name: "Philadelphia International", city: "Philadelphia", country: "US" },
  { code: "LGA", name: "LaGuardia Airport", city: "New York", country: "US" },
  { code: "BWI", name: "Baltimore/Washington International", city: "Baltimore", country: "US" },
  { code: "MDW", name: "Chicago Midway International", city: "Chicago", country: "US" },
  { code: "DCA", name: "Ronald Reagan Washington National", city: "Washington DC", country: "US" },
  { code: "IAD", name: "Washington Dulles International", city: "Washington DC", country: "US" },
  { code: "SLC", name: "Salt Lake City International", city: "Salt Lake City", country: "US" },
  { code: "PDX", name: "Portland International", city: "Portland", country: "US" },
  { code: "SAN", name: "San Diego International", city: "San Diego", country: "US" },
  { code: "HNL", name: "Daniel K. Inouye International", city: "Honolulu", country: "US" },
  { code: "MCI", name: "Kansas City International", city: "Kansas City", country: "US" },
  { code: "OAK", name: "Oakland Metropolitan International", city: "Oakland", country: "US" },
  { code: "SMF", name: "Sacramento International", city: "Sacramento", country: "US" },
  { code: "AUS", name: "Austin-Bergstrom International", city: "Austin", country: "US" },
  { code: "RDU", name: "Raleigh-Durham International", city: "Raleigh", country: "US" },
  { code: "STL", name: "St. Louis Lambert International", city: "St. Louis", country: "US" },
  { code: "BNA", name: "Nashville International", city: "Nashville", country: "US" },
  { code: "MKE", name: "Milwaukee Mitchell International", city: "Milwaukee", country: "US" },
  { code: "CLE", name: "Cleveland Hopkins International", city: "Cleveland", country: "US" },
  { code: "PIT", name: "Pittsburgh International", city: "Pittsburgh", country: "US" },
  { code: "IND", name: "Indianapolis International", city: "Indianapolis", country: "US" },
  { code: "CMH", name: "John Glenn Columbus International", city: "Columbus", country: "US" },
  { code: "RSW", name: "Southwest Florida International", city: "Fort Myers", country: "US" },
  { code: "TPA", name: "Tampa International", city: "Tampa", country: "US" },
  { code: "SAT", name: "San Antonio International", city: "San Antonio", country: "US" },
  { code: "ABQ", name: "Albuquerque International Sunport", city: "Albuquerque", country: "US" },
  { code: "BUR", name: "Hollywood Burbank Airport", city: "Burbank", country: "US" },
  { code: "SJC", name: "Norman Y. Mineta San José International", city: "San Jose", country: "US" },
  { code: "SNA", name: "John Wayne Airport", city: "Santa Ana", country: "US" },
  { code: "OGG", name: "Kahului Airport", city: "Maui", country: "US" },
  { code: "KOA", name: "Ellison Onizuka Kona International", city: "Kona", country: "US" },
  { code: "LIH", name: "Lihue Airport", city: "Kauai", country: "US" },
  { code: "ANC", name: "Ted Stevens Anchorage International", city: "Anchorage", country: "US" },
  { code: "MSY", name: "Louis Armstrong New Orleans International", city: "New Orleans", country: "US" },
  { code: "JAX", name: "Jacksonville International", city: "Jacksonville", country: "US" },
  { code: "CHS", name: "Charleston International", city: "Charleston", country: "US" },
  { code: "RIC", name: "Richmond International", city: "Richmond", country: "US" },
  { code: "SDF", name: "Louisville Muhammad Ali International", city: "Louisville", country: "US" },
  { code: "MEM", name: "Memphis International", city: "Memphis", country: "US" },
  { code: "BHM", name: "Birmingham-Shuttlesworth International", city: "Birmingham", country: "US" },
  { code: "ROC", name: "Greater Rochester International", city: "Rochester", country: "US" },
  { code: "BUF", name: "Buffalo Niagara International", city: "Buffalo", country: "US" },
  { code: "ALB", name: "Albany International", city: "Albany", country: "US" },
  { code: "PVD", name: "T.F. Green International", city: "Providence", country: "US" },
  { code: "MHT", name: "Manchester-Boston Regional", city: "Manchester", country: "US" },
  { code: "OMA", name: "Eppley Airfield", city: "Omaha", country: "US" },
  { code: "DSM", name: "Des Moines International", city: "Des Moines", country: "US" },
  { code: "MSN", name: "Dane County Regional", city: "Madison", country: "US" },
  { code: "GRR", name: "Gerald R. Ford International", city: "Grand Rapids", country: "US" },
  { code: "FSD", name: "Sioux Falls Regional", city: "Sioux Falls", country: "US" },
  { code: "BZN", name: "Bozeman Yellowstone International", city: "Bozeman", country: "US" },
  { code: "GEG", name: "Spokane International", city: "Spokane", country: "US" },
  { code: "BOI", name: "Boise Airport", city: "Boise", country: "US" },
  { code: "RNO", name: "Reno-Tahoe International", city: "Reno", country: "US" },
  { code: "TUL", name: "Tulsa International", city: "Tulsa", country: "US" },
  { code: "LIT", name: "Bill and Hillary Clinton National", city: "Little Rock", country: "US" },
  { code: "ICT", name: "Wichita Dwight D. Eisenhower National", city: "Wichita", country: "US" },
  { code: "COS", name: "Colorado Springs Airport", city: "Colorado Springs", country: "US" },
  { code: "FAT", name: "Fresno Yosemite International", city: "Fresno", country: "US" },
  { code: "PSP", name: "Palm Springs International", city: "Palm Springs", country: "US" },
  { code: "SBA", name: "Santa Barbara Airport", city: "Santa Barbara", country: "US" },
  { code: "MRY", name: "Monterey Regional Airport", city: "Monterey", country: "US" },
  { code: "FAI", name: "Fairbanks International", city: "Fairbanks", country: "US" },
  { code: "JNU", name: "Juneau International", city: "Juneau", country: "US" },
  { code: "ASE", name: "Aspen/Pitkin County Airport", city: "Aspen", country: "US" },
  { code: "JAC", name: "Jackson Hole Airport", city: "Jackson", country: "US" },
  { code: "SJU", name: "Luis Muñoz Marín International", city: "San Juan", country: "US" },
  // Canada
  { code: "YYZ", name: "Toronto Pearson International", city: "Toronto", country: "Canada" },
  { code: "YUL", name: "Montréal-Trudeau International", city: "Montréal", country: "Canada" },
  { code: "YVR", name: "Vancouver International", city: "Vancouver", country: "Canada" },
  { code: "YYC", name: "Calgary International", city: "Calgary", country: "Canada" },
  { code: "YEG", name: "Edmonton International", city: "Edmonton", country: "Canada" },
  { code: "YOW", name: "Ottawa Macdonald-Cartier International", city: "Ottawa", country: "Canada" },
  { code: "YHZ", name: "Halifax Stanfield International", city: "Halifax", country: "Canada" },
  { code: "YWG", name: "Winnipeg James Armstrong Richardson", city: "Winnipeg", country: "Canada" },
  { code: "YQB", name: "Québec City Jean Lesage International", city: "Québec City", country: "Canada" },
  // Mexico & Caribbean
  { code: "MEX", name: "Benito Juárez International", city: "Mexico City", country: "Mexico" },
  { code: "CUN", name: "Cancún International", city: "Cancún", country: "Mexico" },
  { code: "GDL", name: "Miguel Hidalgo y Costilla International", city: "Guadalajara", country: "Mexico" },
  { code: "MTY", name: "Monterrey International", city: "Monterrey", country: "Mexico" },
  { code: "SJD", name: "Los Cabos International", city: "Los Cabos", country: "Mexico" },
  { code: "PVR", name: "Puerto Vallarta International", city: "Puerto Vallarta", country: "Mexico" },
  { code: "MZT", name: "Mazatlán International", city: "Mazatlán", country: "Mexico" },
  { code: "OAX", name: "Xoxocotlán International", city: "Oaxaca", country: "Mexico" },
  { code: "NAS", name: "Lynden Pindling International", city: "Nassau", country: "Bahamas" },
  { code: "MBJ", name: "Sangster International", city: "Montego Bay", country: "Jamaica" },
  { code: "KIN", name: "Norman Manley International", city: "Kingston", country: "Jamaica" },
  { code: "POS", name: "Piarco International", city: "Port of Spain", country: "Trinidad" },
  { code: "BGI", name: "Grantley Adams International", city: "Bridgetown", country: "Barbados" },
  { code: "SXM", name: "Princess Juliana International", city: "Sint Maarten", country: "Sint Maarten" },
  { code: "HAV", name: "José Martí International", city: "Havana", country: "Cuba" },
  { code: "PTY", name: "Tocumen International", city: "Panama City", country: "Panama" },
  { code: "SJO", name: "Juan Santamaría International", city: "San José", country: "Costa Rica" },
  { code: "GUA", name: "La Aurora International", city: "Guatemala City", country: "Guatemala" },
  { code: "SAL", name: "El Salvador International", city: "San Salvador", country: "El Salvador" },
  { code: "BOG", name: "El Dorado International", city: "Bogotá", country: "Colombia" },
  { code: "MDE", name: "José María Córdova International", city: "Medellín", country: "Colombia" },
  { code: "CTG", name: "Rafael Núñez International", city: "Cartagena", country: "Colombia" },
  { code: "UIO", name: "Mariscal Sucre International", city: "Quito", country: "Ecuador" },
  { code: "GYE", name: "José Joaquín de Olmedo International", city: "Guayaquil", country: "Ecuador" },
  { code: "LIM", name: "Jorge Chávez International", city: "Lima", country: "Peru" },
  { code: "CUZ", name: "Alejandro Velasco Astete International", city: "Cusco", country: "Peru" },
  { code: "SCL", name: "Arturo Merino Benítez International", city: "Santiago", country: "Chile" },
  { code: "GRU", name: "São Paulo-Guarulhos International", city: "São Paulo", country: "Brazil" },
  { code: "GIG", name: "Rio de Janeiro-Galeão International", city: "Rio de Janeiro", country: "Brazil" },
  { code: "BSB", name: "Presidente Juscelino Kubitschek International", city: "Brasília", country: "Brazil" },
  { code: "EZE", name: "Ministro Pistarini International (Ezeiza)", city: "Buenos Aires", country: "Argentina" },
  { code: "MVD", name: "Carrasco International", city: "Montevideo", country: "Uruguay" },
  // Europe
  { code: "LHR", name: "Heathrow Airport", city: "London", country: "UK" },
  { code: "LGW", name: "Gatwick Airport", city: "London", country: "UK" },
  { code: "STN", name: "Stansted Airport", city: "London", country: "UK" },
  { code: "LCY", name: "London City Airport", city: "London", country: "UK" },
  { code: "MAN", name: "Manchester Airport", city: "Manchester", country: "UK" },
  { code: "EDI", name: "Edinburgh Airport", city: "Edinburgh", country: "UK" },
  { code: "GLA", name: "Glasgow Airport", city: "Glasgow", country: "UK" },
  { code: "BHX", name: "Birmingham Airport", city: "Birmingham", country: "UK" },
  { code: "CDG", name: "Charles de Gaulle Airport", city: "Paris", country: "France" },
  { code: "ORY", name: "Orly Airport", city: "Paris", country: "France" },
  { code: "NCE", name: "Côte d'Azur International", city: "Nice", country: "France" },
  { code: "LYS", name: "Lyon-Saint Exupéry Airport", city: "Lyon", country: "France" },
  { code: "MRS", name: "Provence Airport", city: "Marseille", country: "France" },
  { code: "TLS", name: "Toulouse-Blagnac Airport", city: "Toulouse", country: "France" },
  { code: "AMS", name: "Amsterdam Airport Schiphol", city: "Amsterdam", country: "Netherlands" },
  { code: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany" },
  { code: "MUC", name: "Munich Airport", city: "Munich", country: "Germany" },
  { code: "BER", name: "Berlin Brandenburg Airport", city: "Berlin", country: "Germany" },
  { code: "DUS", name: "Düsseldorf Airport", city: "Düsseldorf", country: "Germany" },
  { code: "HAM", name: "Hamburg Airport", city: "Hamburg", country: "Germany" },
  { code: "STR", name: "Stuttgart Airport", city: "Stuttgart", country: "Germany" },
  { code: "CGN", name: "Cologne Bonn Airport", city: "Cologne", country: "Germany" },
  { code: "ZRH", name: "Zurich Airport", city: "Zurich", country: "Switzerland" },
  { code: "GVA", name: "Geneva Airport", city: "Geneva", country: "Switzerland" },
  { code: "VIE", name: "Vienna International Airport", city: "Vienna", country: "Austria" },
  { code: "BRU", name: "Brussels Airport", city: "Brussels", country: "Belgium" },
  { code: "FCO", name: "Leonardo da Vinci (Fiumicino) Airport", city: "Rome", country: "Italy" },
  { code: "MXP", name: "Milan Malpensa Airport", city: "Milan", country: "Italy" },
  { code: "VCE", name: "Venice Marco Polo Airport", city: "Venice", country: "Italy" },
  { code: "FLR", name: "Florence Airport (Amerigo Vespucci)", city: "Florence", country: "Italy" },
  { code: "NAP", name: "Naples International Airport", city: "Naples", country: "Italy" },
  { code: "CTA", name: "Catania-Fontanarossa Airport", city: "Catania", country: "Italy" },
  { code: "PMO", name: "Palermo Airport", city: "Palermo", country: "Italy" },
  { code: "MAD", name: "Adolfo Suárez Madrid-Barajas Airport", city: "Madrid", country: "Spain" },
  { code: "BCN", name: "Barcelona-El Prat Airport", city: "Barcelona", country: "Spain" },
  { code: "AGP", name: "Málaga-Costa del Sol Airport", city: "Málaga", country: "Spain" },
  { code: "PMI", name: "Palma de Mallorca Airport", city: "Palma", country: "Spain" },
  { code: "VLC", name: "Valencia Airport", city: "Valencia", country: "Spain" },
  { code: "SVQ", name: "Seville Airport", city: "Seville", country: "Spain" },
  { code: "LIS", name: "Humberto Delgado Airport", city: "Lisbon", country: "Portugal" },
  { code: "OPO", name: "Francisco de Sá Carneiro Airport", city: "Porto", country: "Portugal" },
  { code: "FAO", name: "Faro Airport", city: "Faro", country: "Portugal" },
  { code: "FNC", name: "Madeira Airport", city: "Funchal", country: "Portugal" },
  { code: "OSL", name: "Oslo Gardermoen Airport", city: "Oslo", country: "Norway" },
  { code: "BGO", name: "Bergen Airport Flesland", city: "Bergen", country: "Norway" },
  { code: "TRD", name: "Trondheim Værnes Airport", city: "Trondheim", country: "Norway" },
  { code: "ARN", name: "Stockholm Arlanda Airport", city: "Stockholm", country: "Sweden" },
  { code: "GOT", name: "Gothenburg Landvetter Airport", city: "Gothenburg", country: "Sweden" },
  { code: "CPH", name: "Copenhagen Airport", city: "Copenhagen", country: "Denmark" },
  { code: "HEL", name: "Helsinki-Vantaa Airport", city: "Helsinki", country: "Finland" },
  { code: "KEF", name: "Keflavík International Airport", city: "Reykjavík", country: "Iceland" },
  { code: "DUB", name: "Dublin Airport", city: "Dublin", country: "Ireland" },
  { code: "SNN", name: "Shannon Airport", city: "Shannon", country: "Ireland" },
  { code: "WAW", name: "Warsaw Chopin Airport", city: "Warsaw", country: "Poland" },
  { code: "KRK", name: "Kraków John Paul II International", city: "Kraków", country: "Poland" },
  { code: "GDN", name: "Gdańsk Lech Wałęsa Airport", city: "Gdańsk", country: "Poland" },
  { code: "PRG", name: "Václav Havel Prague Airport", city: "Prague", country: "Czech Republic" },
  { code: "BUD", name: "Budapest Ferenc Liszt International", city: "Budapest", country: "Hungary" },
  { code: "BTS", name: "Bratislava Airport", city: "Bratislava", country: "Slovakia" },
  { code: "LJU", name: "Ljubljana Jože Pučnik Airport", city: "Ljubljana", country: "Slovenia" },
  { code: "ZAG", name: "Zagreb Airport", city: "Zagreb", country: "Croatia" },
  { code: "SPU", name: "Split Airport", city: "Split", country: "Croatia" },
  { code: "DBV", name: "Dubrovnik Airport", city: "Dubrovnik", country: "Croatia" },
  { code: "ATH", name: "Athens Eleftherios Venizelos International", city: "Athens", country: "Greece" },
  { code: "HER", name: "Heraklion International Airport", city: "Heraklion (Crete)", country: "Greece" },
  { code: "RHO", name: "Diagoras Airport", city: "Rhodes", country: "Greece" },
  { code: "SKG", name: "Thessaloniki Macedonia Airport", city: "Thessaloniki", country: "Greece" },
  { code: "IST", name: "Istanbul Airport", city: "Istanbul", country: "Turkey" },
  { code: "SAW", name: "Istanbul Sabiha Gökçen Airport", city: "Istanbul", country: "Turkey" },
  { code: "AYT", name: "Antalya Airport", city: "Antalya", country: "Turkey" },
  { code: "ADB", name: "Adnan Menderes Airport", city: "Izmir", country: "Turkey" },
  { code: "ESB", name: "Esenboğa International Airport", city: "Ankara", country: "Turkey" },
  { code: "OTP", name: "Henri Coandă International Airport", city: "Bucharest", country: "Romania" },
  { code: "SOF", name: "Sofia Airport", city: "Sofia", country: "Bulgaria" },
  { code: "TIA", name: "Tirana International Airport", city: "Tirana", country: "Albania" },
  { code: "SKP", name: "Skopje International Airport", city: "Skopje", country: "North Macedonia" },
  { code: "BEG", name: "Belgrade Nikola Tesla Airport", city: "Belgrade", country: "Serbia" },
  { code: "SJJ", name: "Sarajevo International Airport", city: "Sarajevo", country: "Bosnia" },
  { code: "TGD", name: "Podgorica Airport", city: "Podgorica", country: "Montenegro" },
  { code: "RIX", name: "Riga International Airport", city: "Riga", country: "Latvia" },
  { code: "TLL", name: "Lennart Meri Tallinn Airport", city: "Tallinn", country: "Estonia" },
  { code: "VNO", name: "Vilnius Airport", city: "Vilnius", country: "Lithuania" },
  { code: "KBP", name: "Boryspil International Airport", city: "Kyiv", country: "Ukraine" },
  { code: "SVO", name: "Sheremetyevo International Airport", city: "Moscow", country: "Russia" },
  { code: "DME", name: "Domodedovo International Airport", city: "Moscow", country: "Russia" },
  { code: "LED", name: "Pulkovo Airport", city: "St. Petersburg", country: "Russia" },
  { code: "MSQ", name: "Minsk National Airport", city: "Minsk", country: "Belarus" },
  // Middle East & Africa
  { code: "DXB", name: "Dubai International Airport", city: "Dubai", country: "UAE" },
  { code: "AUH", name: "Abu Dhabi International Airport", city: "Abu Dhabi", country: "UAE" },
  { code: "SHJ", name: "Sharjah International Airport", city: "Sharjah", country: "UAE" },
  { code: "DOH", name: "Hamad International Airport", city: "Doha", country: "Qatar" },
  { code: "KWI", name: "Kuwait International Airport", city: "Kuwait City", country: "Kuwait" },
  { code: "BAH", name: "Bahrain International Airport", city: "Manama", country: "Bahrain" },
  { code: "RUH", name: "King Khalid International Airport", city: "Riyadh", country: "Saudi Arabia" },
  { code: "JED", name: "King Abdulaziz International Airport", city: "Jeddah", country: "Saudi Arabia" },
  { code: "DMM", name: "King Fahd International Airport", city: "Dammam", country: "Saudi Arabia" },
  { code: "MCT", name: "Muscat International Airport", city: "Muscat", country: "Oman" },
  { code: "AMM", name: "Queen Alia International Airport", city: "Amman", country: "Jordan" },
  { code: "BEY", name: "Rafic Hariri International Airport", city: "Beirut", country: "Lebanon" },
  { code: "TLV", name: "Ben Gurion International Airport", city: "Tel Aviv", country: "Israel" },
  { code: "CAI", name: "Cairo International Airport", city: "Cairo", country: "Egypt" },
  { code: "HRG", name: "Hurghada International Airport", city: "Hurghada", country: "Egypt" },
  { code: "SSH", name: "Sharm el-Sheikh International Airport", city: "Sharm el-Sheikh", country: "Egypt" },
  { code: "CMN", name: "Mohammed V International Airport", city: "Casablanca", country: "Morocco" },
  { code: "RAK", name: "Marrakesh Menara Airport", city: "Marrakesh", country: "Morocco" },
  { code: "TUN", name: "Tunis-Carthage International Airport", city: "Tunis", country: "Tunisia" },
  { code: "ALG", name: "Houari Boumediene Airport", city: "Algiers", country: "Algeria" },
  { code: "LOS", name: "Murtala Muhammed International Airport", city: "Lagos", country: "Nigeria" },
  { code: "ABV", name: "Nnamdi Azikiwe International Airport", city: "Abuja", country: "Nigeria" },
  { code: "NBO", name: "Jomo Kenyatta International Airport", city: "Nairobi", country: "Kenya" },
  { code: "MBA", name: "Mombasa Moi International Airport", city: "Mombasa", country: "Kenya" },
  { code: "ADD", name: "Addis Ababa Bole International Airport", city: "Addis Ababa", country: "Ethiopia" },
  { code: "DAR", name: "Julius Nyerere International Airport", city: "Dar es Salaam", country: "Tanzania" },
  { code: "ZNZ", name: "Abeid Amani Karume International Airport", city: "Zanzibar", country: "Tanzania" },
  { code: "EBB", name: "Entebbe International Airport", city: "Entebbe", country: "Uganda" },
  { code: "KGL", name: "Kigali International Airport", city: "Kigali", country: "Rwanda" },
  { code: "JNB", name: "O.R. Tambo International Airport", city: "Johannesburg", country: "South Africa" },
  { code: "CPT", name: "Cape Town International Airport", city: "Cape Town", country: "South Africa" },
  { code: "DUR", name: "King Shaka International Airport", city: "Durban", country: "South Africa" },
  { code: "MPM", name: "Maputo International Airport", city: "Maputo", country: "Mozambique" },
  { code: "SEZ", name: "Seychelles International Airport", city: "Mahé", country: "Seychelles" },
  { code: "MLE", name: "Velana International Airport", city: "Malé", country: "Maldives" },
  { code: "RUN", name: "Roland Garros Airport", city: "Saint-Denis", country: "Réunion" },
  { code: "TNR", name: "Ivato International Airport", city: "Antananarivo", country: "Madagascar" },
  // South & Central Asia
  { code: "DEL", name: "Indira Gandhi International Airport", city: "New Delhi", country: "India" },
  { code: "BOM", name: "Chhatrapati Shivaji Maharaj International", city: "Mumbai", country: "India" },
  { code: "BLR", name: "Kempegowda International Airport", city: "Bengaluru", country: "India" },
  { code: "MAA", name: "Chennai International Airport", city: "Chennai", country: "India" },
  { code: "HYD", name: "Rajiv Gandhi International Airport", city: "Hyderabad", country: "India" },
  { code: "CCU", name: "Netaji Subhas Chandra Bose International", city: "Kolkata", country: "India" },
  { code: "COK", name: "Cochin International Airport", city: "Kochi", country: "India" },
  { code: "AMD", name: "Sardar Vallabhbhai Patel International", city: "Ahmedabad", country: "India" },
  { code: "GOI", name: "Goa International Airport (Dabolim)", city: "Goa", country: "India" },
  { code: "KTM", name: "Tribhuvan International Airport", city: "Kathmandu", country: "Nepal" },
  { code: "CMB", name: "Bandaranaike International Airport", city: "Colombo", country: "Sri Lanka" },
  { code: "DAC", name: "Hazrat Shahjalal International Airport", city: "Dhaka", country: "Bangladesh" },
  { code: "KHI", name: "Jinnah International Airport", city: "Karachi", country: "Pakistan" },
  { code: "LHE", name: "Allama Iqbal International Airport", city: "Lahore", country: "Pakistan" },
  { code: "ISB", name: "Islamabad International Airport", city: "Islamabad", country: "Pakistan" },
  { code: "TAS", name: "Tashkent International Airport", city: "Tashkent", country: "Uzbekistan" },
  { code: "ALA", name: "Almaty International Airport", city: "Almaty", country: "Kazakhstan" },
  { code: "TSE", name: "Astana International Airport", city: "Astana", country: "Kazakhstan" },
  { code: "TBS", name: "Tbilisi International Airport", city: "Tbilisi", country: "Georgia" },
  { code: "EVN", name: "Zvartnots International Airport", city: "Yerevan", country: "Armenia" },
  { code: "GYD", name: "Heydar Aliyev International Airport", city: "Baku", country: "Azerbaijan" },
  // East & Southeast Asia
  { code: "PEK", name: "Beijing Capital International Airport", city: "Beijing", country: "China" },
  { code: "PKX", name: "Beijing Daxing International Airport", city: "Beijing", country: "China" },
  { code: "PVG", name: "Shanghai Pudong International Airport", city: "Shanghai", country: "China" },
  { code: "SHA", name: "Shanghai Hongqiao International Airport", city: "Shanghai", country: "China" },
  { code: "CAN", name: "Guangzhou Baiyun International Airport", city: "Guangzhou", country: "China" },
  { code: "SZX", name: "Shenzhen Bao'an International Airport", city: "Shenzhen", country: "China" },
  { code: "CTU", name: "Chengdu Shuangliu International Airport", city: "Chengdu", country: "China" },
  { code: "KMG", name: "Kunming Changshui International Airport", city: "Kunming", country: "China" },
  { code: "XIY", name: "Xi'an Xianyang International Airport", city: "Xi'an", country: "China" },
  { code: "HKG", name: "Hong Kong International Airport", city: "Hong Kong", country: "Hong Kong" },
  { code: "TPE", name: "Taiwan Taoyuan International Airport", city: "Taipei", country: "Taiwan" },
  { code: "KHH", name: "Kaohsiung International Airport", city: "Kaohsiung", country: "Taiwan" },
  { code: "NRT", name: "Narita International Airport", city: "Tokyo", country: "Japan" },
  { code: "HND", name: "Haneda Airport", city: "Tokyo", country: "Japan" },
  { code: "KIX", name: "Kansai International Airport", city: "Osaka", country: "Japan" },
  { code: "ITM", name: "Osaka Itami Airport", city: "Osaka", country: "Japan" },
  { code: "NGO", name: "Chubu Centrair International Airport", city: "Nagoya", country: "Japan" },
  { code: "CTS", name: "New Chitose Airport", city: "Sapporo", country: "Japan" },
  { code: "FUK", name: "Fukuoka Airport", city: "Fukuoka", country: "Japan" },
  { code: "OKA", name: "Naha Airport", city: "Okinawa", country: "Japan" },
  { code: "HIJ", name: "Hiroshima Airport", city: "Hiroshima", country: "Japan" },
  { code: "ICN", name: "Incheon International Airport", city: "Seoul", country: "South Korea" },
  { code: "GMP", name: "Gimpo International Airport", city: "Seoul", country: "South Korea" },
  { code: "PUS", name: "Gimhae International Airport", city: "Busan", country: "South Korea" },
  { code: "CJU", name: "Jeju International Airport", city: "Jeju", country: "South Korea" },
  { code: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Thailand" },
  { code: "DMK", name: "Don Mueang International Airport", city: "Bangkok", country: "Thailand" },
  { code: "HKT", name: "Phuket International Airport", city: "Phuket", country: "Thailand" },
  { code: "CNX", name: "Chiang Mai International Airport", city: "Chiang Mai", country: "Thailand" },
  { code: "KBV", name: "Krabi International Airport", city: "Krabi", country: "Thailand" },
  { code: "USM", name: "Samui Airport", city: "Koh Samui", country: "Thailand" },
  { code: "SGN", name: "Tan Son Nhat International Airport", city: "Ho Chi Minh City", country: "Vietnam" },
  { code: "HAN", name: "Noi Bai International Airport", city: "Hanoi", country: "Vietnam" },
  { code: "DAD", name: "Da Nang International Airport", city: "Da Nang", country: "Vietnam" },
  { code: "PNH", name: "Phnom Penh International Airport", city: "Phnom Penh", country: "Cambodia" },
  { code: "REP", name: "Siem Reap International Airport", city: "Siem Reap", country: "Cambodia" },
  { code: "RGN", name: "Yangon International Airport", city: "Yangon", country: "Myanmar" },
  { code: "KUL", name: "Kuala Lumpur International Airport", city: "Kuala Lumpur", country: "Malaysia" },
  { code: "PEN", name: "Penang International Airport", city: "Penang", country: "Malaysia" },
  { code: "BKI", name: "Kota Kinabalu International Airport", city: "Kota Kinabalu", country: "Malaysia" },
  { code: "SIN", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore" },
  { code: "CGK", name: "Soekarno-Hatta International Airport", city: "Jakarta", country: "Indonesia" },
  { code: "DPS", name: "Ngurah Rai International Airport", city: "Bali", country: "Indonesia" },
  { code: "SUB", name: "Juanda International Airport", city: "Surabaya", country: "Indonesia" },
  { code: "LOP", name: "Lombok International Airport", city: "Lombok", country: "Indonesia" },
  { code: "MNL", name: "Ninoy Aquino International Airport", city: "Manila", country: "Philippines" },
  { code: "CEB", name: "Mactan-Cebu International Airport", city: "Cebu", country: "Philippines" },
  { code: "DVO", name: "Francisco Bangoy International Airport", city: "Davao", country: "Philippines" },
  // Oceania & Pacific
  { code: "SYD", name: "Sydney Kingsford Smith Airport", city: "Sydney", country: "Australia" },
  { code: "MEL", name: "Melbourne Airport", city: "Melbourne", country: "Australia" },
  { code: "BNE", name: "Brisbane Airport", city: "Brisbane", country: "Australia" },
  { code: "PER", name: "Perth Airport", city: "Perth", country: "Australia" },
  { code: "ADL", name: "Adelaide Airport", city: "Adelaide", country: "Australia" },
  { code: "CNS", name: "Cairns Airport", city: "Cairns", country: "Australia" },
  { code: "OOL", name: "Gold Coast Airport", city: "Gold Coast", country: "Australia" },
  { code: "AKL", name: "Auckland Airport", city: "Auckland", country: "New Zealand" },
  { code: "CHC", name: "Christchurch Airport", city: "Christchurch", country: "New Zealand" },
  { code: "WLG", name: "Wellington Airport", city: "Wellington", country: "New Zealand" },
  { code: "NAN", name: "Nadi International Airport", city: "Nadi", country: "Fiji" },
  { code: "PPT", name: "Faa'a International Airport", city: "Papeete", country: "French Polynesia" },
  { code: "BOB", name: "Bora Bora Airport", city: "Bora Bora", country: "French Polynesia" },
  { code: "GUM", name: "Antonio B. Won Pat International", city: "Guam", country: "Guam" },
];

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahamas","Bahrain","Bangladesh","Belarus","Belgium","Belize","Bolivia","Bosnia & Herzegovina","Brazil","Bulgaria",
  "Cambodia","Canada","Chile","China","Colombia","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic",
  "Denmark","Dominican Republic","Ecuador","Egypt","El Salvador","Estonia","Ethiopia",
  "Finland","France","Georgia","Germany","Ghana","Greece","Guatemala","Honduras","Hungary",
  "Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait",
  "Latvia","Lebanon","Lithuania","Luxembourg","Malaysia","Mexico","Morocco","Myanmar",
  "Nepal","Netherlands","New Zealand","Nigeria","Norway",
  "Pakistan","Panama","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia",
  "Saudi Arabia","Senegal","Serbia","Singapore","Slovakia","Slovenia","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland",
  "Taiwan","Tanzania","Thailand","Tunisia","Turkey",
  "UAE","Ukraine","United Kingdom","United States","Uruguay","Uzbekistan",
  "Venezuela","Vietnam","Yemen","Zimbabwe",
];

interface FamilyProfileData {
  familyName: string;
  homeCity: string;
  state: string;
  homeCountry: string;
  favoriteAirports: string;
  travelFrequency: string;
  accessibilityNotes: string;
}

const INTEREST_CATEGORIES = [
  {
    label: "Food & Drink",
    tiles: [
      { key: "street_food", label: "Street food" },
      { key: "fine_dining", label: "Fine dining" },
      { key: "local_markets", label: "Local markets" },
      { key: "cooking_classes", label: "Cooking classes" },
      { key: "coffee_culture", label: "Coffee culture" },
      { key: "wine_spirits", label: "Wine & spirits" },
      { key: "food_tours", label: "Food tours" },
      { key: "farm_to_table", label: "Farm to table" },
    ],
  },
  {
    label: "Outdoor & Adventure",
    tiles: [
      { key: "hiking", label: "Hiking" },
      { key: "beach", label: "Beach" },
      { key: "surfing", label: "Surfing" },
      { key: "skiing", label: "Skiing & snowboarding" },
      { key: "cycling", label: "Cycling" },
      { key: "camping", label: "Camping" },
      { key: "water_sports", label: "Water sports" },
      { key: "rock_climbing", label: "Rock climbing" },
      { key: "national_parks", label: "National parks" },
      { key: "safari", label: "Safari" },
    ],
  },
  {
    label: "Culture & History",
    tiles: [
      { key: "museums", label: "Museums" },
      { key: "art_galleries", label: "Art galleries" },
      { key: "architecture", label: "Architecture" },
      { key: "historical_sites", label: "Historical sites" },
      { key: "local_festivals", label: "Local festivals" },
      { key: "theatre", label: "Theatre & performance" },
      { key: "religious_sites", label: "Religious sites" },
      { key: "unesco_sites", label: "UNESCO sites" },
    ],
  },
  {
    label: "Kids & Family",
    tiles: [
      { key: "theme_parks", label: "Theme parks" },
      { key: "zoos", label: "Zoos & aquariums" },
      { key: "science_centres", label: "Science centres" },
      { key: "kids_museums", label: "Kids museums" },
      { key: "playgrounds", label: "Playgrounds & parks" },
      { key: "water_parks", label: "Water parks" },
      { key: "wildlife_encounters", label: "Wildlife encounters" },
      { key: "hands_on_workshops", label: "Hands-on workshops" },
    ],
  },
  {
    label: "Entertainment",
    tiles: [
      { key: "live_music", label: "Live music" },
      { key: "sports_events", label: "Sports events" },
      { key: "nightlife", label: "Nightlife" },
      { key: "cinemas", label: "Cinemas" },
      { key: "comedy_shows", label: "Comedy shows" },
      { key: "escape_rooms", label: "Escape rooms" },
      { key: "gaming_arcades", label: "Gaming & arcades" },
      { key: "seasonal_events", label: "Seasonal events" },
    ],
  },
  {
    label: "Wellness & Relaxation",
    tiles: [
      { key: "spas", label: "Spa & wellness" },
      { key: "yoga", label: "Yoga & meditation" },
      { key: "hot_springs", label: "Hot springs" },
      { key: "slow_travel", label: "Slow travel" },
      { key: "scenic_drives", label: "Scenic drives" },
      { key: "luxury_stays", label: "Luxury stays" },
      { key: "private_beaches", label: "Private beaches" },
    ],
  },
  {
    label: "Shopping & Style",
    tiles: [
      { key: "boutiques", label: "Local boutiques" },
      { key: "markets_bazaars", label: "Markets & bazaars" },
      { key: "designer_shopping", label: "Designer shopping" },
      { key: "vintage", label: "Vintage & thrift" },
      { key: "artisan_crafts", label: "Artisan crafts" },
      { key: "bookshops", label: "Bookshops" },
    ],
  },
];

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8E8E8",
  padding: "24px",
};

// ── Airport Picker ──────────────────────────────────────────────────────────

function AirportPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedCodes = value ? value.split(",").map((c) => c.trim()).filter(Boolean) : [];

  const q = query.toLowerCase();
  const filtered = q.length === 0 ? [] : AIRPORTS.filter(
    (a) =>
      !selectedCodes.includes(a.code) &&
      (a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q))
  ).slice(0, 8);

  function addAirport(code: string) {
    if (selectedCodes.length >= 10) return;
    onChange([...selectedCodes, code].join(","));
    setQuery("");
    setOpen(false);
  }

  function removeAirport(code: string) {
    onChange(selectedCodes.filter((c) => c !== code).join(","));
  }

  function getAirport(code: string) {
    return AIRPORTS.find((a) => a.code === code);
  }

  const inputCls = "w-full border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#1B3A5C] focus:outline-none focus:border-[#1B3A5C] bg-white";

  return (
    <div>
      {selectedCodes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {selectedCodes.map((code) => {
            const airport = getAirport(code);
            return (
              <span
                key={code}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  backgroundColor: "rgba(27,58,92,0.07)", color: "#1B3A5C",
                  fontSize: "12px", fontWeight: 600, padding: "4px 8px 4px 10px",
                  borderRadius: "999px", border: "1px solid rgba(27,58,92,0.15)",
                }}
              >
                <span>{code}</span>
                {airport && (
                  <span style={{ fontWeight: 400, color: "#717171" }}>· {airport.city}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeAirport(code)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "0 0 0 3px", lineHeight: 1, display: "flex", alignItems: "center",
                  }}
                >
                  <X size={11} style={{ color: "#717171" }} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {selectedCodes.length < 10 ? (
        <div style={{ position: "relative" }}>
          <input
            className={inputCls}
            placeholder="Search by code, city, or airport name..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
          />
          {open && filtered.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              backgroundColor: "#fff", border: "1px solid #E8E8E8", borderRadius: "8px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.1)", zIndex: 200,
              maxHeight: "256px", overflowY: "auto",
            }}>
              {filtered.map((airport, i) => (
                <button
                  key={airport.code}
                  type="button"
                  onMouseDown={() => addAirport(airport.code)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    width: "100%", padding: "10px 14px", border: "none",
                    background: "none", cursor: "pointer", textAlign: "left",
                    borderBottom: i < filtered.length - 1 ? "1px solid #F5F5F5" : "none",
                  }}
                >
                  <span style={{
                    fontSize: "12px", fontWeight: 700, color: "#fff",
                    backgroundColor: "#1B3A5C", padding: "2px 6px",
                    borderRadius: "4px", minWidth: "40px", textAlign: "center",
                    flexShrink: 0,
                  }}>
                    {airport.code}
                  </span>
                  <span style={{ fontSize: "13px", color: "#1a1a1a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {airport.name}
                  </span>
                  <span style={{ fontSize: "12px", color: "#717171", flexShrink: 0 }}>
                    {airport.city}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: "12px", color: "#717171", margin: 0 }}>Maximum of 10 airports selected.</p>
      )}
    </div>
  );
}

// ── Interests card ──────────────────────────────────────────────────────────

function InterestsCard() {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile/interests")
      .then((r) => r.json())
      .then(({ interestKeys }) => {
        if (Array.isArray(interestKeys)) setSelectedKeys(new Set(interestKeys));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggle(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setError("");
  }

  async function handleSave() {
    const keys = Array.from(selectedKeys);
    if (keys.length < 3) {
      setError("Please select at least 3 interests to save.");
      return;
    }
    setError("");
    setSaving(true);
    const res = await fetch("/api/profile/interests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interestKeys: keys }),
    });
    setSaving(false);
    if (res.ok) {
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    }
  }

  if (loading) return null;

  return (
    <div style={{ ...cardStyle, marginTop: "24px" }}>
      {toast && (
        <div style={{
          position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#C4664A", color: "#fff", fontSize: "13px", fontWeight: 600,
          padding: "8px 20px", borderRadius: "999px", zIndex: 9999, pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          Interests saved
        </div>
      )}

      <p style={{ fontSize: "18px", fontWeight: 600, color: "#1B3A5C", margin: 0 }}>Travel interests</p>
      <p style={{ fontSize: "14px", color: "#717171", marginTop: "4px", marginBottom: "24px", lineHeight: 1.5 }}>
        Select everything that sounds like your family. The more you choose, the better your recommendations.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {INTEREST_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <p style={{
              fontSize: "11px", fontWeight: 600, color: "#717171",
              textTransform: "uppercase", letterSpacing: "0.08em",
              margin: "0 0 10px",
            }}>
              {cat.label}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {cat.tiles.map((tile) => {
                const active = selectedKeys.has(tile.key);
                return (
                  <button
                    key={tile.key}
                    onClick={() => toggle(tile.key)}
                    style={{
                      padding: "7px 16px", borderRadius: "999px", fontSize: "14px",
                      border: `1px solid ${active ? "#1B3A5C" : "#E8E8E8"}`,
                      backgroundColor: active ? "#1B3A5C" : "#fff",
                      color: active ? "#fff" : "#717171",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {tile.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p style={{ color: "#e53e3e", fontSize: "13px", marginTop: "16px", marginBottom: 0 }}>{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          backgroundColor: "#C4664A", color: "#fff", border: "none",
          borderRadius: "8px", padding: "9px 20px", fontSize: "14px",
          fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1, marginTop: "24px",
        }}
      >
        {saving ? "Saving..." : `Save interests (${selectedKeys.size} selected)`}
      </button>
    </div>
  );
}

// ── Family details form ─────────────────────────────────────────────────────

export function FamilySection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [form, setForm] = useState<FamilyProfileData>({
    familyName: "",
    homeCity: "",
    state: "",
    homeCountry: "",
    favoriteAirports: "",
    travelFrequency: "",
    accessibilityNotes: "",
  });

  useEffect(() => {
    fetch("/api/family/profile")
      .then((r) => r.json())
      .then(({ familyProfile }) => {
        if (familyProfile) {
          setForm({
            familyName: familyProfile.familyName || "",
            homeCity: familyProfile.homeCity || "",
            state: familyProfile.state || "",
            homeCountry: familyProfile.homeCountry || "",
            favoriteAirports: familyProfile.favoriteAirports || "",
            travelFrequency: familyProfile.travelFrequency || "",
            accessibilityNotes: familyProfile.accessibilityNotes || "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/family/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  }

  function field(key: keyof Omit<FamilyProfileData, "favoriteAirports">) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  if (loading) return <p style={{ color: "#717171", fontSize: "14px" }}>Loading...</p>;

  const inputCls = "w-full border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#1B3A5C] focus:outline-none focus:border-[#1B3A5C] bg-white";
  const labelCls = "block text-xs font-semibold text-[#717171] uppercase tracking-wide mb-1";

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#1B3A5C", color: "#fff", fontSize: "13px", fontWeight: 600,
          padding: "8px 20px", borderRadius: "999px", zIndex: 9999, pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          Changes saved
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <div>
          <label className={labelCls}>Family name</label>
          <input className={inputCls} placeholder="The Greenes" {...field("familyName")} />
        </div>
        <div>
          <label className={labelCls}>Home city</label>
          <input className={inputCls} placeholder="Kamakura" {...field("homeCity")} />
        </div>
        <div>
          <label className={labelCls}>State</label>
          <select className={inputCls} {...field("state")}>
            <option value="" disabled>Select state...</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Home country</label>
          <select className={inputCls} {...field("homeCountry")}>
            <option value="">Select country...</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Travel frequency</label>
          <select className={inputCls} {...field("travelFrequency")}>
            <option value="">Select...</option>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <label className={labelCls}>Favorite airport(s) <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— up to 10</span></label>
          <AirportPicker
            value={form.favoriteAirports}
            onChange={(v) => setForm((f) => ({ ...f, favoriteAirports: v }))}
          />
        </div>
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <label className={labelCls}>Accessibility needs</label>
          <textarea
            className={inputCls + " resize-y"}
            rows={2}
            placeholder="Any mobility, sensory, or other accessibility needs we should know about"
            {...field("accessibilityNotes")}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          backgroundColor: "#1B3A5C", color: "#fff", border: "none",
          borderRadius: "8px", padding: "9px 24px", fontSize: "14px",
          fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1, marginTop: "16px",
        }}
      >
        {saving ? "Saving..." : "Save changes"}
      </button>

      <SenderEmailsCard />
      <InterestsCard />
    </div>
  );
}

// ── Sender emails ─────────────────────────────────────────────────────────────

type PendingVerification = { id: string; email: string; createdAt: string };

function SenderEmailsCard() {
  const [emails, setEmails] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingVerification[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetch("/api/profile/sender-emails")
      .then((r) => r.json())
      .then((d: { senderEmails?: string[]; pending?: PendingVerification[] }) => {
        setEmails(d.senderEmails ?? []);
        setPending(d.pending ?? []);
      })
      .catch(() => {});
  }, []);

  async function handleAdd() {
    const e = newEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) { setError("Enter a valid email address."); return; }
    setAdding(true);
    setError("");
    setSuccessMsg("");
    const res = await fetch("/api/profile/sender-emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", email: e }),
    });
    const d = await res.json() as { senderEmails?: string[]; pending?: PendingVerification[]; sent?: boolean; alreadyVerified?: boolean; error?: string };
    if (d.error) { setError(d.error); }
    else if (d.alreadyVerified) { setError("This email is already verified."); }
    else {
      setEmails(d.senderEmails ?? emails);
      setPending(d.pending ?? pending);
      setNewEmail("");
      setSuccessMsg(`Verification email sent to ${e}`);
    }
    setAdding(false);
  }

  async function handleRemove(email: string) {
    const res = await fetch("/api/profile/sender-emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", email }),
    });
    const d = await res.json() as { senderEmails?: string[] };
    if (d.senderEmails !== undefined) {
      setEmails(d.senderEmails);
      setPending(prev => prev.filter(p => p.email !== email));
    }
  }

  async function handleResend(email: string) {
    setResending(email);
    setSuccessMsg("");
    const res = await fetch("/api/profile/sender-emails", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend", email }),
    });
    const d = await res.json() as { pending?: PendingVerification[]; sent?: boolean };
    if (d.pending) setPending(d.pending);
    if (d.sent) setSuccessMsg(`Verification email resent to ${email}`);
    setResending(null);
  }

  const labelCls = "block text-xs font-semibold text-[#717171] uppercase tracking-wide mb-1";
  const inputCls = "flex-1 border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm text-[#1B3A5C] focus:outline-none focus:border-[#1B3A5C] bg-white";

  return (
    <div style={{ marginTop: "32px", borderTop: "1px solid #F0F0F0", paddingTop: "28px" }}>
      <p className={labelCls} style={{ marginBottom: "4px" }}>Approved sender emails</p>
      <p style={{ fontSize: "13px", color: "#717171", marginBottom: "16px", lineHeight: 1.5 }}>
        Booking confirmation emails forwarded from these addresses will be auto-imported. Each address must be verified before it can be used.
      </p>

      {/* Verified emails */}
      {emails.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {emails.map((e) => (
            <div key={e} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#F0FAF2", borderRadius: "8px", border: "1px solid rgba(74,124,89,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4a7c59", backgroundColor: "rgba(74,124,89,0.12)", borderRadius: "999px", padding: "1px 7px" }}>Verified ✓</span>
                <span style={{ fontSize: "13px", color: "#1B3A5C" }}>{e}</span>
              </div>
              <button onClick={() => handleRemove(e)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#AAAAAA", lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Pending verifications */}
      {pending.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {pending.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#FFFBF0", borderRadius: "8px", border: "1px solid rgba(245,158,11,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#92650a", backgroundColor: "rgba(245,158,11,0.12)", borderRadius: "999px", padding: "1px 7px", whiteSpace: "nowrap" }}>Awaiting verification</span>
                <span style={{ fontSize: "13px", color: "#555" }}>{p.email}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <button
                  onClick={() => handleResend(p.email)}
                  disabled={resending === p.email}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#1B3A5C", fontWeight: 600, padding: "2px 4px", opacity: resending === p.email ? 0.5 : 1 }}
                >
                  {resending === p.email ? "Sending…" : "Resend"}
                </button>
                <button onClick={() => handleRemove(p.email)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#AAAAAA", lineHeight: 1, padding: "0 4px" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={newEmail}
          onChange={(e) => { setNewEmail(e.target.value); setError(""); setSuccessMsg(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          className={inputCls}
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#1B3A5C", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: adding ? "not-allowed" : "pointer", opacity: adding ? 0.7 : 1, whiteSpace: "nowrap" }}
        >
          {adding ? "Sending…" : "Add email"}
        </button>
      </div>
      {error && <p style={{ fontSize: "12px", color: "#C4664A", marginTop: "6px" }}>{error}</p>}
      {successMsg && <p style={{ fontSize: "12px", color: "#4a7c59", marginTop: "6px" }}>{successMsg}</p>}
    </div>
  );
}
