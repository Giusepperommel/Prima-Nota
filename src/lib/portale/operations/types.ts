export interface IncassoData {
  importo: number;
  cliente: string;
  data: string;
  metodoPagamento: string;
  descrizione?: string;
}

export interface PagamentoData {
  importo: number;
  fornitore: string;
  data: string;
  categoria?: string;
  descrizione?: string;
}

export interface FatturaData {
  fileUrl: string;
  note?: string;
}

export type OperazionePortaleData = IncassoData | PagamentoData | FatturaData;

export interface CreateOperazioneInput {
  societaId: number;
  accessoClienteId: number;
  tipo: "INCASSO" | "PAGAMENTO" | "FATTURA";
  dati: OperazionePortaleData;
  documentoAllegato?: string;
}
