import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Escape user-provided text for safe inclusion in the HTML email body.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br>");

export async function POST(req: Request) {
  try {
    const { firstName, lastName, email, subject, message } = await req.json() as {
      firstName: string;
      lastName: string;
      email: string;
      subject: string;
      message: string;
    };

    if (!firstName || !email || !subject || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    console.log("[contact] form submission from", email);

    // Notification to the team inbox. Routed through the shared sendEmail path so it writes an
    // EmailLog row like the rest of our email. from = hello@flokktravel.com (fixed in lib/email);
    // replyTo = the sender so we can reply directly.
    const notify = await sendEmail(
      "hello@flokktravel.com",
      `Flokk contact form: ${subject}`,
      [
        `<p><strong>Name:</strong> ${esc(fullName)}</p>`,
        `<p><strong>Email:</strong> ${esc(email)}</p>`,
        `<p><strong>Subject:</strong> ${esc(subject)}</p>`,
        `<p><strong>Message:</strong></p>`,
        `<p>${nl2br(message)}</p>`,
      ].join(""),
      "contact_notification",
      { replyTo: email },
    );
    if (!notify.success) console.error("[contact] notification send failed:", notify.error);

    // Confirmation to the sender.
    const confirm = await sendEmail(
      email,
      "We got your message",
      [
        `<p>Hi ${esc(firstName)},</p>`,
        `<p>Thanks for reaching out — we'll get back to you within 24 hours.</p>`,
        `<p>— Matt, Flokk</p>`,
        `<hr>`,
        `<p>Your message:</p>`,
        `<p>"${nl2br(message)}"</p>`,
      ].join(""),
      "contact_confirmation",
    );
    if (!confirm.success) console.error("[contact] confirmation send failed:", confirm.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact] submission error:", error);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
