import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteAccount } from "@/lib/account-deletion";

export const dynamic = "force-dynamic";

// DELETE /api/account
//
// Permanently deletes the authenticated user's account and all personal data.
// Identity is derived exclusively from the Clerk session — the request body
// and query string are never read, so one account cannot delete another.
export async function DELETE() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TEMPORARY pre-launch safety guard. Remove before public launch.
  const DEV_PROTECTED_CLERK_IDS = ["user_3B68dQIbRRU8GZnMcSaoJwBg9GS"];
  if (DEV_PROTECTED_CLERK_IDS.includes(clerkId)) {
    return NextResponse.json(
      { error: "This account is protected during development." },
      { status: 403 },
    );
  }

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const result = await deleteAccount({ userId: user.id, clerkId, skipClerk: false });
    return NextResponse.json({
      success: true,
      ...(result.clerkPending && { clerkPending: true }),
    });
  } catch (err) {
    console.error("[DELETE /api/account]", err);
    const message = err instanceof Error ? err.message : "Account deletion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
