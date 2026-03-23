// src/lib/contabilita/causali.ts
// Mapping constants for double-entry bookkeeping generation.
// Account codes verified against src/lib/piano-dei-conti-default.ts

export const CONTI_STRUTTURALI = {
  // Attivita
  CREDITI_CLIENTI:        '110.001',  // "Clienti Italia" — SP C.II.1
  FATTURE_DA_EMETTERE:    '110.010',  // "Fatture da emettere" — SP C.II.1
  IVA_CREDITO:            '130.001',  // "Erario c/IVA a credito" — SP C.II.5-bis
  ERARIO_RITENUTE_SUBITE: '130.002',  // "Erario c/ritenute subite" — SP C.II.5-bis
  ERARIO_ACCONTI_IRES:    '130.003',  // "Erario c/acconto IRES" — SP C.II.5-bis
  ERARIO_ACCONTI_IRAP:    '130.004',  // "Erario c/acconto IRAP" — SP C.II.5-bis
  BANCA_CC:               '100.010',  // "Banca c/c principale" — SP C.IV.1
  CASSA:                  '100.001',  // "Cassa contanti" — SP C.IV.3

  // Passivita
  DEBITI_FORNITORI:       '200.001',  // "Fornitori Italia" — SP D.7
  FATTURE_DA_RICEVERE:    '200.010',  // "Fatture da ricevere" — SP D.7
  IVA_DEBITO:             '220.001',  // "Erario c/IVA a debito" — SP D.12
  DEBITI_IRES:            '220.002',  // "Erario c/IRES da versare" — SP D.12
  DEBITI_IRAP:            '220.003',  // "Erario c/IRAP da versare" — SP D.12
  ERARIO_RITENUTE:        '220.004',  // "Erario c/ritenute da versare" — SP D.12
  INPS_CONTRIBUTI:        '220.005',  // "INPS c/contributi da versare" — SP D.13
  ERARIO_IVA:             '220.006',  // "Erario c/IVA (liquidazione)" — SP D.12
  IVA_REVERSE_CHARGE:     '220.010',  // "IVA c/reverse charge" — transitorio
  SOCI_DIVIDENDI:         '230.002',  // "Debiti verso soci per dividendi" — SP D.14
  DEBITI_AMMINISTRATORI:  '230.003',  // "Debiti verso amministratori per compensi" — SP D.14
  FONDO_TFM:              '250.002',  // "Fondo TFM" — SP B.1

  // Patrimonio netto
  RISERVA_LEGALE:         '270.004',  // "Riserva legale" — SP A.IV
  RISERVA_STRAORDINARIA:  '270.006',  // "Riserva straordinaria" — SP A.VI
  UTILI_A_NUOVO:          '270.009',  // "Utili/perdite portati a nuovo" — SP A.VIII
  UTILE_ESERCIZIO:        '270.010',  // "Utile/perdita d'esercizio" — SP A.IX

  // Costi
  IMPOSTE_IRES:           '390.001',  // "IRES corrente" — CE 20
  IMPOSTE_IRAP:           '390.002',  // "IRAP corrente" — CE 20
  SANZIONI_TRIBUTARIE:    '370.009',  // "Sanzioni tributarie" — CE B.14 (indeducibile)
  MINUSVALENZE:           '370.010',  // "Minusvalenze da alienazione" — CE B.14

  // Ricavi
  PLUSVALENZE:             '420.001',  // "Plusvalenze da realizzo cespiti" — CE A.5
  RIMBORSO_BOLLI:         '420.010',  // "Rimborso bolli a clienti" — CE A.5

  // Conti transitori per chiusura/apertura
  CONTO_ECONOMICO:        '900.001',  // transitorio per chiusura
  STATO_PATRIMONIALE:     '900.002',  // transitorio per chiusura
} as const;

export type ContoStrutturale = keyof typeof CONTI_STRUTTURALI;

