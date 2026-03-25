import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = await req.json() as Record<string, any>;

    // ── Normalise — CloudMailin JSON (Normalized) format ─────────────────────
    // envelope.from     → sender address
    // envelope.to       → recipient address
    // headers.subject   → subject line
    // html              → HTML body
    // plain             → plain text body
    //
    // Also handles plain JSON (manual test posts):
    // { from, subject, html, text }

    let from: string;
    let subject: string;
    let html: string;
    let text: string;
    let to: string;

    if (payload.envelope?.from) {
      // CloudMailin JSON (Normalized)
      from    = String(payload.envelope.from ?? "");
      to      = String(payload.envelope.to ?? "");
      subject = String(payload.headers?.subject ?? payload.headers?.Subject ?? "");
      html    = String(payload.html  ?? "");
      text    = String(payload.plain ?? "");
    } else {
      // Plain JSON (test / fallback)
      from    = String(payload.from    ?? "");
      to      = String(payload.to      ?? "");
      subject = String(payload.subject ?? "");
      html    = String(payload.html    ?? "");
      text    = String(payload.text    ?? "");
    }

    console.log("[email-inbound] from:", from, "| to:", to, "| subject:", subject);

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
