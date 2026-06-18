import { inngest } from "../client";
import { db } from "@/lib/db";

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
          await db.familyProfile.update({
            where: { id: profile.id },
            data: { nudgeSentAt: new Date() },
          });
          nudged++;
        } catch (e) {
          console.error("[nudge] failed for profile", profile.id, e);
        }
      });
    }

    return { nudged };
  }
);
