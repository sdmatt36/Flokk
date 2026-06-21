/**
 * replay-extraction.ts
 *
 * Admin recovery tool. Re-runs the stored rawEmail of one or more ExtractionLog
 * rows through the CURRENT (Fix-1) inbound pipeline, to recover bookings that
 * failed during the image-400 bounce window. This affects multiple users.
 *
 * How it works:
 * - Reads each ExtractionLog row by id.
 * - Reconstructs a CloudMailin "Normalized" inbound payload from the stored row:
 *     from        = senderEmail
 *     subject     = subject
 *     html        = rawEmail   (the stored HTML body)
 *     plain       = ""
 *     attachments = []         (replay is intentionally body-only — attachment
 *                               bytes are NOT stored, and the body parses cleanly)
 * - POSTs it to /api/webhooks/email-inbound, the SAME path the live webhook uses.
 *   The webhook has no signature/auth to replicate, so a plain POST is sufficient.
 * - Reads back the new ExtractionLog row the replay produced and prints, per id:
 *     outcome, matchedTripId, autoCreatedTripId, tripDocumentId, confidence, error.
 *
 * Dedup safety: the replay goes through the unchanged handler, so the
 * confirmationCode duplicate guard (profile-scoped familyProfileId +
 * confirmationCode; flights deduped in writeFlightFromEmail) still applies.
 * Re-running an already-captured booking returns duplicate_skipped /
 * duplicate_merged / duplicate_attached — it is NOT duplicated.
 *
 * This WRITES to live data (it may create trips / itinerary items). It targets
 * production by default. Run only against ids you intend to recover.
 *
 * Run: npx tsx scripts/replay-extraction.ts <extractionLogId> [<extractionLogId> ...]
 * Override target: REPLAY_WEBHOOK_URL=https://staging.example.com/api/webhooks/email-inbound npx tsx scripts/replay-extraction.ts <id>
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "@/lib/db";

const WEBHOOK_URL =
  process.env.REPLAY_WEBHOOK_URL ?? "https://www.flokktravel.com/api/webhooks/email-inbound";

type ReplayResult = {
  id: string;
  status: "replayed" | "skipped" | "not_found" | "no_new_log";
  httpStatus?: number;
  newLogId?: string | null;
  outcome?: string | null;
  matchedTripId?: string | null;
  autoCreatedTripId?: string | null;
  tripDocumentId?: string | null;
  confidence?: number | null;
  error?: string | null;
  note?: string;
};

async function replayOne(id: string): Promise<ReplayResult> {
  const row = await db.extractionLog.findUnique({
    where: { id },
    select: { id: true, senderEmail: true, subject: true, rawEmail: true },
  });

  if (!row) {
    return { id, status: "not_found", note: "no ExtractionLog row with this id" };
  }
  if (!row.rawEmail || row.rawEmail.trim().length === 0) {
    return {
      id,
      status: "skipped",
      note: "no stored rawEmail (pre-2026-05-13 row) — nothing to replay",
    };
  }

  // CloudMailin "Normalized" JSON shape — the webhook keys off payload.envelope.from.
  const payload = {
    envelope: { from: row.senderEmail, to: "trips@flokktravel.com" },
    headers: { subject: row.subject ?? "" },
    plain: "",
    html: row.rawEmail,
    attachments: [],
  };

  const startedAt = new Date();

  let httpStatus: number;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    httpStatus = res.status;
  } catch (e) {
    return { id, status: "no_new_log", error: `webhook POST failed: ${String(e)}` };
  }

  // The replay produces a fresh ExtractionLog row. It is the newest row created
  // at/after startedAt for this sender, excluding the original. Sequential
  // processing keeps this unambiguous.
  const newLog = await db.extractionLog.findFirst({
    where: {
      senderEmail: row.senderEmail,
      createdAt: { gte: startedAt },
      id: { not: row.id },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      outcome: true,
      matchedTripId: true,
      autoCreatedTripId: true,
      tripDocumentId: true,
      confidenceScore: true,
      errorMessage: true,
    },
  });

  if (!newLog) {
    return { id, status: "no_new_log", httpStatus, note: "POST returned but no new ExtractionLog row found" };
  }

  return {
    id,
    status: "replayed",
    httpStatus,
    newLogId: newLog.id,
    outcome: newLog.outcome,
    matchedTripId: newLog.matchedTripId,
    autoCreatedTripId: newLog.autoCreatedTripId,
    tripDocumentId: newLog.tripDocumentId,
    confidence: newLog.confidenceScore,
    error: newLog.errorMessage,
  };
}

async function main() {
  const ids = process.argv.slice(2).filter(Boolean);
  if (ids.length === 0) {
    console.error("Usage: npx tsx scripts/replay-extraction.ts <extractionLogId> [<extractionLogId> ...]");
    process.exit(1);
  }

  console.log(`[replay] target webhook: ${WEBHOOK_URL}`);
  console.log(`[replay] replaying ${ids.length} ExtractionLog id(s): ${ids.join(", ")}`);
  console.log("[replay] NOTE: this writes to live data; confirmationCode dedup still applies.\n");

  const results: ReplayResult[] = [];
  for (const id of ids) {
    const r = await replayOne(id);
    results.push(r);
    if (r.status === "replayed") {
      console.log(
        `id=${r.id}\n` +
          `  http=${r.httpStatus} newLog=${r.newLogId}\n` +
          `  outcome=${r.outcome ?? "null"}\n` +
          `  matchedTripId=${r.matchedTripId ?? "null"}\n` +
          `  autoCreatedTripId=${r.autoCreatedTripId ?? "null"}\n` +
          `  tripDocumentId=${r.tripDocumentId ?? "null"}\n` +
          `  confidence=${r.confidence ?? "null"}\n` +
          `  error=${r.error ?? "null"}\n`,
      );
    } else {
      console.log(`id=${r.id}\n  status=${r.status}${r.httpStatus ? ` http=${r.httpStatus}` : ""}\n  ${r.note ?? r.error ?? ""}\n`);
    }
  }

  const replayed = results.filter((r) => r.status === "replayed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "not_found" || r.status === "no_new_log").length;
  console.log(`[replay] done: ${replayed} replayed, ${skipped} skipped, ${failed} not_found/no_new_log`);
}

main()
  .catch((e) => {
    console.error("[replay] fatal:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
