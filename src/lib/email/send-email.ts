// src/lib/email/send-email.ts
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const DEFAULT_FROM = process.env.EMAIL_FROM || "Prima Nota <noreply@primanota.app>";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export function buildEmailPayload(input: EmailPayload & { from?: string }): { to: string; from: string; subject: string; html: string } {
  return {
    to: input.to,
    from: input.from || DEFAULT_FROM,
    subject: input.subject,
    html: input.html,
  };
}

export async function sendEmail(input: EmailPayload): Promise<EmailResult> {
  const payload = buildEmailPayload(input);

  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set, skipping email send");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const result = await getResend().emails.send(payload);
    if (result.error) {
      console.error("[Email] Send error:", result.error);
      return { success: false, error: result.error.message };
    }
    return { success: true, messageId: result.data?.id };
  } catch (error: unknown) {
    console.error("[Email] Exception:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
