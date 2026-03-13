import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function inviaOtpEmail(
  email: string,
  nome: string,
  codice: string
) {
  // In dev senza API key valida, logga il codice in console
  if (!process.env.RESEND_API_KEY || process.env.NODE_ENV === "development") {
    console.log(`\n========================================`);
    console.log(`  OTP per ${email}: ${codice}`);
    console.log(`========================================\n`);
  }

  const { error } = await resend.emails.send({
    from: `Prima Nota <${fromEmail}>`,
    to: email,
    subject: `Il tuo codice di verifica: ${codice}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 16px;">Prima Nota</h2>
        <p>Ciao ${nome},</p>
        <p>Il tuo codice di verifica per Prima Nota è:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${codice}</span>
        </div>
        <p style="color: #71717a; font-size: 14px;">Questo codice è valido per 1 ora.</p>
        <p style="color: #71717a; font-size: 14px;">Se non hai richiesto questo codice, puoi ignorare questa email.</p>
      </div>
    `,
  });

  if (error) {
    console.warn("Invio email fallito (ignorato in dev):", error.message);
    // In dev non bloccare il flusso se l'email fallisce
    if (process.env.NODE_ENV !== "development") {
      throw new Error("Impossibile inviare l'email di verifica");
    }
  }
}

export async function inviaResetPasswordEmail(
  email: string,
  nome: string,
  codice: string
) {
  if (!process.env.RESEND_API_KEY || process.env.NODE_ENV === "development") {
    console.log(`\n========================================`);
    console.log(`  RESET PASSWORD per ${email}: ${codice}`);
    console.log(`========================================\n`);
  }

  const { error } = await resend.emails.send({
    from: `Prima Nota <${fromEmail}>`,
    to: email,
    subject: `Reset password - Codice: ${codice}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 16px;">Prima Nota</h2>
        <p>Ciao ${nome},</p>
        <p>Hai richiesto il reset della password. Usa questo codice:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${codice}</span>
        </div>
        <p style="color: #71717a; font-size: 14px;">Questo codice è valido per 1 ora.</p>
        <p style="color: #71717a; font-size: 14px;">Se non hai richiesto il reset, puoi ignorare questa email.</p>
      </div>
    `,
  });

  if (error) {
    console.warn("Invio email reset fallito (ignorato in dev):", error.message);
    if (process.env.NODE_ENV !== "development") {
      throw new Error("Impossibile inviare l'email di reset password");
    }
  }
}
