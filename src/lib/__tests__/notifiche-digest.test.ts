import { describe, it, expect } from "vitest";
import { buildDigestHtml, groupNotificheByPriorita } from "../notifiche/digest";
import type { NotificaPriorita, NotificaTipo, NotificaCanale, NotificaStato } from "@prisma/client";

const makeNotifica = (titolo: string, priorita: NotificaPriorita, tipo: NotificaTipo = "SCADENZA") => ({
  id: 1, societaId: 1, utenteDestinatarioId: 1, clienteDestinatarioId: null, tipo, priorita, titolo,
  messaggio: `Dettaglio: ${titolo}`, entityType: null, entityId: null,
  canale: "IN_APP" as NotificaCanale, stato: "NON_LETTA" as NotificaStato,
  scheduledAt: null, sentAt: null, createdAt: new Date(), updatedAt: new Date(),
});

describe("groupNotificheByPriorita", () => {
  it("groups notifications by priority", () => {
    const notifiche = [makeNotifica("F24 scaduto", "CRITICA"), makeNotifica("Anomalia", "ALTA"), makeNotifica("Sync", "BASSA"), makeNotifica("Altra", "ALTA")];
    const grouped = groupNotificheByPriorita(notifiche);
    expect(grouped.CRITICA).toHaveLength(1);
    expect(grouped.ALTA).toHaveLength(2);
    expect(grouped.MEDIA).toHaveLength(0);
    expect(grouped.BASSA).toHaveLength(1);
  });
});

describe("buildDigestHtml", () => {
  it("builds HTML digest with notifications", () => {
    const notifiche = [makeNotifica("F24 scaduto", "CRITICA"), makeNotifica("Anomalia", "ALTA")];
    const html = buildDigestHtml(notifiche, "giornaliero");
    expect(html).toContain("F24 scaduto");
    expect(html).toContain("Anomalia");
    expect(html).toContain("giornaliero");
  });
  it("returns empty string for no notifications", () => {
    expect(buildDigestHtml([], "giornaliero")).toBe("");
  });
});
