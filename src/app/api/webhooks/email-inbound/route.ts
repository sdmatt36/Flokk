import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    console.log("[email-inbound] received email from:", payload.from);
    console.log("[email-inbound] subject:", payload.subject);

    await inngest.send({
      name: "email/booking-received",
      data: {
        from: payload.from,
        subject: payload.subject,
        html: payload.html ?? "",
        text: payload.text ?? "",
        to: payload.to,
      },
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[email-inbound] error:", err);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
