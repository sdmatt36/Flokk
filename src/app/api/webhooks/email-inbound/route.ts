import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ── Authenticate webhook request ────────────────────────────────────────────
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && secret !== "change-me-local") {
    const provided =
      req.headers.get("x-webhook-secret") ??
      req.nextUrl.searchParams.get("secret");
    if (provided !== secret) {
      console.warn("[email-inbound] rejected: invalid webhook secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = await req.json() as Record<string, any>;

    // ── Normalise payload — handle CloudMailin and standard JSON formats ───────
    //
    // CloudMailin shape:
    //   payload.envelope.from  — sender address
    //   payload.headers.Subject (or .subject) — subject line
    //   payload.html           — HTML body
    //   payload.plain          — plain text body
    //
    // Standard (our own test format):
    //   payload.from, payload.subject, payload.html, payload.text

    let from: string;
    let subject: string;
    let html: string;
    let text: string;
    let to: string;

    if (payload.envelope?.from) {
      // CloudMailin format
      from = String(payload.envelope.from ?? "");
      subject = String(payload.headers?.Subject ?? payload.headers?.subject ?? "");
      html = String(payload.html ?? "");
      text = String(payload.plain ?? "");
      to = String(payload.envelope?.to ?? payload.headers?.To ?? "");
    } else {
      // Standard format
      from = String(payload.from ?? "");
      subject = String(payload.subject ?? "");
      html = String(payload.html ?? "");
      text = String(payload.text ?? "");
      to = String(payload.to ?? "");
    }

    console.log("[email-inbound] from:", from, "| subject:", subject);

    if (!from || !subject) {
      console.warn("[email-inbound] missing from or subject — dropping");
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await inngest.send({
      name: "email/booking-received",
      data: { from, subject, html, text, to },
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[email-inbound] error:", err);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
