import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const items = await db.savedItem.findMany({
    where: {
      OR: [
        { sourceType: "INSTAGRAM" },
        { rawTitle: { contains: "on Instagram" } },
      ],
    },
    select: { id: true },
  });

  await Promise.all(
    items.map((item) =>
      inngest
        .send({ name: "saves/enrich-item", data: { savedItemId: item.id } })
        .catch((e) => console.error(`[reenrich-instagram] inngest.send failed for ${item.id}:`, e))
    )
  );

  return NextResponse.json({ queued: items.length });
}
