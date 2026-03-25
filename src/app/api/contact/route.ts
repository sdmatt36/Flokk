import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createLoopsContact } from "@/lib/loops";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Send notification to matt@flokktravel.com
    await resend.emails.send({
      from: "Flokk Contact <hello@flokktravel.com>",
      to: "matt@flokktravel.com",
      replyTo: email,
      subject: `Flokk contact form: ${subject}`,
      text: [
        `Name: ${fullName}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        ``,
        `Message:`,
        message,
      ].join("\n"),
    });

    // Send confirmation to the sender
    await resend.emails.send({
      from: "Matt at Flokk <hello@flokktravel.com>",
      to: email,
      subject: "We got your message",
      text: [
        `Hi ${firstName},`,
        ``,
        `Thanks for reaching out — we'll get back to you within 24 hours.`,
        ``,
        `— Matt, Flokk`,
        ``,
        `---`,
        `Your message:`,
        `"${message}"`,
      ].join("\n"),
    });

    // Add to Loops as a contact
    await createLoopsContact(email, firstName, lastName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact] submission error:", error);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
