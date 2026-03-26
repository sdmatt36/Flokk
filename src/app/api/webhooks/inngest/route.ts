import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { parseBookingEmail } from "@/lib/inngest/functions/parse-booking-email";
import { enrichSeededSaves } from "@/lib/inngest/functions/enrich-seeded-saves";
import { enrichSavedItem } from "@/lib/inngest/functions/enrich-saved-item";
import { nudgeInactiveUsers } from "@/lib/inngest/functions/nudge-inactive-users";

export const { GET, POST, PUT } = serve({
  client: inngest,
  serveHost: "https://www.flokktravel.com",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  signingKeyFallback: process.env.INNGEST_SIGNING_KEY_FALLBACK,
  functions: [parseBookingEmail, enrichSeededSaves, enrichSavedItem, nudgeInactiveUsers],
});
