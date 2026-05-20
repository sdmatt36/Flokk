/**
 * One-shot verification: INSUFFICIENT_STOPS deterministic guard.
 * Calls gradeTour directly with synthetic stop arrays — no route, no DB.
 * Run: npx tsx scripts/test-insufficient-stops.mts
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gradeTour, type GraderStop, type GraderFamilyContext, type GraderGenerationInputs } from "../src/lib/tour-grader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });

const familyCtx: GraderFamilyContext = { ages: [], dietary: [], foodAllergies: [], pace: null, travelStyle: null, interestKeys: [] };
const inputs4hr: GraderGenerationInputs = { prompt: "best coffee in Tokyo", transport: "Walking", inputGroup: "solo", inputVibe: [], inputDurationHr: 4 };

const oneStop: GraderStop[] = [{
  placeId: "ChIJ_fake_001", name: "Fuglen Tokyo", lat: 35.6938, lng: 139.7034,
  placeTypes: ["cafe"], businessStatus: "OPERATIONAL", why: "World-class Scandinavian coffee", familyNote: null,
}];

const fourStops: GraderStop[] = [
  { placeId: "ChIJ_fake_001", name: "Fuglen Tokyo", lat: 35.6938, lng: 139.7034, placeTypes: ["cafe"], businessStatus: "OPERATIONAL", why: "Renowned pour-over coffee", familyNote: null },
  { placeId: "ChIJ_fake_002", name: "Bear Pond Espresso", lat: 35.6900, lng: 139.6990, placeTypes: ["cafe"], businessStatus: "OPERATIONAL", why: "Cult-status espresso", familyNote: null },
  { placeId: "ChIJ_fake_003", name: "Onibus Coffee Nakameguro", lat: 35.6440, lng: 139.6990, placeTypes: ["cafe"], businessStatus: "OPERATIONAL", why: "Third-wave specialty coffee", familyNote: null },
  { placeId: "ChIJ_fake_004", name: "Streamer Coffee", lat: 35.6580, lng: 139.6970, placeTypes: ["cafe"], businessStatus: "OPERATIONAL", why: "Latte art pioneers in Tokyo", familyNote: null },
];

console.log("\n=== CASE 1: Degenerate — 1 stop, 4hr tour (requires min 3) ===");
const r1 = await gradeTour(oneStop, familyCtx, inputs4hr);
const insuffFlag1 = r1.flags.find(f => f.code === "INSUFFICIENT_STOPS");
console.log(`stops=1  score=${r1.score}  hardFail/regenerate=${r1.regenerate}  INSUFFICIENT_STOPS=${!!insuffFlag1}`);
if (insuffFlag1) console.log(`  flag detail: ${insuffFlag1.detail}`);
console.log(`  all flags: ${r1.flags.map(f => f.code).join(", ") || "(none)"}`);

console.log("\n=== CASE 2: Healthy — 4 stops, 4hr tour (requires min 3) ===");
const r2 = await gradeTour(fourStops, familyCtx, inputs4hr);
const insuffFlag2 = r2.flags.find(f => f.code === "INSUFFICIENT_STOPS");
console.log(`stops=4  score=${r2.score}  hardFail/regenerate=${r2.regenerate}  INSUFFICIENT_STOPS=${!!insuffFlag2}`);
console.log(`  all flags: ${r2.flags.map(f => f.code).join(", ") || "(none)"}`);

console.log("\n=== SUMMARY ===");
console.log([
  "Case".padEnd(30), "Stops".padStart(6), "INSUFF flag".padStart(12), "Score".padStart(6), "Regen forced".padStart(13),
].join(""));
console.log("-".repeat(70));
console.log(["Degenerate (1 stop, 4hr)".padEnd(30), "1".padStart(6), (!!insuffFlag1 ? "YES (critical)":"no").padStart(12), String(r1.score).padStart(6), String(r1.regenerate).padStart(13)].join(""));
console.log(["Healthy (4 stops, 4hr)".padEnd(30), "4".padStart(6), (!!insuffFlag2 ? "YES (critical)":"no").padStart(12), String(r2.score).padStart(6), String(r2.regenerate).padStart(13)].join(""));
