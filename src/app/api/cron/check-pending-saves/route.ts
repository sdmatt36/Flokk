import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Alert if more than this many genuine extraction saves remain stuck PENDING for > 1 hour.
const ALERT_THRESHOLD = 5;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const count = await db.savedItem.count({
    where: {
      extractionStatus: "PENDING",
      sourceMethod: { not: "manual_activity" },
      savedAt: { lt: oneHourAgo },
    },
  });

  console.log(`[check-pending-saves] ${count} genuine PENDING saves older than 1 hour`);

  if (count > ALERT_THRESHOLD) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Flokk Alerts <hello@flokktravel.com>",
      to: "matt@flokktravel.com",
      subject: `[Flokk] Save enrichment stall: ${count} saves stuck PENDING`,
      text: [
        `${count} SavedItems (excluding manual_activity) have extractionStatus=PENDING`,
        `and were created more than 1 hour ago.`,
        ``,
        `This exceeds the alert threshold of ${ALERT_THRESHOLD}.`,
        ``,
        `The process-pending-saves cron runs every 15 minutes and should drain these.`,
        `If saves continue to accumulate, check:`,
        `  1. Vercel function logs for enrichSavedItem errors`,
        `  2. Whether CRON_SECRET is still set correctly`,
        `  3. Whether the process-pending-saves cron is running (Vercel dashboard → Cron Jobs)`,
        ``,
        `Query to inspect: SELECT id, "rawTitle", "sourceMethod", "sourcePlatform", "savedAt", "enrichmentAttempts"`,
        `FROM "SavedItem" WHERE "extractionStatus" = 'PENDING' AND "sourceMethod" != 'manual_activity'`,
        `AND "savedAt" < NOW() - INTERVAL '1 hour' ORDER BY "savedAt" ASC LIMIT 20;`,
      ].join("\n"),
    }).catch((e) => console.error("[check-pending-saves] Resend failed:", e));

    return NextResponse.json({ count, alerted: true, threshold: ALERT_THRESHOLD });
  }

  return NextResponse.json({ count, alerted: false, threshold: ALERT_THRESHOLD });
}
