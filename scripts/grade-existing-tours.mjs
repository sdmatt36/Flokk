/**
 * grade-existing-tours.mjs
 *
 * Grader V1 baseline run: grades all non-deleted GeneratedTour rows.
 * Report-only mode — no regeneration. Writes graderScore/graderFlags/graderStatus/graderRanAt.
 *
 * Usage:
 *   node scripts/grade-existing-tours.mjs
 */

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv(filename) {
  try {
    for (const line of readFileSync(join(root, filename), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* file missing */ }
}
loadEnv(".env.local");
loadEnv(".env.production");

const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── Geo helper ────────────────────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function maxRadiusKm(transport) {
  const t = (transport || "").toLowerCase();
  if (t === "walking") return 8;
  if (t.includes("transit") || t.includes("metro")) return 25;
  if (t.includes("car") || t.includes("driving")) return 50;
  return 15;
}

// ── Deterministic grader checks ───────────────────────────────────────────────
function normalizeName(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function checkDuplicates(stops) {
  const flags = [];
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const a = stops[i], b = stops[j];
      if (a.placeId && b.placeId && a.placeId === b.placeId) {
        flags.push({ code: "DUP_STOP", severity: "high", detail: `Stops ${i+1} and ${j+1} share placeId ${a.placeId}` });
        continue;
      }
      if (normalizeName(a.name) === normalizeName(b.name)) {
        flags.push({ code: "DUP_STOP", severity: "high", detail: `Stops ${i+1} "${a.name}" and ${j+1} "${b.name}" normalize identically` });
        continue;
      }
      if (a.lat && a.lng && b.lat && b.lng) {
        const distM = haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) * 1000;
        if (distM <= 50 && (a.placeTypes || []).some(t => (b.placeTypes || []).includes(t))) {
          flags.push({ code: "DUP_STOP", severity: "high", detail: `Stops ${i+1} "${a.name}" and ${j+1} "${b.name}" are ${Math.round(distM)}m apart with overlapping types` });
        }
      }
    }
  }
  return flags;
}

function checkGeoIncoherence(stops, transport) {
  const maxKm = maxRadiusKm(transport);
  const flags = [];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i-1], curr = stops[i];
    if (prev.lat && prev.lng && curr.lat && curr.lng) {
      const dist = haversineKm({ lat: prev.lat, lng: prev.lng }, { lat: curr.lat, lng: curr.lng });
      if (dist > maxKm) {
        flags.push({ code: "GEO_INCOHERENT", severity: "high", detail: `Stop ${i} "${prev.name}" → Stop ${i+1} "${curr.name}": ${dist.toFixed(1)}km exceeds ${maxKm}km for ${transport}` });
      }
    }
  }
  return flags;
}

function checkClosedVenues(stops) {
  const flags = [];
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (s.businessStatus === "CLOSED_PERMANENTLY") {
      flags.push({ code: "CLOSED_VENUE", severity: "critical", detail: `Stop ${i+1} "${s.name}" is permanently closed` });
    } else if (s.businessStatus === "CLOSED_TEMPORARILY") {
      flags.push({ code: "CLOSED_VENUE", severity: "medium", detail: `Stop ${i+1} "${s.name}" is temporarily closed` });
    }
  }
  return flags;
}

function isHardFail(flags) {
  const criticals = flags.filter(f => f.severity === "critical").length;
  const highs = flags.filter(f => f.severity === "high").length;
  return criticals > 0 || highs >= 2;
}

