import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TARGET_SENDER = "carolinerweiner@gmail.com";
const EXPECTED_FAILED_COUNT = 21;

export async function POST(req: NextRequest) {
  const body = await req.json() as { secret?: string };
  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "").trim() ??
    body.secret;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Step 1 — find all failed rows for this sender caused by the retired model
  const failedRows = await db.extractionLog.findMany({
    where: {
      senderEmail: TARGET_SENDER,
      outcome: "error",
      errorMessage: { contains: "claude-sonnet-4-20250514" },
      rawEmail: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      subject: true,
      rawEmail: true,
      familyProfileId: true,
      messageId: true,
    },
  });

  if (failedRows.length !== EXPECTED_FAILED_COUNT) {
    return NextResponse.json(
      {
        error: `Expected ${EXPECTED_FAILED_COUNT} failed rows, found ${failedRows.length} — aborting without changes`,
        found: failedRows.length,
      },
      { status: 422 }
    );
  }

  // Step 2 — group by subject (= distinct booking), keep only the latest forward per group
  const groups = new Map<string, typeof failedRows[0]>();
  for (const row of failedRows) {
    const key = (row.subject ?? "").trim();
    const existing = groups.get(key);
    if (!existing || row.createdAt > existing.createdAt) {
      groups.set(key, row);
    }
  }

  const toReprocess = Array.from(groups.entries()).map(([subject, row]) => ({
    subject,
    row,
  }));

  console.log(
    `[recover-caroline] ${failedRows.length} failed rows → ${groups.size} distinct subjects → ${toReprocess.length} to reprocess`
  );

  const origin = new URL(req.url).origin;
  const webhookUrl = `${origin}/api/webhooks/email-inbound`;

  const results: Array<{
    subject: string;
    sourceLogId: string;
    webhookStatus: number;
    newLogId: string | null;
    newLogOutcome: string | null;
    newLogMatchedTripId: string | null;
    newLogAutoCreatedTripId: string | null;
    newLogItineraryItemIds: string[];
    error?: string;
  }> = [];

  for (const { subject, row } of toReprocess) {
    const startedAt = new Date();
    let webhookStatus = 0;
    let newLog: {
      id: string;
      outcome: string;
      matchedTripId: string | null;
      autoCreatedTripId: string | null;
      itineraryItemIds: string[];
    } | null = null;
    let callError: string | undefined;

    try {
      // Step 3 — replay through the real email-inbound path (same format as replay-extraction-from-text)
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envelope: { from: TARGET_SENDER, to: "trips@flokktravel.com" },
          headers: { subject: row.subject ?? "" },
          plain: row.rawEmail!,
          html: "",
        }),
      });
      webhookStatus = webhookRes.status;
    } catch (e) {
      callError = e instanceof Error ? e.message : String(e);
      webhookStatus = 500;
    }

    // Find the new ExtractionLog row written by the replay
    if (!callError) {
      newLog = await db.extractionLog.findFirst({
        where: {
          senderEmail: TARGET_SENDER,
          createdAt: { gte: startedAt },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          outcome: true,
          matchedTripId: true,
          autoCreatedTripId: true,
          itineraryItemIds: true,
        },
      });
    }

    // Step 4 — annotate the source row so the audit trail is clear
    await db.extractionLog.update({
      where: { id: row.id },
      data: {
        outcome: "recovery_queued",
        errorMessage: newLog
          ? `Recovered by /api/admin/recover-caroline at ${new Date().toISOString()} → new log ${newLog.id} (${newLog.outcome})`
          : `Recovery attempted by /api/admin/recover-caroline at ${new Date().toISOString()} — webhook ${webhookStatus}${callError ? ` — ${callError}` : ""}`,
      },
    });

    results.push({
      subject,
      sourceLogId: row.id,
      webhookStatus,
      newLogId: newLog?.id ?? null,
      newLogOutcome: newLog?.outcome ?? null,
      newLogMatchedTripId: newLog?.matchedTripId ?? null,
      newLogAutoCreatedTripId: newLog?.autoCreatedTripId ?? null,
      newLogItineraryItemIds: newLog?.itineraryItemIds ?? [],
      ...(callError ? { error: callError } : {}),
    });
  }

  return NextResponse.json({
    checkedRows: failedRows.length,
    distinctGroups: groups.size,
    reprocessed: toReprocess.length,
    results,
  });
}
