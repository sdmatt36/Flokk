import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || !(await isAdmin(userId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let senderEmail: string, subject: string, body: string, extractionLogId: string | undefined;
  try {
    ({ senderEmail, subject, body, extractionLogId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!senderEmail || !body) {
    return NextResponse.json({ error: "senderEmail and body are required" }, { status: 400 });
  }

  const startedAt = new Date();

  // Forward to the inbound webhook as a CloudMailin-format payload
  const origin = new URL(req.url).origin;
  const webhookUrl = `${origin}/api/webhooks/email-inbound`;

  let webhookStatus: number;
  try {
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        envelope: { from: senderEmail, to: "trips@flokktravel.com" },
        headers: { subject: subject ?? "" },
        plain: body,
        html: "",
      }),
    });
    webhookStatus = webhookRes.status;
  } catch (e) {
    return NextResponse.json({ error: "Webhook call failed", detail: String(e) }, { status: 500 });
  }

  // Find the new ExtractionLog row created by this replay
  const newLog = await db.extractionLog.findFirst({
    where: {
      senderEmail: senderEmail.toLowerCase(),
      createdAt: { gte: startedAt },
    },
    orderBy: { createdAt: "desc" },
  });

  // If caller provided an original log ID, annotate it with the recovery reference
  if (extractionLogId && newLog) {
    await db.extractionLog.update({
      where: { id: extractionLogId },
      data: { errorMessage: `Recovered via replay → new log ${newLog.id}` },
    }).catch(() => { /* non-fatal */ });
  }

  return NextResponse.json({
    ok: webhookStatus === 200,
    webhookStatus,
    newLogId: newLog?.id ?? null,
    newLogOutcome: newLog?.outcome ?? null,
    newLogMatchedTripId: newLog?.matchedTripId ?? null,
    newLogItineraryItemIds: newLog?.itineraryItemIds ?? [],
  });
}
