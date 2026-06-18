import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const CONFIRM_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed — Flokk</title>
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;">
    <tr><td align="center" style="padding:64px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#fff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1B3A5C;padding:20px 32px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.02em;">flokk<span style="color:#C4664A;">.</span></span>
        </td></tr>
        <tr><td style="padding:40px 32px;">
          <h2 style="margin:0 0 12px;font-size:22px;color:#1B3A5C;font-family:Arial,Helvetica,sans-serif;">You are unsubscribed.</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#4A5568;line-height:1.6;">You will no longer receive marketing emails from Flokk.</p>
          <p style="margin:0;font-size:14px;color:#6B7A8D;line-height:1.6;">You will still receive transactional emails such as booking confirmations and trip reminders. Reply to any email if you have questions.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const BAD_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Invalid link — Flokk</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;padding:40px;color:#4A5568;">
  <p>This unsubscribe link is invalid or has expired. Reply to any Flokk email and we will remove you manually.</p>
</body>
</html>`;

function parseAndVerify(tokenParam: string): string | null {
  const dot = tokenParam.indexOf(".");
  if (dot === -1) return null;

  const b64email = tokenParam.slice(0, dot);
  const hmac = tokenParam.slice(dot + 1);

  let email: string;
  try {
    email = Buffer.from(b64email, "base64url").toString();
  } catch {
    return null;
  }

  const secret = process.env.CRON_SECRET ?? "dev";
  const expected = crypto.createHmac("sha256", secret).update(email).digest("hex");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }
  } catch {
    return null;
  }

  return email;
}

async function handleUnsubscribe(tokenParam: string): Promise<NextResponse> {
  const email = parseAndVerify(tokenParam);
  if (!email) {
    return new NextResponse(BAD_HTML, { status: 400, headers: { "Content-Type": "text/html" } });
  }

  try {
    await db.user.update({
      where: { email },
      data: { marketingOptOut: true },
    });
  } catch {
    // User not found — treat as success
  }

  return new NextResponse(CONFIRM_HTML, { status: 200, headers: { "Content-Type": "text/html" } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return handleUnsubscribe(token);
}

// RFC 8058 one-click unsubscribe
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return handleUnsubscribe(token);
}
