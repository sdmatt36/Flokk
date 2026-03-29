// INNGEST DISABLED — all background jobs migrated to Vercel Cron + direct calls.
// Only parseBookingEmail remains (triggered by Loops webhook, not a cron).
// enrichSeededSaves → /api/admin/enrich-all-saves (POST, admin-only)
// nudgeInactiveUsers → /api/cron/nudge-users (GET, Vercel Cron daily 9am UTC)
// enrichSavedItem → called directly in /api/saves route
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { parseBookingEmail } from "@/lib/inngest/functions/parse-booking-email";

export const { GET, POST, PUT } = serve({
  client: inngest,
  serveHost: "https://www.flokktravel.com",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  signingKeyFallback: process.env.INNGEST_SIGNING_KEY_FALLBACK,
  functions: [parseBookingEmail],
});
