import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import he from "he";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const stripRawUnicode = (str: string) => str.replace(/&#x[0-9a-fA-F]+;/gi, "").trim();
const cleanText = (s: string | null | undefined): string | null =>
  s ? (stripRawUnicode(he.decode(s)) || null) : null;

export async function POST() {
  const dirtySaves = await db.savedItem.findMany({
    where: {
      OR: [
        { rawTitle: { contains: "&quot;" } },
        { rawTitle: { contains: "&#x" } },
        { rawTitle: { contains: "&amp;" } },
        { rawTitle: { contains: "&apos;" } },
        { rawDescription: { contains: "&quot;" } },
        { rawDescription: { contains: "&#x" } },
        { rawDescription: { contains: "&amp;" } },
      ],
    },
    select: { id: true, rawTitle: true, rawDescription: true },
  });

  let updated = 0;
  for (const save of dirtySaves) {
    const newTitle = cleanText(save.rawTitle);
    const newDescription = cleanText(save.rawDescription);
    await db.savedItem.update({
      where: { id: save.id },
      data: {
        ...(newTitle !== null ? { rawTitle: newTitle } : {}),
        ...(newDescription !== null ? { rawDescription: newDescription } : {}),
      },
    });
    updated++;
  }

  return NextResponse.json({ found: dirtySaves.length, updated });
}
