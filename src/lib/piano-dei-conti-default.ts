import { TipoConto, NaturaSaldo } from "@prisma/client";

export type ContoDefault = {
  codice: string;
  descrizione: string;
  tipo: TipoConto;
  voceSp: string | null;
  voceCe: string | null;
  naturaSaldo: NaturaSaldo;
};

export const PIANO_DEI_CONTI_DEFAULT: ContoDefault[] = [
  // PATRIMONIALE ATTIVO - Liquidità
  { codice: "100.001", descrizione: "Cassa contanti", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.IV.3", voceCe: null, naturaSaldo: "DARE" },
  { codice: "100.010", descrizione: "Banca c/c principale", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.IV.1", voceCe: null, naturaSaldo: "DARE" },
  { codice: "100.011", descrizione: "Banca c/c secondario", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.IV.1", voceCe: null, naturaSaldo: "DARE" },
  // PATRIMONIALE ATTIVO - Crediti
  { codice: "110.001", descrizione: "Clienti Italia", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.II.1", voceCe: null, naturaSaldo: "DARE" },
  { codice: "110.010", descrizione: "Fatture da emettere", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.II.1", voceCe: null, naturaSaldo: "DARE" },
  // PATRIMONIALE ATTIVO - Erario
  { codice: "130.001", descrizione: "Erario c/IVA a credito", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.II.5-bis", voceCe: null, naturaSaldo: "DARE" },
  { codice: "130.002", descrizione: "Erario c/ritenute subite", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.II.5-bis", voceCe: null, naturaSaldo: "DARE" },
  { codice: "130.003", descrizione: "Erario c/acconto IRES", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.II.5-bis", voceCe: null, naturaSaldo: "DARE" },
  { codice: "130.004", descrizione: "Erario c/acconto IRAP", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.II.5-bis", voceCe: null, naturaSaldo: "DARE" },
  // PATRIMONIALE ATTIVO - Altri crediti
  { codice: "140.003", descrizione: "Crediti verso amministratori", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.II.5-quater", voceCe: null, naturaSaldo: "DARE" },
  { codice: "140.005", descrizione: "Depositi cauzionali attivi", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.II.5-quater", voceCe: null, naturaSaldo: "DARE" },
  // PATRIMONIALE ATTIVO - Ratei/risconti
  { codice: "150.001", descrizione: "Risconti attivi", tipo: "PATRIMONIALE_ATTIVO", voceSp: "D", voceCe: null, naturaSaldo: "DARE" },
  { codice: "150.002", descrizione: "Ratei attivi", tipo: "PATRIMONIALE_ATTIVO", voceSp: "D", voceCe: null, naturaSaldo: "DARE" },
  // PATRIMONIALE ATTIVO - Immobilizzazioni immateriali
  { codice: "160.004", descrizione: "Concessioni, licenze, marchi", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.I.4", voceCe: null, naturaSaldo: "DARE" },
  { codice: "160.010", descrizione: "Software", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.I.3", voceCe: null, naturaSaldo: "DARE" },
  { codice: "160.106", descrizione: "F.do amm.to software", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.I.3", voceCe: null, naturaSaldo: "AVERE" },
  // PATRIMONIALE ATTIVO - Immobilizzazioni materiali
  { codice: "170.004", descrizione: "Impianti generici", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.2", voceCe: null, naturaSaldo: "DARE" },
  { codice: "170.005", descrizione: "Attrezzature", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.3", voceCe: null, naturaSaldo: "DARE" },
  { codice: "170.006", descrizione: "Mobili e arredi", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.4", voceCe: null, naturaSaldo: "DARE" },
  { codice: "170.008", descrizione: "Elaboratori (PC, server)", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.4", voceCe: null, naturaSaldo: "DARE" },
  { codice: "170.010", descrizione: "Autovetture", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.4", voceCe: null, naturaSaldo: "DARE" },
  { codice: "170.011", descrizione: "Apparati telefonici", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.4", voceCe: null, naturaSaldo: "DARE" },
  { codice: "170.101", descrizione: "F.do amm.to impianti", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.2", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "170.102", descrizione: "F.do amm.to attrezzature", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.3", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "170.106", descrizione: "F.do amm.to mobili", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.4", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "170.108", descrizione: "F.do amm.to elaboratori", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.4", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "170.110", descrizione: "F.do amm.to autovetture", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.4", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "170.111", descrizione: "F.do amm.to apparati telefonici", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.4", voceCe: null, naturaSaldo: "AVERE" },
  // PATRIMONIALE PASSIVO - Debiti fornitori
  { codice: "200.001", descrizione: "Fornitori Italia", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.7", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "200.010", descrizione: "Fatture da ricevere", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.7", voceCe: null, naturaSaldo: "AVERE" },
  // PATRIMONIALE PASSIVO - Debiti tributari
  { codice: "220.001", descrizione: "Erario c/IVA a debito", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.12", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "220.002", descrizione: "Erario c/IRES da versare", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.12", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "220.003", descrizione: "Erario c/IRAP da versare", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.12", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "220.004", descrizione: "Erario c/ritenute da versare", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.12", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "220.005", descrizione: "INPS c/contributi da versare", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.13", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "220.006", descrizione: "Erario c/IVA (liquidazione)", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.12", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "220.010", descrizione: "IVA c/reverse charge", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.12", voceCe: null, naturaSaldo: "AVERE" },
  // PATRIMONIALE PASSIVO - Debiti verso soci
  { codice: "230.001", descrizione: "Debiti verso soci per finanziamenti", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.3", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "230.002", descrizione: "Debiti verso soci per dividendi", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.14", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "230.003", descrizione: "Debiti verso amministratori per compensi", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.14", voceCe: null, naturaSaldo: "AVERE" },
  // PATRIMONIALE PASSIVO - Ratei/risconti
  { codice: "240.001", descrizione: "Risconti passivi", tipo: "PATRIMONIALE_PASSIVO", voceSp: "E", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "240.002", descrizione: "Ratei passivi", tipo: "PATRIMONIALE_PASSIVO", voceSp: "E", voceCe: null, naturaSaldo: "AVERE" },
  // PATRIMONIALE PASSIVO - Fondi
  { codice: "250.001", descrizione: "Fondo imposte differite", tipo: "PATRIMONIALE_PASSIVO", voceSp: "B.2", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "250.002", descrizione: "Fondo TFM", tipo: "PATRIMONIALE_PASSIVO", voceSp: "B.1", voceCe: null, naturaSaldo: "AVERE" },
  // PATRIMONIALE PASSIVO - Patrimonio netto
  { codice: "270.001", descrizione: "Capitale sociale", tipo: "PATRIMONIALE_PASSIVO", voceSp: "A.I", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "270.004", descrizione: "Riserva legale", tipo: "PATRIMONIALE_PASSIVO", voceSp: "A.IV", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "270.006", descrizione: "Riserva straordinaria", tipo: "PATRIMONIALE_PASSIVO", voceSp: "A.VI", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "270.009", descrizione: "Utili/perdite portati a nuovo", tipo: "PATRIMONIALE_PASSIVO", voceSp: "A.VIII", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "270.010", descrizione: "Utile/perdita d'esercizio", tipo: "PATRIMONIALE_PASSIVO", voceSp: "A.IX", voceCe: null, naturaSaldo: "AVERE" },
  // ECONOMICO COSTO - Servizi (B.7)
  { codice: "310.001", descrizione: "Consulenze professionali", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.002", descrizione: "Consulenze informatiche", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.003", descrizione: "Consulenze marketing e comunicazione", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.010", descrizione: "Energia elettrica", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.013", descrizione: "Telefono fisso", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.014", descrizione: "Telefono mobile", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.015", descrizione: "Internet e connettività", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.020", descrizione: "Assicurazioni", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.030", descrizione: "Spese bancarie e commissioni", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.040", descrizione: "Pubblicità e promozione", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.050", descrizione: "Trasferte e rimborsi spese", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.051", descrizione: "Rappresentanza (hotel, ristoranti)", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.060", descrizione: "Manutenzioni e riparazioni", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.070", descrizione: "Cancelleria e materiale consumo", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.071", descrizione: "Abbonamenti software e SaaS", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.072", descrizione: "Abbonamenti riviste e banche dati", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.073", descrizione: "Formazione e aggiornamento", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  { codice: "310.080", descrizione: "Spese postali e corrieri", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  // ECONOMICO COSTO - Godimento beni terzi (B.8)
  { codice: "320.001", descrizione: "Affitti passivi", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.8", naturaSaldo: "DARE" },
  { codice: "320.002", descrizione: "Noleggio a lungo termine autovetture", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.8", naturaSaldo: "DARE" },
  { codice: "320.005", descrizione: "Canoni leasing operativo", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.8", naturaSaldo: "DARE" },
  // ECONOMICO COSTO - Personale (B.7 for SRL services)
  { codice: "330.040", descrizione: "Compensi amministratori", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.7", naturaSaldo: "DARE" },
  // ECONOMICO COSTO - Ammortamenti (B.10)
  { codice: "340.001", descrizione: "Amm.to immobilizzazioni immateriali", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.10.a", naturaSaldo: "DARE" },
  { codice: "340.011", descrizione: "Amm.to impianti", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.10.b", naturaSaldo: "DARE" },
  { codice: "340.012", descrizione: "Amm.to attrezzature", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.10.b", naturaSaldo: "DARE" },
  { codice: "340.013", descrizione: "Amm.to mobili e arredi", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.10.b", naturaSaldo: "DARE" },
  { codice: "340.015", descrizione: "Amm.to elaboratori", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.10.b", naturaSaldo: "DARE" },
  { codice: "340.017", descrizione: "Amm.to autovetture", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.10.b", naturaSaldo: "DARE" },
  { codice: "340.018", descrizione: "Amm.to apparati telefonici", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.10.b", naturaSaldo: "DARE" },
  // ECONOMICO COSTO - Oneri diversi (B.14)
  { codice: "370.001", descrizione: "Imposte e tasse indirette", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.14", naturaSaldo: "DARE" },
  { codice: "370.002", descrizione: "Perdite su crediti", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.14", naturaSaldo: "DARE" },
  { codice: "370.008", descrizione: "Oneri diversi di gestione", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.14", naturaSaldo: "DARE" },
  { codice: "370.009", descrizione: "Sanzioni tributarie", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.14", naturaSaldo: "DARE" },
  { codice: "370.010", descrizione: "Minusvalenze da alienazione", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.14", naturaSaldo: "DARE" },
  // ECONOMICO COSTO - Oneri finanziari (C.17)
  { codice: "380.001", descrizione: "Interessi passivi banca c/c", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "C.17", naturaSaldo: "DARE" },
  { codice: "380.003", descrizione: "Interessi passivi su finanziamenti", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "C.17", naturaSaldo: "DARE" },
  // ECONOMICO COSTO - Imposte (voce 20)
  { codice: "390.001", descrizione: "IRES corrente", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "20", naturaSaldo: "DARE" },
  { codice: "390.002", descrizione: "IRAP corrente", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "20", naturaSaldo: "DARE" },
  // ECONOMICO RICAVO - Ricavi (A.1)
  { codice: "400.001", descrizione: "Ricavi prestazioni di servizi \u2014 Italia", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "A.1", naturaSaldo: "AVERE" },
  { codice: "400.002", descrizione: "Ricavi prestazioni di servizi \u2014 UE", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "A.1", naturaSaldo: "AVERE" },
  { codice: "400.003", descrizione: "Ricavi prestazioni di servizi \u2014 Extra-UE", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "A.1", naturaSaldo: "AVERE" },
  { codice: "400.030", descrizione: "Ricavi da abbonamenti e contratti ricorrenti", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "A.1", naturaSaldo: "AVERE" },
  // ECONOMICO RICAVO - Altri ricavi (A.5)
  { codice: "420.001", descrizione: "Plusvalenze da realizzo cespiti", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "A.5", naturaSaldo: "AVERE" },
  { codice: "420.002", descrizione: "Sopravvenienze attive", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "A.5", naturaSaldo: "AVERE" },
  { codice: "420.004", descrizione: "Contributi in conto esercizio", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "A.5", naturaSaldo: "AVERE" },
  { codice: "420.010", descrizione: "Rimborso bolli a clienti", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "A.5", naturaSaldo: "AVERE" },
  // ECONOMICO RICAVO - Proventi finanziari (C.16)
  { codice: "430.001", descrizione: "Interessi attivi bancari", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "C.16.d", naturaSaldo: "AVERE" },
  { codice: "430.002", descrizione: "Interessi attivi su crediti", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "C.16.d", naturaSaldo: "AVERE" },
  // Conti transitori per chiusura/apertura
  { codice: "900.001", descrizione: "Conto Economico (transitorio chiusura)", tipo: "ORDINE", voceSp: null, voceCe: null, naturaSaldo: "DARE" },
  { codice: "900.002", descrizione: "Stato Patrimoniale (transitorio chiusura)", tipo: "ORDINE", voceSp: null, voceCe: null, naturaSaldo: "DARE" },
];
