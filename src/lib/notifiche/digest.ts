import type { Notifica, NotificaPriorita } from "@prisma/client";

type GroupedNotifiche = Record<NotificaPriorita, Notifica[]>;

const PRIORITY_ORDER: NotificaPriorita[] = ["CRITICA", "ALTA", "MEDIA", "BASSA"];

const PRIORITY_LABELS: Record<NotificaPriorita, string> = {
  CRITICA: "Critica",
  ALTA: "Alta",
  MEDIA: "Media",
  BASSA: "Bassa",
};

const PRIORITY_COLORS: Record<NotificaPriorita, string> = {
  CRITICA: "#dc2626",
  ALTA: "#ea580c",
  MEDIA: "#ca8a04",
  BASSA: "#6b7280",
};

export function groupNotificheByPriorita(notifiche: Notifica[]): GroupedNotifiche {
  const grouped: GroupedNotifiche = {
    CRITICA: [],
    ALTA: [],
    MEDIA: [],
    BASSA: [],
  };

  for (const notifica of notifiche) {
    grouped[notifica.priorita].push(notifica);
  }

  return grouped;
}

export function buildDigestHtml(notifiche: Notifica[], frequenza: string): string {
  if (notifiche.length === 0) return "";

  const grouped = groupNotificheByPriorita(notifiche);

  const sections = PRIORITY_ORDER
    .filter((p) => grouped[p].length > 0)
    .map((priorita) => {
      const items = grouped[priorita]
        .map(
          (n) =>
            `<li style="margin-bottom:8px;"><strong>${n.titolo}</strong><br/><span style="color:#555;">${n.messaggio}</span></li>`
        )
        .join("");

      return `
        <h3 style="color:${PRIORITY_COLORS[priorita]};margin-top:16px;">
          ${PRIORITY_LABELS[priorita]} (${grouped[priorita].length})
        </h3>
        <ul style="list-style:none;padding-left:0;">${items}</ul>
      `;
    })
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1e293b;">Riepilogo ${frequenza} notifiche</h2>
      <p style="color:#64748b;">Hai ${notifiche.length} notifiche non lette.</p>
      ${sections}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin-top:24px;"/>
      <p style="color:#94a3b8;font-size:12px;">Prima Nota - Gestione contabile</p>
    </div>
  `;
}
