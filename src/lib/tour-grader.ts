import Anthropic from "@anthropic-ai/sdk";
import { haversineKm } from "@/lib/geo";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface GraderStop {
  placeId: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  placeTypes: string[];
  businessStatus: string | null;
  why: string | null;
  familyNote: string | null;
}

export interface GraderFamilyContext {
  ages: number[];
  dietary: string[];
  foodAllergies: string[];
  pace: string | null;
  travelStyle: string | null;
  interestKeys: string[];
}

export interface GraderGenerationInputs {
  prompt: string;
  transport: string;
  inputGroup: string;
  inputVibe: string[];
  inputDurationHr: number | null;
}

export interface GraderFlag {
  code: string;
  severity: "critical" | "high" | "medium";
  detail: string;
}

export interface GraderResult {
  score: number;
  flags: GraderFlag[];
  reasons: string[];
  regenerate: boolean;
}

function maxRadiusKm(transport: string): number {
  const t = transport.toLowerCase();
  if (t === "walking") return 8;
  if (t.includes("transit") || t.includes("metro")) return 25;
  if (t.includes("car") || t.includes("driving")) return 50;
  return 15;
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function checkDuplicates(stops: GraderStop[]): GraderFlag[] {
  const flags: GraderFlag[] = [];
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const a = stops[i];
      const b = stops[j];

      if (a.placeId && b.placeId && a.placeId === b.placeId) {
        flags.push({ code: "DUP_STOP", severity: "high", detail: `Stops ${i + 1} and ${j + 1} share placeId ${a.placeId}` });
        continue;
      }

      if (normalizeName(a.name) === normalizeName(b.name)) {
        flags.push({ code: "DUP_STOP", severity: "high", detail: `Stops ${i + 1} "${a.name}" and ${j + 1} "${b.name}" normalize to identical name` });
        continue;
      }

      if (a.lat && a.lng && b.lat && b.lng) {
        const distM = haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) * 1000;
        if (distM <= 50) {
          const overlap = a.placeTypes.some(t => b.placeTypes.includes(t));
          if (overlap) {
            flags.push({ code: "DUP_STOP", severity: "high", detail: `Stops ${i + 1} "${a.name}" and ${j + 1} "${b.name}" are ${Math.round(distM)}m apart with overlapping place types` });
          }
        }
      }
    }
  }
  return flags;
}

function checkGeoIncoherence(stops: GraderStop[], transport: string): GraderFlag[] {
  const maxKm = maxRadiusKm(transport);
  const flags: GraderFlag[] = [];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];
    if (prev.lat && prev.lng && curr.lat && curr.lng) {
      const dist = haversineKm({ lat: prev.lat, lng: prev.lng }, { lat: curr.lat, lng: curr.lng });
      if (dist > maxKm) {
        flags.push({
          code: "GEO_INCOHERENT",
          severity: "high",
          detail: `Stop ${i} "${prev.name}" → Stop ${i + 1} "${curr.name}": ${dist.toFixed(1)}km exceeds ${maxKm}km max for ${transport}`,
        });
      }
    }
  }
  return flags;
}

function checkClosedVenues(stops: GraderStop[]): GraderFlag[] {
  const flags: GraderFlag[] = [];
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (s.businessStatus === "CLOSED_PERMANENTLY") {
      flags.push({ code: "CLOSED_VENUE", severity: "critical", detail: `Stop ${i + 1} "${s.name}" is permanently closed` });
    } else if (s.businessStatus === "CLOSED_TEMPORARILY") {
      flags.push({ code: "CLOSED_VENUE", severity: "medium", detail: `Stop ${i + 1} "${s.name}" is temporarily closed` });
    }
  }
  return flags;
}

function isHardFail(flags: GraderFlag[]): boolean {
  const criticals = flags.filter(f => f.severity === "critical").length;
  const highs = flags.filter(f => f.severity === "high").length;
  return criticals > 0 || highs >= 2;
}

interface JudgmentOutput {
  familyFitScore: number;
  themeIntentScore: number;
  reasons: string[];
}

