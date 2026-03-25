import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createLoopsContact, sendTransactional } from "@/lib/loops";
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
    const emailAddresses = data.email_addresses as { email_address: string }[];
    const email = emailAddresses?.[0]?.email_address ?? "";
    const firstName = (data.first_name as string) ?? "";
    const lastName = (data.last_name as string) ?? "";

    if (!email) {
      console.warn("[clerk-webhook] user.created — no email found, skipping");
      return NextResponse.json({ received: true });
    }

    // Upsert user in DB
    await db.user.upsert({
      where: { email },
      update: { clerkId },
      create: { clerkId, email },
    });

    // Loops: create contact + send welcome email
    await createLoopsContact(email, firstName, lastName);
    await sendTransactional(email, "cmn5kw2ca0tha0hyvgvpm9ser", { firstName });
    console.log("[loops] welcome sent to", email);
  }

  return NextResponse.json({ received: true });
}
