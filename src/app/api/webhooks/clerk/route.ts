import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createLoopsContact } from "@/lib/loops";
import { db } from "@/lib/db";

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
    const lastName  = (data.last_name  as string) ?? "";

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

    // Loops: create contact
    const contactResult = await createLoopsContact(email, firstName, lastName);
    if (!contactResult.success) {
      console.error("[CLERK_WEBHOOK_LOOPS_FAILURE]", {
        clerkId,
        email,
        operation: "createLoopsContact",
        error: contactResult.error,
      });
    }

    console.log("[clerk-webhook] user.created processed", { clerkId, email });
  }

  return NextResponse.json({ received: true });
}