async function runJudgment(
  stops: GraderStop[],
  familyCtx: GraderFamilyContext,
  inputs: GraderGenerationInputs,
): Promise<JudgmentOutput> {
  const contextLines = [
    `Tour theme: "${inputs.prompt}"`,
    `Transport: ${inputs.transport}`,
    `Group type: ${inputs.inputGroup}`,
    inputs.inputVibe.length > 0 ? `Vibe tags: ${inputs.inputVibe.join(", ")}` : null,
    inputs.inputDurationHr ? `Duration: ${inputs.inputDurationHr} hours` : null,
    familyCtx.ages.length > 0 ? `Children aged: ${familyCtx.ages.join(", ")}` : null,
    familyCtx.dietary.length > 0 ? `Dietary requirements: ${familyCtx.dietary.join(", ")}` : null,
    familyCtx.foodAllergies.length > 0 ? `Food allergies (hard constraint): ${familyCtx.foodAllergies.join(", ")}` : null,
    familyCtx.travelStyle ? `Travel style: ${familyCtx.travelStyle}` : null,
    familyCtx.pace ? `Pace: ${familyCtx.pace}` : null,
    familyCtx.interestKeys.length > 0 ? `Interests: ${familyCtx.interestKeys.join(", ")}` : null,
    `\nProposed stops (${stops.length} total):`,
    ...stops.map((s, i) =>
      `${i + 1}. ${s.name} [types: ${s.placeTypes.slice(0, 3).join(", ") || "unknown"}]\n   Why: ${s.why || "(none)"}\n   Note: ${s.familyNote || "(none)"}`
    ),
  ].filter(Boolean).join("\n");

  const gradeToolSchema: Anthropic.Tool = {
    name: "emit_grade",
    description: "Emit quality scores for the proposed tour.",
    input_schema: {
      type: "object",
      properties: {
        familyFitScore: {
          type: "number",
          description: "0-100. How well do these stops serve the provided family context (ages, dietary, allergies, interests, pace, style)? If no family context was provided, score 70 (neutral).",
        },
        themeIntentScore: {
          type: "number",
          description: "0-100. How directly does each stop serve the stated tour theme/prompt? Penalize off-theme stops harshly.",
        },
        reasons: {
          type: "array",
          items: { type: "string" },
          description: "2-4 specific reasons explaining your scores.",
        },
      },
      required: ["familyFitScore", "themeIntentScore", "reasons"],
    },
  };

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: `You are a tour quality grader. Score the proposed tour STRICTLY against the provided context.
- familyFitScore: how well stops fit the given family (ages, dietary restrictions, food allergies, interests, pace). Never penalize for context NOT given to you.
- themeIntentScore: how directly each stop serves the stated tour theme. Vague or tangential stops drag this score down.
- Be strict. A stop that is age-inappropriate, allergen-conflicting, or off-theme is a real problem.
- Do NOT hallucinate context. If a field is absent, ignore it — do not penalize.`,
    tools: [gradeToolSchema],
    tool_choice: { type: "tool", name: "emit_grade" },
    messages: [{ role: "user", content: contextLines }],
  });

  const block = resp.content.find(b => b.type === "tool_use" && b.name === "emit_grade");
  if (!block || block.type !== "tool_use") {
    return { familyFitScore: 70, themeIntentScore: 70, reasons: ["grader call returned no tool use"] };
  }
  const raw = block.input as Partial<JudgmentOutput>;
  return {
    familyFitScore: Math.max(0, Math.min(100, Number(raw.familyFitScore ?? 70))),
    themeIntentScore: Math.max(0, Math.min(100, Number(raw.themeIntentScore ?? 70))),
    reasons: Array.isArray(raw.reasons) ? raw.reasons : [],
  };
}

export async function gradeTour(
  stops: GraderStop[],
  familyCtx: GraderFamilyContext,
  inputs: GraderGenerationInputs,
): Promise<GraderResult> {
  // Deterministic checks
  const flags: GraderFlag[] = [
    ...checkDuplicates(stops),
    ...checkGeoIncoherence(stops, inputs.transport),
    ...checkClosedVenues(stops),
  ];

  const hardFail = isHardFail(flags);

  // Judgment call
  let score = 0;
  let reasons: string[] = [];
  try {
    const judgment = await runJudgment(stops, familyCtx, inputs);
    score = Math.round(0.6 * judgment.familyFitScore + 0.4 * judgment.themeIntentScore);
    reasons = judgment.reasons;
    console.log(`[tour-grader] familyFit=${judgment.familyFitScore} themeIntent=${judgment.themeIntentScore} composite=${score} hardFail=${hardFail} flags=${flags.length}`);
    if (reasons.length > 0) {
      console.log(`[tour-grader] reasons: ${reasons.join(" | ")}`);
    }
  } catch (err) {
    console.error("[tour-grader] judgment call failed:", err);
    score = 70; // neutral fallback — do not block user on grader failure
  }

  const regenerate = hardFail || score < 70;
  return { score, flags, reasons, regenerate };
}

export function graderFlagsToInstruction(flags: GraderFlag[], reasons: string[]): string {
  const lines = [
    "GRADER FEEDBACK — fix these specific problems in this regeneration:",
    ...flags.map(f => `- [${f.code}] ${f.severity.toUpperCase()}: ${f.detail}`),
    ...(reasons.length > 0 ? ["", "Quality concerns:", ...reasons.map(r => `- ${r}`)] : []),
  ];
  return lines.join("\n");
}
