export interface CreateThreadInput {
  societaId: number;
  accessoClienteId: number;
  oggetto: string;
  contestoTipo?: "DOCUMENTO" | "SCADENZA" | "OPERAZIONE" | "ALERT" | "LIBERO";
  contestoId?: number;
  testoIniziale: string;
  mittenteTipo: "CLIENTE" | "COMMERCIALISTA";
  mittenteId: number;
}

export interface SendMessageInput {
  threadId: number;
  societaId: number;
  accessoClienteId: number;
  mittenteTipo: "CLIENTE" | "COMMERCIALISTA";
  mittenteId: number;
  testo: string;
}
