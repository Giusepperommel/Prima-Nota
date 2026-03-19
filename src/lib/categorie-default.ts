export type OpzioneUso = {
  label: string;
  codice: string;
  detraibilitaIva: number;
  deducibilitaCosto: number;
  aliquotaIva?: number;
};

export type CategoriaDefault = {
  nome: string;
  percentualeDeducibilita: number;
  descrizione: string;
  tipoCategoria: string;
  aliquotaIvaDefault: number;
  percentualeDetraibilitaIva: number;
  haOpzioniUso: boolean;
  opzioniUso: OpzioneUso[] | null;
};

const OPZIONI_AUTO_STANDARD: OpzioneUso[] = [
  { label: "Uso misto (personale + lavoro)", codice: "MISTO", detraibilitaIva: 40, deducibilitaCosto: 20 },
  { label: "Solo lavoro", codice: "ESCLUSIVO", detraibilitaIva: 100, deducibilitaCosto: 100 },
  { label: "Fringe benefit dipendenti", codice: "FRINGE_BENEFIT", detraibilitaIva: 40, deducibilitaCosto: 70 },
];

const OPZIONI_AUTO_AGENTE: OpzioneUso[] = [
  { label: "Uso misto (personale + lavoro)", codice: "MISTO", detraibilitaIva: 100, deducibilitaCosto: 80 },
  { label: "Solo lavoro", codice: "ESCLUSIVO", detraibilitaIva: 100, deducibilitaCosto: 100 },
  { label: "Fringe benefit dipendenti", codice: "FRINGE_BENEFIT", detraibilitaIva: 40, deducibilitaCosto: 70 },
];

const OPZIONI_TELEFONIA_MOBILE: OpzioneUso[] = [
  { label: "Uso misto (personale + lavoro)", codice: "MISTO", detraibilitaIva: 50, deducibilitaCosto: 80 },
  { label: "Solo lavoro", codice: "ESCLUSIVO", detraibilitaIva: 100, deducibilitaCosto: 100 },
];

const OPZIONI_AFFITTO_UFFICIO: OpzioneUso[] = [
  { label: "Con IVA (locatore soggetto IVA)", codice: "CON_IVA", detraibilitaIva: 100, deducibilitaCosto: 100, aliquotaIva: 22 },
  { label: "Senza IVA (locatore privato)", codice: "SENZA_IVA", detraibilitaIva: 0, deducibilitaCosto: 100, aliquotaIva: 0 },
];

const OPZIONI_ALBERGHI_RISTORANTI: OpzioneUso[] = [
  { label: "Spesa di lavoro (trasferta, riunione)", codice: "BUSINESS", detraibilitaIva: 100, deducibilitaCosto: 75 },
  { label: "Spesa di rappresentanza (clienti, eventi)", codice: "RAPPRESENTANZA", detraibilitaIva: 0, deducibilitaCosto: 75 },
];

type TipoAttivita = "SRL" | "SRLS" | "SNC" | "SAS" | "STP" | "DITTA_INDIVIDUALE" | "LIBERO_PROFESSIONISTA" | "AGENTE_COMMERCIO";
type RegimeFiscale = "ORDINARIO" | "FORFETTARIO";

