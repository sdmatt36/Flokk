const LOGO_URL = "https://www.flokktravel.com/email-logo.png";

export function greet(firstName?: string | null): string {
  const name = firstName?.trim();
  return `Hi${name ? `, ${name}` : ", Flokker"}!`;
}

export function ctaButton(label: string, href: string): string {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:#C4664A;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;border-radius:999px;padding:14px 32px;letter-spacing:0.01em;">${label}</a>
  </div>`;
}

export function emailLayout(
  body: string,
  opts: { marketing?: boolean; unsubscribeUrl?: string } = {}
): string {
  const unsubscribe = opts.marketing
    ? `<p style="margin:8px 0 0;font-size:12px;color:#bbb;font-family:Arial,Helvetica,sans-serif;">
         To stop receiving marketing emails,&nbsp;<a href="${opts.unsubscribeUrl ?? "#"}" style="color:#bbb;">unsubscribe here</a>.
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#1B3A5C;padding:20px 32px;">
            <img src="${LOGO_URL}" width="120" height="34" alt="Flokk" style="display:block;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;font-size:16px;line-height:1.6;color:#2c2c2c;font-family:Arial,Helvetica,sans-serif;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f0ebe3;text-align:center;">
            <p style="margin:0;font-size:13px;color:#999;font-family:Arial,Helvetica,sans-serif;">Reply to this email with any questions</p>
            ${unsubscribe}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
