import type { MovimentoGenerato } from "./validazione-scrittura";
import type { ContoResolver } from "./conto-resolver";

export interface OperazioneContabile {
  tipoOperazione: string;
  dataOperazione: Date;
  descrizione: string;
  importoTotale: number;
  importoImponibile?: number;
  importoIva?: number;
  aliquotaIva?: number;
  ivaDetraibile?: number;
  ivaIndetraibile?: number;
  importoRitenuta?: number;
  importoNettoRitenuta?: number;
  statoPagamentoFattura?: string;
  splitPayment?: boolean;
  doppiaRegistrazione?: boolean;
  bolloVirtuale?: boolean;
  importoBollo?: number;
  numeroDocumento?: string;
}

export interface GeneratoreInput {
  operazione: OperazioneContabile;
  societaId: number;
  categoriaContoId: number | null;
  anagraficaDenominazione?: string;
  contoEsplicito?: number | null;
  causaleOverride?: string;
}

export interface ScritturaGenerata {
  descrizione: string;
  causale: string;
  movimenti: MovimentoGenerato[];
  totaleDare: number;
  totaleAvere: number;
  warnings: string[];
}

export type Generatore = (input: GeneratoreInput, resolver: ContoResolver) => ScritturaGenerata | ScritturaGenerata[];
