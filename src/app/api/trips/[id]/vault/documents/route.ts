import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { synthesizeVaultDocuments } from "@/lib/vault/synthesize-booking";
import { resolveProfileId } from "@/lib/profile-access";
import { getTripAccess, canEditTripContent } from "@/lib/trip-permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No family profile" }, { status: 400 });

  const access = await getTripAccess(profileId, tripId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const documents = await synthesizeVaultDocuments(tripId, db);
  return NextResponse.json(documents);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tripId } = await params;

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "No profile" }, { status: 400 });
  if (!(await canEditTripContent(profileId, tripId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  if (!body.label?.trim()) return NextResponse.json({ error: "Label required" }, { status: 400 });
  const doc = await db.tripDocument.create({
    data: {
      tripId,
      label: body.label.trim(),
      type: body.type || "link",
      url: body.url || null,
      content: body.content || null,
    },
  });
  return NextResponse.json(doc, { status: 201 });
}
