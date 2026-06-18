import { Resend } from "resend";
import { db } from "@/lib/db";

const FROM = "Flokk <hello@flokktravel.com>";

export type SendEmailResult =
  | { success: true; id: string; logId: string }
  | { success: false; error: string; logId: string };

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  type: string,
  options?: { replyTo?: string; tripId?: string; headers?: Record<string, string> }
): Promise<SendEmailResult> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  let status: "sent" | "failed" = "failed";
  let providerMessageId: string | undefined;
  let errorMessage: string | undefined;

  try {
    const res = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      ...(options?.replyTo ? { replyTo: options.replyTo } : {}),
      ...(options?.headers ? { headers: options.headers } : {}),
    });
    if (res.error) {
      errorMessage = `${res.error.name}: ${res.error.message}`;
      console.error("[email] Resend error:", res.error);
    } else if (res.data?.id) {
      status = "sent";
      providerMessageId = res.data.id;
      console.log("[email] sent to", to, "id:", providerMessageId, "type:", type);
    } else {
      errorMessage = "Resend returned no id and no error";
      console.error("[email] unexpected empty response");
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
    console.error("[email] send threw:", e);
  }

  const log = await db.emailLog.create({
    data: {
      recipient: to,
      type,
      subject,
      provider: "resend",
      providerMessageId: providerMessageId ?? null,
      status,
      errorMessage: errorMessage ?? null,
      tripId: options?.tripId ?? null,
    },
  });

  if (status === "sent") {
    return { success: true, id: providerMessageId!, logId: log.id };
  }
  return { success: false, error: errorMessage ?? "unknown", logId: log.id };
}