// ── Judgment call ─────────────────────────────────────────────────────────────
async function runJudgment(stops, familyCtx, inputs) {
  const contextLines = [
    `Tour theme: "${inputs.prompt}"`,
    `Transport: ${inputs.transport}`,
    `Group type: ${inputs.inputGroup}`,
    inputs.inputVibe?.length > 0 ? `Vibe tags: ${inputs.inputVibe.join(", ")}` : null,
    inputs.inputDurationHr ? `Duration: ${inputs.inputDurationHr} hours` : null,
    familyCtx.ages?.length > 0 ? `Children aged: ${familyCtx.ages.join(", ")}` : null,
    familyCtx.dietary?.length > 0 ? `Dietary requirements: ${familyCtx.dietary.join(", ")}` : null,
    familyCtx.foodAllergies?.length > 0 ? `Food allergies (hard constraint): ${familyCtx.foodAllergies.join(", ")}` : null,
    familyCtx.travelStyle ? `Travel style: ${familyCtx.travelStyle}` : null,
    familyCtx.pace ? `Pace: ${familyCtx.pace}` : null,
    familyCtx.interestKeys?.length > 0 ? `Interests: ${familyCtx.interestKeys.join(", ")}` : null,
    `\nProposed stops (${stops.length} total):`,
    ...stops.map((s, i) =>
      `${i+1}. ${s.name} [types: ${(s.placeTypes || []).slice(0, 3).join(", ") || "unknown"}]\n   Why: ${s.why || "(none)"}\n   Note: ${s.familyNote || "(none)"}`
    ),
  ].filter(Boolean).join("\n");

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: `You are a tour quality grader. Score the proposed tour STRICTLY against the provided context.
- familyFitScore: how well stops fit the given family (ages, dietary restrictions, food allergies, interests, pace). Never penalize for context NOT given to you.
- themeIntentScore: how directly each stop serves the stated tour theme. Vague or tangential stops drag this score down.
- Be strict. A stop that is age-inappropriate, allergen-conflicting, or off-theme is a real problem.
- Do NOT hallucinate context. If a field is absent, ignore it — do not penalize.`,
    tools: [{
      name: "emit_grade",
      description: "Emit quality scores for the proposed tour.",
      input_schema: {
        type: "object",
        properties: {
          familyFitScore: { type: "number", description: "0-100. How well do stops serve the provided family context? If no family context given, score 70 (neutral)." },
          themeIntentScore: { type: "number", description: "0-100. How directly do stops serve the stated tour theme? Penalize off-theme stops harshly." },
          reasons: { type: "array", items: { type: "string" }, description: "2-4 specific reasons explaining your scores." },
        },
        required: ["familyFitScore", "themeIntentScore", "reasons"],
      },
    }],
    tool_choice: { type: "tool", name: "emit_grade" },
    messages: [{ role: "user", content: contextLines }],
  });

  const block = resp.content.find(b => b.type === "tool_use" && b.name === "emit_grade");
  if (!block) return { familyFitScore: 70, themeIntentScore: 70, reasons: [] };
  const raw = block.input;
  return {
    familyFitScore: Math.max(0, Math.min(100, Number(raw.familyFitScore ?? 70))),
    themeIntentScore: Math.max(0, Math.min(100, Number(raw.themeIntentScore ?? 70))),
    reasons: Array.isArray(raw.reasons) ? raw.reasons : [],
  };
}

async function gradeTour(stops, familyCtx, inputs) {
  const flags = [
    ...checkDuplicates(stops),
    ...checkGeoIncoherence(stops, inputs.transport),
    ...checkClosedVenues(stops),
  ];
  const hardFail = isHardFail(flags);
  let score = 70, reasons = [];
  try {
    const j = await runJudgment(stops, familyCtx, inputs);
    score = Math.round(0.6 * j.familyFitScore + 0.4 * j.themeIntentScore);
    reasons = j.reasons;
  } catch (err) {
    console.error(`  [judgment-fail] ${err.message}`);
  }
  const regenerate = hardFail || score < 70;
  return { score, flags, reasons, regenerate };
}

