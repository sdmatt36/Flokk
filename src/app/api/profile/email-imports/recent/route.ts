import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveProfileId } from "@/lib/profile-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = await resolveProfileId(userId);
  if (!profileId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const entries = await db.extractionLog.findMany({
    where: {
      familyProfileId: profileId,
      outcome: "needs_attachment",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      senderEmail: true,
      subject: true,
      attachmentMimeTypes: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ entries });
}
