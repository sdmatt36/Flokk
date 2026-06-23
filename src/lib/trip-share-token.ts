import { nanoid } from "nanoid";
import { db } from "@/lib/db";

// Mint a unique trip shareToken using the SAME generator as entity share tokens
// (nanoid(12), matching getOrCreateShareToken in share-token.ts) so trip and entity
// tokens share one format. Pre-checks the @unique column and retries on the (astronomically
// rare) collision; the DB unique constraint is the final guard.
export async function mintTripShareToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = nanoid(12);
    const existing = await db.trip.findFirst({ where: { shareToken: token }, select: { id: true } });
    if (!existing) return token;
  }
  return nanoid(16);
}
