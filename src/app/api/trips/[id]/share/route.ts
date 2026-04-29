import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

function formatDate(d: Date | null, includeYear = false): string {
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

function buildShareEmailHtml({
  recipientName,
  sharerName,
  tripTitle,
  destinationCity,
  nights,
  startStr,
  endStr,
  shareUrl,
  isAcquisition,
}: {
  recipientName: string;
  sharerName: string;
  tripTitle: string;
  destinationCity: string | null;
  nights: number | null;
  startStr: string;
  endStr: string;
  shareUrl: string;
  isAcquisition: boolean;
}): string {
  const dest = destinationCity ?? "their destination";
  const tripMeta = [
    dest,
    nights ? `${nights} nights` : null,
    startStr && endStr ? `${startStr} – ${endStr}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const greeting = isAcquisition ? "Hi there," : `Hi ${recipientName},`;
  const intro = isAcquisition
    ? `<strong>${sharerName}</strong> planned a family trip to <strong>${dest}</strong> and thought you'd want to see it.`
    : `<strong>${sharerName}</strong> thought you'd want to see their <strong>${tripTitle}</strong> itinerary.`;

  const body = isAcquisition
    ? `Browse the full day-by-day plan — every activity, restaurant, and hotel they mapped out. If you want to copy it and make it your own, Flokk is free to join.`
    : `You can browse every day, copy the whole trip to your Flokk account, or just steal the best bits.`;

  const ps = isAcquisition
    ? `<p style="font-size:12px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:16px;">P.S. Flokk is a family travel platform that turns saved Instagram posts, booking confirmations, and Google Maps stars into an actual trip plan. Free to get started.</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eee;">
        <!-- Header bar -->
        <tr><td style="background:#C4664A;padding:6px 24px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#fff;letter-spacing:0.05em;">flokk</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 32px 24px;">
          <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a;line-height:1.5;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;line-height:1.6;">${intro}</p>

          <!-- Trip card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F5;border:1px solid rgba(196,102,74,0.15);border-radius:12px;margin:20px 0;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#1B3A5C;">${tripTitle}</p>
              <p style="margin:0;font-size:13px;color:#888;">${tripMeta}</p>
            </td></tr>
          </table>

          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">${body}</p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#C4664A;border-radius:8px;padding:12px 28px;">
              <a href="${shareUrl}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none;">See the full itinerary →</a>
            </td></tr>
          </table>

          <p style="margin:32px 0 0;font-size:13px;color:#888;">— ${sharerName} via Flokk</p>
          ${ps}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { recipientFamilyId?: string; recipientEmail?: string };
  const { recipientFamilyId, recipientEmail } = body;

  if (!recipientFamilyId && !recipientEmail) {
    return NextResponse.json({ error: "Provide recipientFamilyId or recipientEmail" }, { status: 400 });
  }

  // Fetch trip + sharer info
  const trip = await db.trip.findFirst({
    where: {
      id,
      familyProfile: { user: { clerkId: userId } },
    },
    include: {
      familyProfile: { include: { user: true } },
    },
  });

  if (!trip || !trip.familyProfile) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (!trip.shareToken) return NextResponse.json({ error: "Trip has no share token" }, { status: 400 });

  const sharerName = trip.familyProfile.familyName
    ? `${trip.familyProfile.familyName} Family`
    : "A Flokk family";
  const sharerEmail = trip.familyProfile.user.email;
  const shareUrl = `https://www.flokktravel.com/share/${trip.shareToken}`;

  const nights =
    trip.startDate && trip.endDate
      ? Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
  const startStr = formatDate(trip.startDate);
  const endStr = formatDate(trip.endDate);

  if (recipientFamilyId) {
    // Existing Flokk user
    const recipient = await db.familyProfile.findUnique({
      where: { id: recipientFamilyId },
      include: { user: true },
    });
    if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

    const recipientName = recipient.familyName ? `${recipient.familyName} Family` : "there";

    await resend.emails.send({
      from: "Flokk <hello@flokktravel.com>",
      replyTo: sharerEmail,
      to: recipient.user.email,
      subject: `${sharerName} shared their ${trip.destinationCity ?? "trip"} trip with you`,
      html: buildShareEmailHtml({
        recipientName,
        sharerName,
        tripTitle: trip.title,
        destinationCity: trip.destinationCity,
        nights,
        startStr,
        endStr,
        shareUrl,
        isAcquisition: false,
      }),
    });
  } else if (recipientEmail) {
    // Non-Flokk user — acquisition email
    await resend.emails.send({
      from: `${sharerName} via Flokk <hello@flokktravel.com>`,
      to: recipientEmail,
      subject: `${sharerName} shared their ${trip.destinationCity ?? "trip"} trip with you`,
      html: buildShareEmailHtml({
        recipientName: "",
        sharerName,
        tripTitle: trip.title,
        destinationCity: trip.destinationCity,
        nights,
        startStr,
        endStr,
        shareUrl,
        isAcquisition: true,
      }),
    });
  }

  return NextResponse.json({ success: true });
}
