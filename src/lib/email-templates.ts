const LOGO_URL = "https://www.flokktravel.com/favicon.png";

export function greet(firstName?: string | null): string {
  const name = firstName?.trim();
  return `Hi${name ? `, ${name}` : ", Flokker"}!`;
}

export function emailLayout(
  body: string,
  opts: { marketing?: boolean } = {}
): string {
  const unsubscribe = opts.marketing
    ? `<p style="margin:8px 0 0;font-size:12px;color:#bbb;font-family:Arial,sans-serif;">
         To stop receiving marketing emails,&nbsp;<a href="{{{unsubscribeUrl}}}" style="color:#bbb;">unsubscribe here</a>.
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#1B3A5C;padding:20px 32px;">
            <img src="${LOGO_URL}" width="32" height="32" alt="" style="display:inline-block;vertical-align:middle;border:0;" />
            <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">Flokk</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;font-size:16px;line-height:1.6;color:#2c2c2c;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f0ebe3;text-align:center;">
            <p style="margin:0;font-size:13px;color:#999;font-family:Arial,sans-serif;">Reply to this email with any questions</p>
            ${unsubscribe}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
