// src/lib/email/alert-email.ts
const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "CRITICO",
  WARNING: "AVVISO",
  INFO: "INFO",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  WARNING: "#f59e0b",
  INFO: "#3b82f6",
};

export function formatAlertEmailSubject(gravita: string, messaggio: string): string {
  const label = SEVERITY_LABELS[gravita] || gravita;
  return `[${label}] ${messaggio}`;
}

interface AlertEmailData {
  messaggio: string;
  gravita: string;
  categoria: string;
  linkAzione?: string;
  societaNome: string;
}

export function formatAlertEmailHtml(data: AlertEmailData): string {
  const label = SEVERITY_LABELS[data.gravita] || data.gravita;
  const color = SEVERITY_COLORS[data.gravita] || "#6b7280";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">${label} — ${data.categoria}</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #111827; margin: 0 0 16px;">${data.messaggio}</p>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">Società: <strong>${data.societaNome}</strong></p>
        ${data.linkAzione ? `<a href="${baseUrl}${data.linkAzione}" style="display: inline-block; background: ${color}; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Vai all'azione</a>` : ""}
      </div>
    </div>
  `.trim();
}