export interface CausaleContabileData {
  codice: string;
  descrizione: string;
  tipoOperazione: string | null;
  registroIva: 'VENDITE' | 'ACQUISTI' | 'CORRISPETTIVI' | null;
}

export const CAUSALI_DEFAULT: CausaleContabileData[] = [
  // Ciclo attivo
  { codice: 'FV',   descrizione: 'Fattura di vendita',               tipoOperazione: 'FATTURA_ATTIVA', registroIva: 'VENDITE' },
  { codice: 'FVS',  descrizione: 'Fattura vendita split payment',    tipoOperazione: 'FATTURA_ATTIVA', registroIva: 'VENDITE' },
  { codice: 'NCV',  descrizione: 'Nota di credito emessa',           tipoOperazione: 'FATTURA_ATTIVA', registroIva: 'VENDITE' },
  { codice: 'NDV',  descrizione: 'Nota di debito emessa',            tipoOperazione: 'FATTURA_ATTIVA', registroIva: 'VENDITE' },
  // Ciclo passivo
  { codice: 'FA',   descrizione: 'Fattura di acquisto',              tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  { codice: 'NCA',  descrizione: 'Nota di credito ricevuta',         tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  { codice: 'NDA',  descrizione: 'Nota di debito ricevuta',          tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  { codice: 'FAUE', descrizione: 'Fattura acquisto intra-UE',        tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  { codice: 'FARE', descrizione: 'Fattura acquisto reverse charge',  tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  // Tesoreria
  { codice: 'PG',   descrizione: 'Pagamento fornitore',              tipoOperazione: null,             registroIva: null },
  { codice: 'IN',   descrizione: 'Incasso da cliente',               tipoOperazione: null,             registroIva: null },
  // Cespiti e ammortamento
  { codice: 'AM',   descrizione: 'Ammortamento',                     tipoOperazione: 'CESPITE',        registroIva: null },
  // Imposte
  { codice: 'F24',  descrizione: 'Pagamento tributi F24',            tipoOperazione: 'PAGAMENTO_IMPOSTE', registroIva: null },
  { codice: 'LQ',   descrizione: 'Liquidazione IVA',                 tipoOperazione: null,             registroIva: null },
  // Dividendi e compensi
  { codice: 'DIV',  descrizione: 'Distribuzione dividendi',          tipoOperazione: 'DISTRIBUZIONE_DIVIDENDI', registroIva: null },
  { codice: 'CA',   descrizione: 'Compenso amministratore',          tipoOperazione: 'COMPENSO_AMMINISTRATORE', registroIva: null },
  // Chiusura/apertura
  { codice: 'SC',   descrizione: 'Scrittura di chiusura',            tipoOperazione: null,             registroIva: null },
  { codice: 'SA',   descrizione: 'Scrittura di apertura',            tipoOperazione: null,             registroIva: null },
  { codice: 'SAS',  descrizione: 'Scrittura di assestamento',        tipoOperazione: null,             registroIva: null },
  { codice: 'ST',   descrizione: 'Storno',                           tipoOperazione: null,             registroIva: null },
  // Generica
  { codice: 'OG',   descrizione: 'Operazione generica',              tipoOperazione: null,             registroIva: null },
];

/** Maps cespite type to asset account, ammortamento account, and fondo account */
export const MAPPING_CESPITI = {
  SOFTWARE:     { asset: '160.010', amm: '340.001', fondo: '160.106' },
  MOBILI:       { asset: '170.006', amm: '340.013', fondo: '170.106' },
  ELABORATORI:  { asset: '170.008', amm: '340.015', fondo: '170.108' },
  AUTOVETTURE:  { asset: '170.010', amm: '340.017', fondo: '170.110' },
  TELEFONI:     { asset: '170.011', amm: '340.018', fondo: '170.111' },
  IMPIANTI:     { asset: '170.004', amm: '340.011', fondo: '170.101' },
  ATTREZZATURE: { asset: '170.005', amm: '340.012', fondo: '170.102' },
} as const;

export type TipoCespiteMapping = keyof typeof MAPPING_CESPITI;
