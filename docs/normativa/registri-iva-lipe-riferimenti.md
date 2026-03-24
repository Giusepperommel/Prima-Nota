# Riferimenti Normativi — Registri IVA, Liquidazioni Periodiche e LIPE

> Questo file documenta le regole normative per registri IVA obbligatori, liquidazione periodica
> dell'imposta e Comunicazione delle Liquidazioni Periodiche IVA (LIPE).
>
> Ultimo aggiornamento: 2026-03-24

---

## 1. Registro delle Fatture Emesse (art. 23 DPR 633/72)

### Obbligo
Tutti i soggetti IVA devono annotare le fatture emesse nel registro vendite.

### Contenuto obbligatorio per ogni registrazione
| Dato | Fonte |
|---|---|
| Numero progressivo (protocollo IVA) | Art. 23 co. 1 |
| Data della fattura | Art. 23 co. 1 |
| Ammontare imponibile e ammontare dell'imposta (distinti per aliquota) | Art. 23 co. 1 |
| Ditta, denominazione o ragione sociale del cessionario/committente | Art. 23 co. 1 |
| Numero di partita IVA del cessionario (se operazione intra-UE o con soggetto estero) | Prassi |

### Termini di registrazione
| Tipo | Termine | Fonte |
|---|---|---|
| Fattura immediata | Entro **15 giorni** dalla data di emissione | Art. 23 co. 1 |
| Fattura differita (art. 21 co. 4 lett. a) | Entro il **15 del mese successivo** alla consegna/spedizione | Art. 23 co. 1 |

### Numerazione
- Progressiva per anno solare
- Possibilita di sezionali distinti (es. FV/, NC/, ecc.) purche la sequenza sia univoca per sezionale
- La numerazione deve essere continua e senza salti

### Operazioni da annotare
- Fatture attive (TD01, TD02, TD24, TD25, TD26)
- Note di credito emesse (TD04)
- Note di debito emesse (TD05)
- Autofatture per reverse charge / integrazione (TD16, TD17, TD18, TD19) — lato vendite della doppia registrazione
- Autofatture per regolarizzazione (TD20) e splafonamento (TD21)
- Autofatture per autoconsumo/cessioni gratuite (TD27)

---

## 2. Registro degli Acquisti (art. 25 DPR 633/72)

### Obbligo
Tutti i soggetti IVA devono annotare le fatture e bollette doganali relative a beni e servizi acquistati.

### Contenuto obbligatorio per ogni registrazione
| Dato | Fonte |
|---|---|
| Numero progressivo (protocollo IVA) | Art. 25 co. 1 |
| Data della fattura o bolletta doganale | Art. 25 co. 1 |
| Ammontare imponibile e ammontare dell'imposta (distinti per aliquota) | Art. 25 co. 1 |
| Ditta, denominazione o ragione sociale del cedente/prestatore | Art. 25 co. 1 |

### Termini di registrazione
| Regola | Termine | Fonte |
|---|---|---|
| Generale | Prima della **liquidazione periodica** in cui si esercita la detrazione | Art. 25 co. 1 |
| Termine massimo detrazione | Dichiarazione IVA relativa all'anno in cui il diritto alla detrazione e sorto | Art. 19 co. 1 |

### Operazioni da annotare
- Fatture di acquisto (TD01, TD06)
- Note di credito ricevute (TD04)
- Bollette doganali
- Autofatture per reverse charge / integrazione (TD16, TD17, TD18, TD19) — lato acquisti della doppia registrazione

---

## 3. Registro dei Corrispettivi (art. 24 DPR 633/72)

### Obbligo
Commercianti al minuto e soggetti assimilati (art. 22 DPR 633/72) che non emettono fattura possono annotare i corrispettivi giornalieri.

### Contenuto obbligatorio
| Dato | Fonte |
|---|---|
| Ammontare globale dei corrispettivi giornalieri (comprensivo di IVA) | Art. 24 co. 1 |
| Distinti per aliquota | Art. 24 co. 1 |

