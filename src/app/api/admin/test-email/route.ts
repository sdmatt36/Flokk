import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { emailLayout, greet } from "@/lib/email-templates";

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

  let subject: string;
  let html: string;

  if (emailType === "welcome") {
    subject = "Welcome to Flokk";
    html = emailLayout(
      `<p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#1B3A5C;">${greet(null)}</p>
       <p style="margin:0 0 16px;">Welcome to Flokk &mdash; your personal travel save, plan, and share hub.</p>
       <p style="margin:0 0 16px;">Start by saving a restaurant, hotel, or experience you&rsquo;ve been eyeing. Your first save takes about 10 seconds.</p>
       <p style="margin:0;">— Matt</p>`,
    );
  } else {
    subject = "Flokk email test";
    html = `<div style="font-family:sans-serif;padding:32px;max-width:480px;">
      <h2 style="color:#1B3A5C;margin:0 0 12px;">Flokk email test</h2>
      <p style="color:#333;margin:0 0 8px;">This is a test send from the Flokk platform.</p>
      <p style="color:#333;margin:0 0 16px;">If you received this, Resend is delivering from <strong>hello@flokktravel.com</strong>.</p>
      <p style="color:#999;font-size:12px;margin:0;">Sent at ${new Date().toISOString()}</p>
    </div>`;
  }

  const result = await sendEmail(to, subject, html, emailType, { replyTo: "hello@flokktravel.com" });
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
