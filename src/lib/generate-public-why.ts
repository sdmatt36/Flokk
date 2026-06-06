import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
        model: "claude-haiku-4-5-20251001",
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
