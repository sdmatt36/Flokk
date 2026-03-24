import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "flokk",
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
