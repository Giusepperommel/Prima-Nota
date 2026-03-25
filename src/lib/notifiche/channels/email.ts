import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNotificaEmail(to: string, titolo: string, messaggio: string): Promise<boolean> {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Prima Nota <noreply@primanota.app>",
      to,
      subject: titolo,
      text: messaggio,
    });
    return true;
  } catch (error) {
    console.error("Failed to send notification email:", error);
    return false;
  }
}
