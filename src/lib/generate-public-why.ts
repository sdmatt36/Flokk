import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { HAIKU } from "@/lib/ai-models";
import { ticketClassificationGuidance, isTicketSignal } from "@/lib/tour-ticket";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// B2: batched AI ticket classification over already-resolved stops (which carry the
// Google types + website). One Haiku tool call for the whole tour — cheaper and more
// time-budget-friendly than per-stop calls in the resolution hot path. Stops keep the
// deterministic fallback (ticketFallbackFromSignals, set at resolve time); this only
// OVERRIDES with a CONFIDENT model value. An "unknown"/failed classification leaves the
// fallback untouched.
export async function classifyTicketsForStops(
  stops: { id: string; name: string; placeTypes: string[]; websiteUrl: string | null }[],
  city: string,
): Promise<{ updated: number; failed: number }> {
  if (stops.length === 0) return { updated: 0, failed: 0 };
  try {
    const msg = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 1024,
      tools: [{
        name: "emit_ticket_classifications",
        description: "Classify the ticketing requirement for each tour stop.",
        input_schema: {
          type: "object",
          properties: {
            stops: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  ticketRequired: { type: "string", enum: ["free", "ticket-required", "advance-booking-recommended", "unknown"] },
                },
                required: ["id", "ticketRequired"],
              },
            },
          },
          required: ["stops"],
        },
      }],
      tool_choice: { type: "tool", name: "emit_ticket_classifications" },
      messages: [{
        role: "user",
        content: `${ticketClassificationGuidance()}\n\nClassify each stop in ${city}. Return exactly one classification per stop id.\n\n${stops
          .map((s) => `- id=${s.id} | name="${s.name}" | types=[${s.placeTypes.join(", ")}] | website=${s.websiteUrl ?? "none"}`)
          .join("\n")}`,
      }],
    });

    let rows: Array<{ id?: unknown; ticketRequired?: unknown }> = [];
    for (const block of msg.content) {
      if (block.type === "tool_use") {
        const input = block.input as { stops?: Array<{ id?: unknown; ticketRequired?: unknown }> };
        rows = Array.isArray(input.stops) ? input.stops : [];
        break;
      }
    }

    let updated = 0;
    await Promise.allSettled(
      rows.map(async (row) => {
        const id = typeof row.id === "string" ? row.id : null;
        const tr = row.ticketRequired;
        // Only override with a CONFIDENT value; "unknown" keeps the deterministic fallback.
        if (id && isTicketSignal(tr) && tr !== "unknown") {
          await db.tourStop.update({ where: { id }, data: { ticketRequired: tr } });
          updated++;
        }
      }),
    );
    return { updated, failed: stops.length - updated };
  } catch (e) {
    console.error("[ticket-classify] batched pass failed:", e);
    return { updated: 0, failed: stops.length };
  }
}

type StopInput = {
  id: string;
  name: string;
  address: string | null;
  placeTypes: string[];
  durationMin: number | null;
};

export async function generatePublicWhyForStops(
  stops: StopInput[],
  city: string,
): Promise<{ generated: number; failed: number }> {
  if (stops.length === 0) return { generated: 0, failed: 0 };

  const results = await Promise.allSettled(
    stops.map(async (stop) => {
      const typeLabel = stop.placeTypes.slice(0, 4).join(", ") || "attraction";
      const durationLabel = stop.durationMin ? `${stop.durationMin} min` : "varies";
      const msg = await anthropic.messages.create({
        model: HAIKU,
        max_tokens: 120,
        messages: [{
          role: "user",
          content: `Write 1-2 warm sentences describing why families enjoy visiting this venue in ${city}. Use general language (families, kids, little ones). Do not include specific names, ages, allergies, or personal details.

Venue: ${stop.name}
Location: ${stop.address ?? city}
Type: ${typeLabel}
Visit duration: ${durationLabel}

Respond with only the description sentences.`,
        }],
      });
      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
      if (!text) throw new Error(`empty response for stop ${stop.id}`);
      await db.tourStop.update({ where: { id: stop.id }, data: { publicWhy: text } });
    })
  );

  const failed = results.filter(r => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`[publicWhy] ${failed}/${stops.length} stops failed generation`);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[publicWhy] stop ${stops[i]?.id} failed:`, r.reason);
      }
    });
  }
  return { generated: stops.length - failed, failed };
}

export async function generateNeutralSubtitle(
  title: string,
  durationLabel: string,
  transport: string,
  city: string,
  stopCount: number,
): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 80,
      messages: [{
        role: "user",
        content: `Write one sentence (under 20 words) for this family tour. General language only; no ages, names, or personal details.

Tour: ${title}
City: ${city}
Duration: ${durationLabel}
Getting around: ${transport}
Stops: ${stopCount}

Respond with only the sentence.`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
    return text ?? `A family-ready ${durationLabel.toLowerCase()} tour of ${city}.`;
  } catch {
    return `A family-ready ${durationLabel.toLowerCase()} tour of ${city}.`;
  }
}
