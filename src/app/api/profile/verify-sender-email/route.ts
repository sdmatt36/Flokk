import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/profile?verify=invalid", req.url));
  }

  const verification = await db.senderEmailVerification.findUnique({
    where: { token },
    include: { familyProfile: true },
  });

  if (!verification) {
    return NextResponse.redirect(new URL("/profile?verify=invalid", req.url));
  }

  if (verification.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/profile?verify=expired", req.url));
  }

  if (verification.verifiedAt) {
    // Already verified — just redirect as success
    return NextResponse.redirect(new URL("/profile?verify=ok", req.url));
  }

  // Mark verified and add to senderEmails
  await db.senderEmailVerification.update({
    where: { token },
    data: { verifiedAt: new Date() },
  });

  const current = verification.familyProfile.senderEmails ?? [];
  if (!current.includes(verification.email)) {
    await db.familyProfile.update({
      where: { id: verification.familyProfileId },
      data: { senderEmails: [...current, verification.email] },
    });
  }

  console.log("[verify-sender-email] verified:", verification.email, "familyProfileId:", verification.familyProfileId);
  return NextResponse.redirect(new URL("/profile?verify=ok", req.url));
}