// ── Age computation ───────────────────────────────────────────────────────────
function ageFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Flokk Grader V1 — Baseline Run (all non-deleted tours) ===\n");

  const client = await pool.connect();

  try {
    // Fetch all non-deleted tours
    const { rows: tours } = await client.query(`
      SELECT id, title, "destinationCity", prompt, transport, "inputGroup",
             "inputVibe", "inputDurationHr", "familyProfileId", "createdAt"
      FROM "GeneratedTour"
      WHERE "deletedAt" IS NULL
      ORDER BY "createdAt" ASC
    `);

    console.log(`Found ${tours.length} tours to grade.\n`);
    const results = [];

    for (const tour of tours) {
      const { rows: stops } = await client.query(`
        SELECT id, name, lat, lng, "placeId", "placeTypes", why, "familyNote"
        FROM "TourStop"
        WHERE "tourId" = $1 AND "deletedAt" IS NULL
        ORDER BY "orderIndex" ASC
      `, [tour.id]);

      process.stdout.write(`Grading [${tour.id.slice(-8)}] "${(tour.title || "").slice(0, 40)}" (${tour.destinationCity}) — ${stops.length} stops ... `);

      if (stops.length === 0) {
        console.log("SKIP (0 stops)");
        results.push({ tour, score: null, status: "no_stops", flags: [], reasons: [] });
        continue;
      }

      // Build family context from profile
      const isNoChildren = ["adults_only", "solo", "couple", "friends"].includes(tour.inputGroup ?? "");
      let familyCtx = { ages: [], dietary: [], foodAllergies: [], pace: null, travelStyle: null, interestKeys: [] };

      if (!isNoChildren && tour.familyProfileId) {
        try {
          const { rows: members } = await client.query(`
            SELECT role, "birthDate", "dietaryRequirements", "foodAllergies"
            FROM "FamilyMember"
            WHERE "familyProfileId" = $1
          `, [tour.familyProfileId]);

          const { rows: interests } = await client.query(`
            SELECT "interestKey" FROM "DeclaredInterest" WHERE "familyProfileId" = $1
          `, [tour.familyProfileId]);

          const { rows: profiles } = await client.query(`
            SELECT pace, "travelStyle" FROM "FamilyProfile" WHERE id = $1
          `, [tour.familyProfileId]);

          const ages = members
            .filter(m => m.role === "CHILD")
            .map(m => ageFromBirthDate(m.birthDate))
            .filter(a => a !== null);

          const allDietary = [...new Set(members.flatMap(m => m.dietaryRequirements || []))];
          const allAllergies = [...new Set(members.flatMap(m => m.foodAllergies || []))];

          familyCtx = {
            ages,
            dietary: allDietary,
            foodAllergies: allAllergies,
            pace: profiles[0]?.pace ?? null,
            travelStyle: profiles[0]?.travelStyle ?? null,
            interestKeys: interests.map(i => i.interestKey),
          };
        } catch { /* profile lookup failed — use empty context */ }
      }

      const inputs = {
        prompt: tour.prompt,
        transport: tour.transport,
        inputGroup: tour.inputGroup ?? "family_kids",
        inputVibe: tour.inputVibe ?? [],
        inputDurationHr: tour.inputDurationHr,
      };

      const graderStops = stops.map(s => ({
        placeId: s.placeId,
        name: s.name,
        lat: s.lat != null ? parseFloat(s.lat) : null,
        lng: s.lng != null ? parseFloat(s.lng) : null,
        placeTypes: s.placeTypes ?? [],
        businessStatus: null, // not stored on existing stops
        why: s.why,
        familyNote: s.familyNote,
      }));

      let grade;
      try {
        grade = await gradeTour(graderStops, familyCtx, inputs);
      } catch (err) {
        console.log(`ERROR: ${err.message}`);
        results.push({ tour, score: null, status: "grader_error", flags: [], reasons: [] });
        continue;
      }

      const status = grade.regenerate ? "low_confidence" : "pass";
      const flagStr = grade.flags.map(f => `${f.code}(${f.severity.slice(0,1)})`).join(",") || "none";
      console.log(`score=${grade.score} ${status} flags=[${flagStr}]`);
      results.push({ tour, score: grade.score, status, flags: grade.flags, reasons: grade.reasons });

      // Write grader result to DB
      await client.query(`
        UPDATE "GeneratedTour"
        SET "graderScore" = $1, "graderStatus" = $2, "graderFlags" = $3, "graderRanAt" = $4
        WHERE id = $5
      `, [grade.score, status, JSON.stringify(grade.flags), new Date(), tour.id]);
    }

    // ── Summary table ──────────────────────────────────────────────────────────
    console.log("\n=== SUMMARY TABLE ===");
    console.log(`${"ID".padEnd(10)} ${"City".padEnd(22)} ${"Score".padEnd(6)} ${"Status".padEnd(18)} Flags`);
    console.log("─".repeat(80));

    const graded = results.filter(r => r.score !== null);
    for (const r of results) {
      const id = r.tour.id.slice(-8);
      const city = (r.tour.destinationCity ?? "").slice(0, 20).padEnd(22);
      const score = r.score !== null ? String(r.score).padEnd(6) : "N/A   ";
      const status = r.status.padEnd(18);
      const flagCodes = r.flags.map(f => `${f.code}(${f.severity.slice(0,1)})`).join(" ") || "—";
      console.log(`${id.padEnd(10)} ${city} ${score} ${status} ${flagCodes}`);
    }

    // ── Distribution ───────────────────────────────────────────────────────────
    console.log("\n=== DISTRIBUTION ===");
    const statusCounts = {};
    let totalScore = 0;
    for (const r of graded) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      totalScore += r.score;
    }
    console.log("Count by status:");
    for (const [s, c] of Object.entries(statusCounts)) {
      console.log(`  ${s}: ${c}`);
    }
    const meanScore = graded.length > 0 ? (totalScore / graded.length).toFixed(1) : "N/A";
    console.log(`Mean score: ${meanScore} (n=${graded.length})`);

    const lowConfidence = graded.filter(r => r.score < 70);
    if (lowConfidence.length > 0) {
      console.log(`\nTours scoring < 70 (${lowConfidence.length} tours):`);
      for (const r of lowConfidence) {
        console.log(`  [${r.tour.id.slice(-8)}] "${(r.tour.title || "").slice(0, 40)}" (${r.tour.destinationCity}) score=${r.score}`);
        for (const f of r.flags) {
          console.log(`    FLAG [${f.code}] ${f.severity}: ${f.detail}`);
        }
        if (r.reasons.length > 0) {
          console.log(`    Reasons: ${r.reasons.join(" | ")}`);
        }
      }
    } else {
      console.log("\nAll graded tours scored >= 70.");
    }

    console.log("\n=== DONE ===");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
