import { CONTI_STRUTTURALI, type ContoStrutturale } from "./causali";

export interface ResolveResult {
  contoId: number | null;
  warning: string | null;
}

export interface ResolveOptions {
  esplicito: number | null;
  categoriaContoId: number | null;
  strutturale: ContoStrutturale;
}

export class ContoResolver {
  private pdcMap: Map<string, number>;

  constructor(pdcMap: Map<string, number>) {
    this.pdcMap = pdcMap;
  }

  resolveEsplicito(contoId: number | null): ResolveResult {
    if (contoId === null || contoId === undefined) {
      return { contoId: null, warning: "Nessun conto esplicito fornito" };
    }
    return { contoId, warning: null };
  }

  resolveCategoria(contoDefaultId: number | null | undefined): ResolveResult {
    if (contoDefaultId === null || contoDefaultId === undefined) {
      return { contoId: null, warning: "La categoria non ha un conto di default associato" };
    }
    return { contoId: contoDefaultId, warning: null };
  }

  resolveStrutturale(key: ContoStrutturale): ResolveResult {
    const codice = CONTI_STRUTTURALI[key];
    const id = this.pdcMap.get(codice);
    if (id === undefined) {
      return {
        contoId: null,
        warning: `Conto strutturale ${key} (${codice}) non trovato nel Piano dei Conti`,
      };
    }
    return { contoId: id, warning: null };
  }

  resolve(options: ResolveOptions): ResolveResult {
    if (options.esplicito !== null && options.esplicito !== undefined) {
      return this.resolveEsplicito(options.esplicito);
    }
    if (options.categoriaContoId !== null && options.categoriaContoId !== undefined) {
      return this.resolveCategoria(options.categoriaContoId);
    }
    return this.resolveStrutturale(options.strutturale);
  }

  getStrutturale(key: ContoStrutturale): number | null {
    return this.resolveStrutturale(key).contoId;
  }
}
