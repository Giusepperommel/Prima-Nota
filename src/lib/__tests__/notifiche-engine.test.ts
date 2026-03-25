import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationEngine } from "../notifiche/engine";

vi.mock("../prisma", () => ({
  prisma: {
    notifica: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    preferenzaNotifica: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    utente: {
      findUnique: vi.fn().mockResolvedValue({ email: "test@example.com" }),
    },
  },
}));

vi.mock("../notifiche/channels/email", () => ({
  sendNotificaEmail: vi.fn().mockResolvedValue(true),
}));

import { prisma } from "../prisma";
import { sendNotificaEmail } from "../notifiche/channels/email";

describe("NotificationEngine", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("send", () => {
    it("creates notification in database", async () => {
      const engine = new NotificationEngine();
      await engine.send({ societaId: 1, utenteDestinatarioId: 1, tipo: "SCADENZA", priorita: "ALTA", titolo: "F24 in scadenza", messaggio: "Scade tra 3gg" });
      expect(prisma.notifica.create).toHaveBeenCalledWith({ data: expect.objectContaining({ societaId: 1, tipo: "SCADENZA", priorita: "ALTA", canale: "IN_APP" }) });
    });

    it("sends email immediately for CRITICA priority", async () => {
      const engine = new NotificationEngine();
      await engine.send({ societaId: 1, utenteDestinatarioId: 1, tipo: "ANOMALIA", priorita: "CRITICA", titolo: "Fattura scartata", messaggio: "FT-001 scartata" });
      expect(sendNotificaEmail).toHaveBeenCalled();
    });

    it("does NOT send email for BASSA priority", async () => {
      const engine = new NotificationEngine();
      await engine.send({ societaId: 1, utenteDestinatarioId: 1, tipo: "SYNC", priorita: "BASSA", titolo: "Sync ok", messaggio: "Done" });
      expect(sendNotificaEmail).not.toHaveBeenCalled();
    });

    it("respects user preference to disable email", async () => {
      vi.mocked(prisma.preferenzaNotifica.findFirst).mockResolvedValue({
        id: 1, utenteId: 1, tipoEvento: "ANOMALIA", canale: "EMAIL",
        abilitato: false, digestFrequency: "IMMEDIATO", createdAt: new Date(), updatedAt: new Date(),
      });
      const engine = new NotificationEngine();
      await engine.send({ societaId: 1, utenteDestinatarioId: 1, tipo: "ANOMALIA", priorita: "CRITICA", titolo: "Test", messaggio: "Test" });
      expect(prisma.notifica.create).toHaveBeenCalled();
      expect(sendNotificaEmail).not.toHaveBeenCalled();
    });
  });

  describe("markAsRead", () => {
    it("updates notification status", async () => {
      const engine = new NotificationEngine();
      await engine.markAsRead(1, 1);
      expect(prisma.notifica.updateMany).toHaveBeenCalledWith({ where: { id: 1, utenteDestinatarioId: 1 }, data: { stato: "LETTA" } });
    });
  });
});