### Termine di registrazione
Entro il giorno successivo non festivo (entro il giorno successivo a quello di effettuazione dell'operazione).

### Scorporo IVA
I corrispettivi sono annotati al lordo; lo scorporo avviene al momento della liquidazione periodica con il metodo matematico:
- Imponibile = Corrispettivo / (1 + aliquota%)
- IVA = Corrispettivo - Imponibile

---

## 4. Sezionali IVA

### Regole generali
| Regola | Dettaglio |
|---|---|
| Facolta di tenere sezionali | Art. 39 co. 2 DPR 633/72 |
| Condizione | La numerazione all'interno di ciascun sezionale deve essere progressiva e senza salti |
| Uso tipico | Separare fatture immediate da differite, vendite Italia da estero, reverse charge |
| Nella dichiarazione IVA annuale | Ogni sezionale va indicato separatamente |

### Sezionali tipici
| Codice | Registro | Descrizione |
|---|---|---|
| FV | Vendite | Fatture di vendita |
| FVD | Vendite | Fatture differite |
| NC | Vendite | Note di credito emesse |
| FA | Acquisti | Fatture di acquisto |
| FARE | Acquisti + Vendite | Reverse charge / integrazioni |
| CORR | Corrispettivi | Corrispettivi giornalieri |

---

## 5. Liquidazione IVA Periodica

### Periodicita

| Tipo | Condizione | Fonte |
|---|---|---|
| **Mensile** | Volume d'affari anno precedente > **EUR 700.000** (cessioni beni) o > **EUR 400.000** (prestazioni servizi) | Art. 1 DPR 100/1998 |
| **Trimestrale** | Volume d'affari ≤ soglie sopra | Art. 7 DPR 542/1999 |

> Dal 2025 i limiti per la liquidazione trimestrale sono unificati a EUR 500.000 (art. 9 D.Lgs. 1/2024, in vigore dal 01/01/2025). Verificare conferma.

### Scadenze versamento

#### Contribuenti mensili
| Periodo | Scadenza versamento | Codice tributo F24 |
|---|---|---|
| Gennaio | 16 febbraio | 6001 |
| Febbraio | 16 marzo | 6002 |
| Marzo | 16 aprile | 6003 |
| Aprile | 16 maggio | 6004 |
| Maggio | 16 giugno | 6005 |
| Giugno | 16 luglio | 6006 |
| Luglio | 16 agosto (→ 20 agosto) | 6007 |
| Agosto | 16 settembre | 6008 |
| Settembre | 16 ottobre | 6009 |
| Ottobre | 16 novembre | 6010 |
| Novembre | 16 dicembre | 6011 |
| Dicembre | 16 gennaio anno successivo | 6012 |

#### Contribuenti trimestrali
| Periodo | Scadenza versamento | Codice tributo F24 |
|---|---|---|
| I trimestre (gen-mar) | 16 maggio | 6031 |
| II trimestre (apr-giu) | 16 agosto (→ 20 agosto) | 6032 |
| III trimestre (lug-set) | 16 novembre | 6033 |
| IV trimestre (ott-dic) | 16 marzo anno successivo | 6034 |

### Maggiorazione trimestrale
- Maggiorazione dell'**1%** a titolo di interessi (art. 7 DPR 542/1999)
- Si applica a tutti i trimestri tranne il IV (che si versa con la dichiarazione annuale, senza maggiorazione poiche il IV trimestre confluisce nella dichiarazione)
- Non si applica se il risultato della liquidazione e a credito

### Calcolo della liquidazione

```
IVA esigibile (VP4) = somma IVA su registro vendite + IVA su corrispettivi (scorporata)
IVA detraibile (VP5) = somma IVA su registro acquisti (detraibile)
IVA dovuta/credito (VP6) = VP4 - VP5

Se VP6 > 0 (debito):
  + VP7 (debito non versato periodo precedente perche < EUR 25,82)
  - VP8 (credito periodo precedente)
  - VP9 (credito anno precedente utilizzato)
  - VP10 (versamenti auto UE)
  - VP11 (crediti d'imposta)
  + VP12 (interessi 1% trimestrali)
  - VP13 (acconto gia versato, solo per dicembre/IV trimestre)
  = VP14 (importo da versare o a credito)

Se VP14 debito < EUR 25,82: non si versa, si riporta al periodo successivo (VP7)
```

### Versamento minimo
| Parametro | Valore | Fonte |
|---|---|---|
| Soglia minima versamento periodico | **EUR 25,82** | Art. 1 co. 4 DPR 100/1998 |
| Se debito < EUR 25,82 | Si riporta al periodo successivo | Idem |

---

## 6. Acconto IVA (art. 6 L. 405/1990)

### Scadenza
**27 dicembre** di ogni anno

### Metodi di calcolo

| Metodo | Calcolo | Codice LIPE (VP13) |
|---|---|---|
| **Storico** | **88%** dell'IVA versata per il mese di dicembre (mensili) o per il IV trimestre (trimestrali) dell'anno precedente | 1 |
| **Previsionale** | **88%** dell'IVA che si prevede di dover versare per dicembre/IV trimestre dell'anno corrente | 2 |
| **Analitico** | **100%** dell'IVA risultante dalla liquidazione al 20 dicembre (operazioni effettuate dal 1/12 al 20/12 per mensili, dal 1/10 al 20/12 per trimestrali) | 3 |

### Codice tributo F24
| Versamento | Codice tributo |
|---|---|
| Acconto IVA | **6013** |

### Esonero dall'acconto
L'acconto non e dovuto se:
- L'importo e inferiore a **EUR 103,29**
- La liquidazione di dicembre/IV trimestre dell'anno precedente era a credito
- Il contribuente ha cessato l'attivita
- Il contribuente ha iniziato l'attivita nell'anno in corso

---

## 7. Credito IVA — Compensazione e Rimborso

### Compensazione orizzontale in F24

| Soglia | Regola | Fonte |
|---|---|---|
| Fino a EUR 5.000 | Compensazione libera dal 01/01 dell'anno successivo | Art. 17 D.Lgs. 241/1997 |
| Oltre EUR 5.000 | Visto di conformita obbligatorio; compensazione dal **10 del mese successivo** alla presentazione della dichiarazione IVA | Art. 10 DL 78/2009 |
| Limite annuo compensazione | **EUR 2.000.000** | Art. 34 L. 388/2000, mod. L. 234/2021 |

### Codice tributo per compensazione credito IVA annuale
| Codice | Descrizione |
|---|---|
| 6099 | Credito IVA annuale — compensazione |

---

## 8. LIPE — Comunicazione Liquidazioni Periodiche IVA

### Base normativa
Art. 21-bis DL 78/2010, convertito dalla L. 122/2010.

### Obbligo
Tutti i soggetti passivi IVA devono comunicare i dati delle liquidazioni periodiche (mensili o trimestrali).

### Scadenze invio telematico

| Trimestre di riferimento | Scadenza ordinaria | Scadenza 2026 (con festivi) |
|---|---|---|
| I trimestre (gen-mar) | 31 maggio | 1 giugno 2026 (lunedi) |
| II trimestre (apr-giu) | 16 settembre | 16 settembre 2026 |
| III trimestre (lug-set) | 30 novembre | 30 novembre 2026 (lunedi) |
| IV trimestre (ott-dic) | 28 febbraio anno successivo | 2 marzo 2027 (se 28/02 cade di sabato/domenica) |

> Il IV trimestre puo essere comunicato con la dichiarazione IVA annuale (quadro VP) se questa viene presentata entro il termine LIPE anziche entro il 30 aprile.

### Sanzioni
| Violazione | Sanzione | Ravvedimento |
|---|---|---|
| Omessa/infedele comunicazione | EUR 500 — EUR 2.000 per trimestre | Si (art. 13 D.Lgs. 472/1997) |
| Con ravvedimento entro 15 gg dalla scadenza | EUR 27,78 (1/18 di EUR 500) | |

### Formato file
- **Formato:** XML conforme alle specifiche tecniche approvate con provvedimento AdE del 21/03/2018
- **Versione:** IVP18 (aggiornata periodicamente)
- **Firma:** Firma digitale o codice di autenticazione
- **Nome file:** `IT{codiceFiscale}_LI_{progressivo5cifre}.xml`
  - Esempio: `IT01234567890_LI_00001.xml`

### Struttura XML LIPE

```xml
<?xml version="1.0" encoding="UTF-8"?>
<iv:Fornitura
  xmlns:iv="urn:www.agenziaentrate.gov.it:specificheTecniche:schemario:messaggi:v1.0"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">

  <iv:Intestazione>
    <iv:CodiceFornitura>IVP18</iv:CodiceFornitura>
    <iv:CodiceFiscaleDichiarante>...</iv:CodiceFiscaleDichiarante>   <!-- se diverso dal contribuente -->
    <iv:CodiceCarica>...</iv:CodiceCarica>                           <!-- codice carica dichiarante -->
  </iv:Intestazione>

  <iv:Comunicazione identificativo="...">

    <iv:Frontespizio>
      <iv:CodiceFiscale>01234567890</iv:CodiceFiscale>               <!-- P.IVA / CF contribuente -->
      <iv:AnnoImposta>2026</iv:AnnoImposta>
      <iv:PartitaIVA>01234567890</iv:PartitaIVA>
      <iv:PIVAControllante>...</iv:PIVAControllante>                 <!-- se liquidazione di gruppo -->
      <iv:UltimoMese>...</iv:UltimoMese>                            <!-- mese cessazione gruppo -->
      <iv:LiquidazioneGruppo>...</iv:LiquidazioneGruppo>            <!-- 0 o 1 -->
      <iv:CFDichiarante>...</iv:CFDichiarante>
      <iv:CodiceCaricaDichiarante>...</iv:CodiceCaricaDichiarante>
      <iv:CodiceFiscaleSocieta>...</iv:CodiceFiscaleSocieta>         <!-- se diverso da CF -->
      <iv:FirmaDichiarazione>1</iv:FirmaDichiarazione>
      <iv:CFIntermediario>...</iv:CFIntermediario>
      <iv:ImpegnoPresentazione>1</iv:ImpegnoPresentazione>
      <iv:DataImpegno>01012026</iv:DataImpegno>
      <iv:FirmaIntermediario>1</iv:FirmaIntermediario>
    </iv:Frontespizio>

    <!-- Un Modulo per ogni periodo (mese o trimestre) nel trimestre -->
    <iv:DatiContabili>
      <iv:Modulo>
        <iv:Mese>1</iv:Mese>             <!-- 1-12 per mensili -->
        <!-- OPPURE -->
        <iv:Trimestre>1</iv:Trimestre>    <!-- 1-4 per trimestrali -->

        <!-- VP2 --> <iv:TotaleOperazioniAttive>100000.00</iv:TotaleOperazioniAttive>
        <!-- VP3 --> <iv:TotaleOperazioniPassive>80000.00</iv:TotaleOperazioniPassive>
        <!-- VP4 --> <iv:IvaEsigibile>22000.00</iv:IvaEsigibile>
        <!-- VP5 --> <iv:IvaDetratta>17600.00</iv:IvaDetratta>
        <!-- VP6 --> <iv:IvaDovuta>4400.00</iv:IvaDovuta>
        <!-- oppure -->
        <!-- VP6 --> <iv:IvaCredito>0.00</iv:IvaCredito>
        <!-- VP7 --> <iv:DebitoPrec>0.00</iv:DebitoPrec>
        <!-- VP8 --> <iv:CreditoPrec>0.00</iv:CreditoPrec>
        <!-- VP9 --> <iv:CreditoAnnoPrec>0.00</iv:CreditoAnnoPrec>
        <!-- VP10 --> <iv:VersamentiAutoUE>0.00</iv:VersamentiAutoUE>
        <!-- VP11 --> <iv:CreditiImposta>0.00</iv:CreditiImposta>
        <!-- VP12 --> <iv:InteressiDovuti>0.00</iv:InteressiDovuti>
        <!-- VP13 --> <iv:Acconto>0.00</iv:Acconto>
        <!-- VP14 --> <iv:ImportoDaVersare>4400.00</iv:ImportoDaVersare>
        <!-- oppure -->
        <!-- VP14 --> <iv:ImportoACredito>0.00</iv:ImportoACredito>

        <iv:Subfornitura>0</iv:Subfornitura>
        <iv:EventiEccezionali>0</iv:EventiEccezionali>
        <iv:Metodo>1</iv:Metodo>          <!-- metodo acconto: 1=storico, 2=previsionale, 3=analitico, 4=speciali -->
        <iv:OperazioniStraordinarie>0</iv:OperazioniStraordinarie>
      </iv:Modulo>
    </iv:DatiContabili>

  </iv:Comunicazione>
</iv:Fornitura>
```

### Mapping VP → XML Elements

| Rigo | Descrizione | Elemento XML | Note |
|---|---|---|---|
| VP1 | Periodo di riferimento | `<Mese>` o `<Trimestre>` | 1-12 per mensili, 1-4 per trimestrali |
| VP2 | Totale operazioni attive | `<TotaleOperazioniAttive>` | Imponibile vendite + non imponibili + esenti |
| VP3 | Totale operazioni passive | `<TotaleOperazioniPassive>` | Imponibile acquisti + non imponibili + esenti |
| VP4 | IVA esigibile | `<IvaEsigibile>` | IVA a debito del periodo |
| VP5 | IVA detratta | `<IvaDetratta>` | IVA a credito detraibile del periodo |
| VP6 | IVA dovuta o a credito | `<IvaDovuta>` o `<IvaCredito>` | VP4 - VP5 (mutuamente esclusivi) |
| VP7 | Debito periodo precedente (< EUR 25,82) | `<DebitoPrec>` | Riporto debito non versato |
| VP8 | Credito periodo precedente | `<CreditoPrec>` | Credito da liquidazione precedente (stesso anno) |
| VP9 | Credito anno precedente | `<CreditoAnnoPrec>` | Credito da dichiarazione annuale anno precedente |
| VP10 | Versamenti auto UE | `<VersamentiAutoUE>` | Cessioni interne veicoli ex intra-UE |
| VP11 | Crediti d'imposta | `<CreditiImposta>` | Crediti d'imposta utilizzati nel periodo |
| VP12 | Interessi dovuti trimestrali | `<InteressiDovuti>` | 1% per trimestrali (non per IV trim.) |
| VP13 | Acconto dovuto | `<Acconto>` | Solo dicembre/IV trimestre |
| VP14 | Importo da versare o a credito | `<ImportoDaVersare>` o `<ImportoACredito>` | Risultato finale (mutuamente esclusivi) |

---

## 9. Codici Tributo IVA per F24

### Versamenti periodici

| Codice | Descrizione |
|---|---|
| 6001-6012 | IVA mensile (gennaio-dicembre) |
| 6031-6034 | IVA trimestrale (I-IV trimestre) |
| 6013 | Acconto IVA (27 dicembre) |
| 6099 | Credito IVA annuale — compensazione |
| 6036 | Credito IVA trimestrale — compensazione (mod. IVA TR) |

### Interessi e sanzioni
| Codice | Descrizione |
|---|---|
| 1991 | Interessi per ravvedimento — IVA |
| 8904 | Sanzione per ravvedimento — IVA |

---

## 10. Stampa Definitiva dei Registri IVA

### Regole generali (art. 7 co. 4-quater DL 357/1994)
- La stampa cartacea dei registri IVA non e piu obbligatoria se tenuti in formato elettronico
- I registri devono essere stampabili **su richiesta** in sede di accesso, ispezione o verifica
- Se si opta per la conservazione digitale a norma: entro 3 mesi dal termine della dichiarazione redditi

### Requisiti della stampa
| Requisito | Dettaglio |
|---|---|
| Numerazione pagine | Progressiva per anno e per sezionale |
| Intestazione | Ragione sociale, P.IVA, tipo registro, anno, sezionale |
| Totali per periodo | Totali imponibile e imposta per aliquota per ogni mese/trimestre |
| Riepilogo annuale | Totali per aliquota per l'intero anno |
| Formato | PDF per conservazione digitale |

---

## Changelog

| Data | Modifica | Motivo |
|---|---|---|
| 2026-03-24 | Creazione documento | Avvio sotto-progetto 4: Registri IVA completi + Liquidazioni + LIPE |
