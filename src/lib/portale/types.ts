export type PortaleTokenPayload = {
  accessoClienteId: number;
  societaId: number;
  ruolo: string;
};

export type PortaleLoginInput = {
  email: string;
  password: string;
  societaId: number;
};
