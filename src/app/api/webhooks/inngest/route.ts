import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { parseBookingEmail } from "@/lib/inngest/functions/parse-booking-email";
import { enrichSeededSaves } from "@/lib/inngest/functions/enrich-seeded-saves";
import { enrichSavedItem } from "@/lib/inngest/functions/enrich-saved-item";
import { nudgeInactiveUsers } from "@/lib/inngest/functions/nudge-inactive-users";

console.log("[inngest-key]", process.env.INNGEST_SIGNING_KEY?.slice(0, 30));

export const { GET, POST, PUT } = serve({
  client: inngest,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  serveHost: "https://www.flokktravel.com",
  functions: [parseBookingEmail, enrichSeededSaves, enrichSavedItem, nudgeInactiveUsers],
});
