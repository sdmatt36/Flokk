import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { Resend } from "resend";
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

async function getFamilyProfile(userId: string) {
  const user = await db.user.findFirst({
    where: { clerkId: userId },
    include: { familyProfile: true },
  });
  return user?.familyProfile ?? null;
}

// GET — return verified emails + pending verifications
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fp = await getFamilyProfile(userId);
  if (!fp) return NextResponse.json({ senderEmails: [], pending: [] });

  const pending = await db.senderEmailVerification.findMany({
    where: {
      familyProfileId: fp.id,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ senderEmails: fp.senderEmails ?? [], pending });
}

// PATCH — action: "add" | "remove" | "resend"
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fp = await getFamilyProfile(userId);
  if (!fp) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { action, email } = await req.json() as { action: "add" | "remove" | "resend"; email: string };
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const normalized = email.trim().toLowerCase();

  if (action === "remove") {
    // Remove from verified list and delete any pending verifications
    const updated = (fp.senderEmails ?? []).filter((e) => e !== normalized);
    await db.familyProfile.update({
      where: { id: fp.id },
      data: { senderEmails: updated },
    });
    await db.senderEmailVerification.deleteMany({
      where: { familyProfileId: fp.id, email: normalized },
    });
    return NextResponse.json({ senderEmails: updated });
  }

  if (action === "add" || action === "resend") {
    // If already verified, no-op
    if ((fp.senderEmails ?? []).includes(normalized)) {
      return NextResponse.json({ senderEmails: fp.senderEmails, alreadyVerified: true });
    }

    // Delete any existing pending verifications for this email
    await db.senderEmailVerification.deleteMany({
      where: { familyProfileId: fp.id, email: normalized },
    });

    // Create new verification record
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await db.senderEmailVerification.create({
      data: {
        familyProfileId: fp.id,
        email: normalized,
        token,
        expiresAt,
      },
    });

    // Send verification email via Resend
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.flokktravel.com";
    const verifyUrl = `${appUrl}/api/profile/verify-sender-email?token=${token}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Flokk <hello@flokktravel.com>",
      to: normalized,
      subject: "Verify your email for Flokk",
      text: [
        "Someone added this email to a Flokk account as an approved booking sender.",
        "",
        "If this was you, click the link below to verify this address. Booking confirmation emails you forward from this address will then be automatically imported into your trip.",
        "",
        `Verify: ${verifyUrl}`,
        "",
        "This link expires in 24 hours.",
        "",
        "If you didn't request this, you can safely ignore this email.",
        "",
        "— The Flokk Team",
      ].join("\n"),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <p style="font-size:16px;font-weight:700;color:#1B3A5C;margin:0 0 8px;">Verify your email for Flokk</p>
          <p style="font-size:14px;color:#444;margin:0 0 16px;line-height:1.6;">
            Someone added this email to a Flokk account as an approved booking sender.
            If this was you, click below to verify — booking confirmations forwarded from this address will be automatically imported into your trip.
          </p>
          <a href="${verifyUrl}" style="display:inline-block;background:#1B3A5C;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
            Verify email →
          </a>
          <p style="font-size:12px;color:#999;margin:20px 0 0;">This link expires in 24 hours. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    // Return updated pending list
    const pending = await db.senderEmailVerification.findMany({
      where: {
        familyProfileId: fp.id,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ senderEmails: fp.senderEmails ?? [], pending, sent: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
