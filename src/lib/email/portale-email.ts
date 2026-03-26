// src/lib/email/portale-email.ts
export function formatPortaleMessageSubject(clienteNome: string, oggetto: string): string {
  return `Nuovo messaggio da ${clienteNome}: ${oggetto}`;
}

interface PortaleMessageEmailData {
  clienteNome: string;
  oggetto: string;
  testo: string;
  societaNome: string;
}

export function formatPortaleMessageHtml(data: PortaleMessageEmailData): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">Nuovo messaggio dal portale</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px;">Da: <strong>${data.clienteNome}</strong> — ${data.societaNome}</p>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">Oggetto: <strong>${data.oggetto}</strong></p>
        <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 0 0 16px;">
          <p style="font-size: 15px; color: #111827; margin: 0; white-space: pre-wrap;">${data.testo.slice(0, 500)}${data.testo.length > 500 ? "..." : ""}</p>
        </div>
        <a href="${baseUrl}/portale/inbox" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Apri Inbox</a>
      </div>
    </div>
  `.trim();
}
