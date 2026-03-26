import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllAlertRules } from "@/lib/intelligence/alert-engine/evaluator";

/**
 * GET /api/configurazione/alert
 * Lista regole DB + regole builtin. Auth richiesta.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    if (!societaId) {
      return NextResponse.json({ error: "Nessuna societa selezionata" }, { status: 400 });
    }

    const dbRules = await prisma.regolaAlert.findMany({
      where: { OR: [{ societaId }, { societaId: null }] },
      orderBy: [{ categoria: "asc" }, { codice: "asc" }],
    });

    const builtinRules = getAllAlertRules().map((r) => ({
      codice: r.codice,
      categoria: r.categoria,
      descrizione: r.descrizione,
      defaultGravita: r.defaultGravita,
      defaultSogliaGiorni: r.defaultSogliaGiorni ?? null,
      defaultSogliaValore: r.defaultSogliaValore ?? null,
    }));

    return NextResponse.json({ regole: dbRules, regoleBuiltin: builtinRules });
  } catch (error) {
    console.error("Errore GET /api/configurazione/alert:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/configurazione/alert
 * Crea o aggiorna un override di regola per la societa. Solo admin.
 * Body: { codice, sogliaValore?, sogliaGiorni?, gravita?, attiva?, canali?, ruoliDestinatari? }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json(
        { error: "Accesso riservato agli amministratori" },
        { status: 403 }
      );
    }

    const societaId = user.societaId as number;
    if (!societaId) {
      return NextResponse.json({ error: "Nessuna societa selezionata" }, { status: 400 });
    }

    const body = await request.json();
    const { codice, sogliaValore, sogliaGiorni, gravita, attiva, canali, ruoliDestinatari } = body;

    if (!codice || typeof codice !== "string") {
      return NextResponse.json(
        { error: "Codice regola obbligatorio" },
        { status: 400 }
      );
    }

    // Check if a society-specific override already exists
    const existing = await prisma.regolaAlert.findFirst({
      where: { codice, societaId },
    });

    if (existing) {
      const updated = await prisma.regolaAlert.update({
        where: { id: existing.id },
        data: {
          ...(sogliaValore !== undefined && { sogliaValore }),
          ...(sogliaGiorni !== undefined && { sogliaGiorni }),
          ...(gravita !== undefined && { gravita }),
          ...(attiva !== undefined && { attiva }),
          ...(canali !== undefined && { canali }),
          ...(ruoliDestinatari !== undefined && { ruoliDestinatari }),
        },
      });
      return NextResponse.json({ regola: updated });
    }

    // Create society-specific override from builtin rule
    const builtin = getAllAlertRules().find((r) => r.codice === codice);
    if (!builtin) {
      return NextResponse.json({ error: "Regola non trovata" }, { status: 404 });
    }

    const created = await prisma.regolaAlert.create({
      data: {
        societaId,
        categoria: builtin.categoria as any,
        codice,
        descrizione: builtin.descrizione,
        sogliaValore: sogliaValore ?? builtin.defaultSogliaValore ?? null,
        sogliaGiorni: sogliaGiorni ?? builtin.defaultSogliaGiorni ?? null,
        gravita: gravita ?? builtin.defaultGravita,
        attiva: attiva ?? true,
        canali: canali ?? ["IN_APP"],
        ruoliDestinatari: ruoliDestinatari ?? ["ADMIN"],
      },
    });

    return NextResponse.json({ regola: created }, { status: 201 });
  } catch (error) {
    console.error("Errore PUT /api/configurazione/alert:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
