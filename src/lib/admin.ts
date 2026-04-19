import { db } from "@/lib/db";

const ADMIN_USER_IDS = [
  (process.env.ADMIN_CLERK_USER_ID ?? "").trim(),
];

export async function isAdmin(clerkUserId: string): Promise<boolean> {
  if (!clerkUserId) return false;
  if (ADMIN_USER_IDS.filter(Boolean).includes(clerkUserId.trim())) return true;
  const user = await db.user.findFirst({ where: { clerkId: clerkUserId } });
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}
