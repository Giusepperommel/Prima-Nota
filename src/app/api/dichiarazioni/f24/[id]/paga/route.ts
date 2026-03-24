import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const f24 = await prisma.f24Versamento.findFirst({
      where: { id, societaId: user.societaId },
    });

    if (!f24) {
      return NextResponse.json({ error: "F24 non trovato" }, { status: 404 });
    }

    const body = await request.json();
    const { dataPagamento } = body;

    if (!dataPagamento) {
      return NextResponse.json(
        { error: "dataPagamento obbligatoria" },
        { status: 400 },
      );
    }

    const updated = await prisma.f24Versamento.update({
      where: { id },
      data: {
        dataPagamento: new Date(dataPagamento),
        stato: "PAGATO",
      },
    });

    return NextResponse.json({
      success: true,
      id: updated.id,
      stato: updated.stato,
      dataPagamento: updated.dataPagamento,
    });
  } catch (error) {
    console.error("Errore nel pagamento F24:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
