import { inngest } from "../client";
import { db } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import { sendTransactional } from "@/lib/loops";

export const nudgeInactiveUsers = inngest.createFunction(
  { id: "nudge-inactive-users" },
  { cron: "0 9 * * *" }, // daily at 9am UTC
  async ({ step }) => {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago

    const profiles = await step.run("fetch-inactive-profiles", async () => {
      return await db.familyProfile.findMany({
        where: {
          createdAt: { lt: cutoff },
          nudgeSentAt: null,
          savedItems: { none: {} },
        },
        include: { user: true },
      });
    });

    console.log(`[nudge] found ${profiles.length} inactive profiles to nudge`);
    if (profiles.length === 0) return { nudged: 0 };

    let nudged = 0;

    for (const profile of profiles) {
      await step.run(`nudge-${profile.id}`, async () => {
        try {
          const clerk = await clerkClient();
          const clerkUser = await clerk.users.getUser(profile.user.clerkId);
          const firstName = clerkUser.firstName ?? "";
          const email = profile.user.email;

          await sendTransactional(email, "cmn5lny7g0t3v0ivuxp2nbz6h", { firstName });
          await db.familyProfile.update({
            where: { id: profile.id },
            data: { nudgeSentAt: new Date() },
          });
          console.log("[loops] nudge sent to", email);
          nudged++;
        } catch (e) {
          console.error("[nudge] failed for profile", profile.id, e);
        }
      });
    }

    return { nudged };
  }
);
