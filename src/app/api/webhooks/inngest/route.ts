import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { parseBookingEmail } from "@/lib/inngest/functions/parse-booking-email";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [parseBookingEmail],
});
