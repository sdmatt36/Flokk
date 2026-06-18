import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { emailLayout, greet } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const payload = await req.text();
  const headers = {
    "svix-id":        req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, headers) as typeof event;
  } catch (e) {
    console.error("[clerk-webhook] signature verification failed:", e);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const data = event.data;
    const clerkId = data.id as string;

    // Primary email lookup with fallback to first address
    const emailAddresses = data.email_addresses as { id: string; email_address: string }[];
    const primaryId = data.primary_email_address_id as string | null;
    const primaryEntry = primaryId ? emailAddresses?.find((e) => e.id === primaryId) : null;
    const email = primaryEntry?.email_address ?? emailAddresses?.[0]?.email_address ?? "";

    const firstName = (data.first_name as string) ?? "";

    if (!email) {
      console.error("[CLERK_WEBHOOK_NO_EMAIL]", { clerkId });
      return NextResponse.json({ error: "no email" }, { status: 400 });
    }

    // Upsert user in DB — re-throw on failure so Clerk retries
    try {
      await db.user.upsert({
        where:  { email },
        update: { clerkId },
        create: { clerkId, email },
      });
    } catch (error) {
      console.error("[CLERK_WEBHOOK_DB_FAILURE]", {
        clerkId,
        email,
        operation: "user.upsert",
        message: (error as Error)?.message ?? String(error),
        stack:   (error as Error)?.stack,
      });
      throw error;
    }

    // Welcome email
    try {
      const html = emailLayout(
        `<p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#1B3A5C;">${greet(firstName || null)}</p>
         <p style="margin:0 0 16px;">Welcome to Flokk &mdash; your personal travel save, plan, and share hub.</p>
         <p style="margin:0 0 16px;">Start by saving a restaurant, hotel, or experience you&rsquo;ve been eyeing. Your first save takes about 10 seconds.</p>
         <p style="margin:0;">— Matt</p>`,
      );
      const result = await sendEmail(
        email,
        "Welcome to Flokk",
        html,
        "welcome",
        { replyTo: "hello@flokktravel.com" },
      );
      if (!result.success) {
        console.error("[CLERK_WEBHOOK_WELCOME_EMAIL_FAILURE]", { clerkId, email, error: result.error, logId: result.logId });
      } else {
        console.log("[clerk-webhook] welcome email sent", { clerkId, email, logId: result.logId });
      }
    } catch (e) {
      console.error("[CLERK_WEBHOOK_WELCOME_EMAIL_FAILURE]", { clerkId, email, error: String(e) });
    }

    console.log("[clerk-webhook] user.created processed", { clerkId, email });
  }

  return NextResponse.json({ received: true });
}
