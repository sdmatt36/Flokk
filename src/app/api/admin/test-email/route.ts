import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { sendLifecycleEmail } from "@/lib/lifecycle-emails";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json() as { to?: string; secret?: string; type?: string };

  const secret =
    req.headers.get("authorization")?.replace("Bearer ", "").trim() ??
    body.secret;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = typeof body.to === "string" && body.to.trim() ? body.to.trim() : null;
  if (!to) {
    return NextResponse.json({ error: "to is required" }, { status: 400 });
  }

  const emailType = typeof body.type === "string" ? body.type : "test";

  if (emailType === "welcome") {
    const result = await sendLifecycleEmail("welcome", { to });
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  const subject = "Flokk email test";
  const html = `<div style="font-family:sans-serif;padding:32px;max-width:480px;">
      <h2 style="color:#1B3A5C;margin:0 0 12px;">Flokk email test</h2>
      <p style="color:#333;margin:0 0 8px;">This is a test send from the Flokk platform.</p>
      <p style="color:#333;margin:0 0 16px;">If you received this, Resend is delivering from <strong>hello@flokktravel.com</strong>.</p>
      <p style="color:#999;font-size:12px;margin:0;">Sent at ${new Date().toISOString()}</p>
    </div>`;

  const result = await sendEmail(to, subject, html, emailType, { replyTo: "hello@flokktravel.com" });
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
