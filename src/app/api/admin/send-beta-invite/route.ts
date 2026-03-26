import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { db } from "@/lib/db";
import BetaInvitation from "@/emails/BetaInvitation";

export const dynamic = "force-dynamic";

const ADMIN_USER_IDS = [(process.env.ADMIN_CLERK_USER_ID ?? "").trim()];

async function isAdmin(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.filter(Boolean).includes(userId.trim())) return true;
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  return user?.email?.endsWith("@flokktravel.com") ?? false;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { to?: string; firstName?: string };
  const { to, firstName } = body;

  if (!to || !firstName) {
    return NextResponse.json({ error: "to and firstName are required" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const html = await render(BetaInvitation({ firstName }));

  const { data, error } = await resend.emails.send({
    from: "Matt & Jen at Flokk <hello@flokktravel.com>",
    to,
    subject: "You're invited to build Flokk with us",
    html,
  });

  if (error) {
    console.error("[send-beta-invite] Resend error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