export function getCategorieDefault(tipoAttivita: TipoAttivita, regimeFiscale: RegimeFiscale): CategoriaDefault[] {
  const isAgente = tipoAttivita === "AGENTE_COMMERCIO";
  const isForfettario = regimeFiscale === "FORFETTARIO";

  const opzioniAuto = isAgente ? OPZIONI_AUTO_AGENTE : OPZIONI_AUTO_STANDARD;
  const dedAutoMisto = isAgente ? 80 : 20;

  const categorie: CategoriaDefault[] = [
    // --- Auto ---
    {
      nome: "Carburante auto",
      percentualeDeducibilita: dedAutoMisto,
      descrizione: isAgente ? "Art. 164 TUIR - Agente di commercio" : "Art. 164 comma 1 TUIR - Uso promiscuo",
      tipoCategoria: "Auto",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: isAgente ? 100 : 40,
      haOpzioniUso: true,
      opzioniUso: opzioniAuto,
    },
    {
      nome: "Manutenzione auto",
      percentualeDeducibilita: dedAutoMisto,
      descrizione: "Riparazioni, tagliandi, revisioni",
      tipoCategoria: "Auto",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: isAgente ? 100 : 40,
      haOpzioniUso: true,
      opzioniUso: opzioniAuto,
    },
    {
      nome: "Assicurazione auto",
      percentualeDeducibilita: dedAutoMisto,
      descrizione: "RC auto, kasko, furto",
      tipoCategoria: "Auto",
      aliquotaIvaDefault: 0,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: true,
      opzioniUso: opzioniAuto,
    },
    {
      nome: "Leasing e noleggio auto",
      percentualeDeducibilita: dedAutoMisto,
      descrizione: isAgente ? "Max deducibile 5.164,57 EUR/anno" : "Max deducibile 3.615,20 EUR/anno",
      tipoCategoria: "Auto",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: isAgente ? 100 : 40,
      haOpzioniUso: true,
      opzioniUso: opzioniAuto,
    },
    {
      nome: "Acquisto auto",
      percentualeDeducibilita: dedAutoMisto,
      descrizione: isAgente ? "Art. 164 TUIR - Max deducibile 25.822,84 EUR" : "Art. 164 TUIR - Max deducibile 18.075,99 EUR",
      tipoCategoria: "Auto",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: isAgente ? 100 : 40,
      haOpzioniUso: true,
      opzioniUso: opzioniAuto,
    },
    // --- Telecomunicazioni ---
    {
      nome: "Telefonia mobile",
      percentualeDeducibilita: 80,
      descrizione: "Abbonamenti e ricariche cellulari",
      tipoCategoria: "Telecomunicazioni",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 50,
      haOpzioniUso: true,
      opzioniUso: OPZIONI_TELEFONIA_MOBILE,
    },
    {
      nome: "Telefonia fissa ufficio",
      percentualeDeducibilita: 100,
      descrizione: "Linea fissa e internet ufficio",
      tipoCategoria: "Telecomunicazioni",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Ufficio ---
    {
      nome: "Cancelleria e materiale ufficio",
      percentualeDeducibilita: 100,
      descrizione: "Carta, toner, penne, materiale di consumo",
      tipoCategoria: "Ufficio",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Mobili e arredi",
      percentualeDeducibilita: 100,
      descrizione: "Scrivanie, sedie, armadi ufficio",
      tipoCategoria: "Ufficio",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- IT ---
    {
      nome: "Software e licenze",
      percentualeDeducibilita: 100,
      descrizione: "Abbonamenti cloud, licenze software",
      tipoCategoria: "IT",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Hardware e computer",
      percentualeDeducibilita: 100,
      descrizione: "PC, stampanti, monitor, periferiche",
      tipoCategoria: "IT",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Immobili ---
    {
      nome: "Affitto ufficio",
      percentualeDeducibilita: 100,
      descrizione: "Canone di locazione ufficio/studio",
      tipoCategoria: "Immobili",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: true,
      opzioniUso: OPZIONI_AFFITTO_UFFICIO,
    },
    {
      nome: "Utenze ufficio (luce, gas, acqua)",
      percentualeDeducibilita: 100,
      descrizione: "Bollette utenze dello studio/ufficio",
      tipoCategoria: "Immobili",
      aliquotaIvaDefault: 10,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Pulizie ufficio",
      percentualeDeducibilita: 100,
      descrizione: "Servizio pulizia locali",
      tipoCategoria: "Immobili",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Servizi ---
    {
      nome: "Consulenze professionali",
      percentualeDeducibilita: 100,
      descrizione: "Commercialista, avvocato, consulenti",
      tipoCategoria: "Servizi",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Formazione e aggiornamento professionale",
      percentualeDeducibilita: 100,
      descrizione: "Corsi, seminari, convegni",
      tipoCategoria: "Formazione",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Banca/Assicurazioni (IVA esente) ---
    {
      nome: "Spese bancarie e commissioni",
      percentualeDeducibilita: 100,
      descrizione: "Commissioni bancarie, canoni conto",
      tipoCategoria: "Banca",
      aliquotaIvaDefault: 0,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Assicurazioni professionali",
      percentualeDeducibilita: 100,
      descrizione: "RC professionale, polizze attivita",
      tipoCategoria: "Assicurazioni",
      aliquotaIvaDefault: 0,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Marketing/Rappresentanza ---
    {
      nome: "Marketing e pubblicita",
      percentualeDeducibilita: 100,
      descrizione: "Campagne pubblicitarie, sito web, social",
      tipoCategoria: "Marketing",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Spese di rappresentanza",
      percentualeDeducibilita: 75,
      descrizione: "Art. 108 TUIR - Limiti in base ai ricavi",
      tipoCategoria: "Rappresentanza",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Omaggi (fino a 50 EUR)",
      percentualeDeducibilita: 100,
      descrizione: "Regali a clienti/fornitori fino a 50 EUR",
      tipoCategoria: "Rappresentanza",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Omaggi (oltre 50 EUR)",
      percentualeDeducibilita: 75,
      descrizione: "Regali a clienti/fornitori oltre 50 EUR",
      tipoCategoria: "Rappresentanza",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    // --- Trasferte ---
    {
      nome: "Viaggi e trasferte",
      percentualeDeducibilita: 100,
      descrizione: "Biglietti treno, aereo, pedaggi",
      tipoCategoria: "Trasferte",
      aliquotaIvaDefault: 22,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: false,
      opzioniUso: null,
    },
    {
      nome: "Alberghi e ristoranti",
      percentualeDeducibilita: 75,
      descrizione: "Pasti e pernottamenti",
      tipoCategoria: "Trasferte",
      aliquotaIvaDefault: 10,
      percentualeDetraibilitaIva: 100,
      haOpzioniUso: true,
      opzioniUso: OPZIONI_ALBERGHI_RISTORANTI,
    },
  ];

  if (isForfettario) {
    return categorie.map((c) => ({
      ...c,
      aliquotaIvaDefault: 0,
      percentualeDetraibilitaIva: 0,
      haOpzioniUso: false,
      opzioniUso: null,
    }));
  }

  return categorie;
}
