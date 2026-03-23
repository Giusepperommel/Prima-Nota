import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";

export function generaFatturaAttiva(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata | ScritturaGenerata[] {
  const { operazione, categoriaContoId, contoEsplicito, causaleOverride, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];

  // Determine causale
  const isNotaCredito = causaleOverride === "NCV";
  const isSplitPayment = causaleOverride === "FVS";
  const causale = isNotaCredito ? "NCV" : isSplitPayment ? "FVS" : "FV";

  // Resolve ricavo account
  const ricavoResult = contoEsplicito
    ? resolver.resolveEsplicito(contoEsplicito)
    : resolver.resolveCategoria(categoriaContoId);

  if (ricavoResult.contoId === null) {
    warnings.push(ricavoResult.warning ?? "Conto ricavo non risolvibile — scrittura provvisoria");
  }

  const contoIdRicavo = ricavoResult.contoId;

  // Resolve structural accounts
  const contoCreditiClienti = resolver.getStrutturale("CREDITI_CLIENTI");
  const contoIvaDebito = resolver.getStrutturale("IVA_DEBITO");
  const contoRimborsoBolli = resolver.getStrutturale("RIMBORSO_BOLLI");
  const contoBancaCC = resolver.getStrutturale("BANCA_CC");

  // Extract amounts
  const importoImponibile = operazione.importoImponibile ?? operazione.importoTotale;
  const importoIva = operazione.importoIva ?? 0;
  const importoBollo = operazione.bolloVirtuale ? (operazione.importoBollo ?? 0) : 0;

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  let ordine = 1;

  if (isNotaCredito) {
    // NCV: dare/avere invertiti
    // Dare: ricavo (storno)
    movimenti.push({
      contoId: contoIdRicavo as number,
      importoDare: importoImponibile,
      importoAvere: 0,
      descrizione: "Storno ricavo",
      ordine: ordine++,
    });

    // Dare: IVA debito (storno) — only if > 0
    if (importoIva > 0) {
      movimenti.push({
        contoId: contoIvaDebito!,
        importoDare: importoIva,
        importoAvere: 0,
        descrizione: "Storno IVA a debito",
        ordine: ordine++,
      });
    }

    // Avere: crediti clienti
    movimenti.push({
      contoId: contoCreditiClienti!,
      importoDare: 0,
      importoAvere: operazione.importoTotale,
      descrizione: "Storno credito cliente",
      ordine: ordine++,
    });
  } else if (isSplitPayment) {
    // FVS: no IVA movement — PA pays IVA directly to Erario
    // Dare: crediti clienti = importoImponibile only
    movimenti.push({
      contoId: contoCreditiClienti!,
      importoDare: importoImponibile,
      importoAvere: 0,
      descrizione: "Credito verso cliente (split payment)",
      ordine: ordine++,
    });

    // Avere: ricavo
    movimenti.push({
      contoId: contoIdRicavo as number,
      importoDare: 0,
      importoAvere: importoImponibile,
      descrizione: "Ricavo vendita",
      ordine: ordine++,
    });
  } else {
    // FV: fattura vendita standard
    if (importoBollo > 0) {
      // Esente IVA con bollo
      // Dare: crediti clienti = imponibile + bollo
      movimenti.push({
        contoId: contoCreditiClienti!,
        importoDare: importoImponibile + importoBollo,
        importoAvere: 0,
        descrizione: "Credito verso cliente",
        ordine: ordine++,
      });

      // Avere: ricavo
      movimenti.push({
        contoId: contoIdRicavo as number,
        importoDare: 0,
        importoAvere: importoImponibile,
        descrizione: "Ricavo vendita",
        ordine: ordine++,
      });

      // Avere: rimborso bolli
      movimenti.push({
        contoId: contoRimborsoBolli!,
        importoDare: 0,
        importoAvere: importoBollo,
        descrizione: "Rimborso bollo virtuale",
        ordine: ordine++,
      });
    } else {
      // Standard con IVA
      // Dare: crediti clienti = importoTotale
      movimenti.push({
        contoId: contoCreditiClienti!,
        importoDare: operazione.importoTotale,
        importoAvere: 0,
        descrizione: "Credito verso cliente",
        ordine: ordine++,
      });

      // Avere: ricavo
      movimenti.push({
        contoId: contoIdRicavo as number,
        importoDare: 0,
        importoAvere: importoImponibile,
        descrizione: "Ricavo vendita",
        ordine: ordine++,
      });

      // Avere: IVA debito — only if > 0
      if (importoIva > 0) {
        movimenti.push({
          contoId: contoIvaDebito!,
          importoDare: 0,
          importoAvere: importoIva,
          descrizione: "IVA a debito",
          ordine: ordine++,
        });
      }
    }
  }

  const totaleDare = Math.round(movimenti.reduce((s, m) => s + m.importoDare, 0) * 100) / 100;
  const totaleAvere = Math.round(movimenti.reduce((s, m) => s + m.importoAvere, 0) * 100) / 100;

  const scritturaFattura: ScritturaGenerata = {
    descrizione,
    causale,
    movimenti,
    totaleDare,
    totaleAvere,
    warnings,
  };

  // Incasso immediato: generate second scrittura
  if (operazione.statoPagamentoFattura === "PAGATO") {
    // For split payment, incasso = importoImponibile; otherwise importoTotale
    const importoIncasso = isSplitPayment ? importoImponibile : operazione.importoTotale;

    const movimentiIncasso: MovimentoGenerato[] = [
      {
        contoId: contoBancaCC!,
        importoDare: importoIncasso,
        importoAvere: 0,
        descrizione: "Incasso da cliente",
        ordine: 1,
      },
      {
        contoId: contoCreditiClienti!,
        importoDare: 0,
        importoAvere: importoIncasso,
        descrizione: "Chiusura credito cliente",
        ordine: 2,
      },
    ];

    const scritturaIncasso: ScritturaGenerata = {
      descrizione,
      causale: "IN",
      movimenti: movimentiIncasso,
      totaleDare: importoIncasso,
      totaleAvere: importoIncasso,
      warnings: [],
    };

    return [scritturaFattura, scritturaIncasso];
  }

  return scritturaFattura;
}
