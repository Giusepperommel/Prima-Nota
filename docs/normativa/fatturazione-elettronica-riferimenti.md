# Riferimenti Normativi — Fatturazione Elettronica (FatturaPA)

> Questo file documenta tutte le specifiche tecniche, codifiche e regole di validazione
> necessarie per la generazione di file XML FatturaPA conformi.
> **Aggiornare questo file ogni volta che cambiano le specifiche tecniche o la normativa.**
>
> Ultimo aggiornamento: 2026-03-24

---

## 1. Quadro Normativo

| Norma | Oggetto |
|---|---|
| DLgs 127/2015 | Obbligo fatturazione elettronica B2B/B2C dal 1/1/2019 |
| DLgs 196/2003 (come mod. DLgs 101/2018) | Privacy — no dati sanitari in fattura via SDI |
| DM 3 aprile 2013 n. 55 | Fatturazione elettronica verso PA |
| Provv. AdE 30/4/2018 n. 89757 | Regole tecniche FE B2B/B2C |
| Provv. AdE 28/2/2020 | Specifiche tecniche v1.6 (aggiornamenti successivi) |
| Provv. AdE 24/11/2022 | Specifiche tecniche v1.7 e v1.8 |
| Art. 21 DPR 633/72 | Contenuto obbligatorio della fattura |
| Art. 21-bis DPR 633/72 | Fattura semplificata |

---

## 2. Formato FatturaPA

### 2.1 Generalita

| Parametro | Valore |
|---|---|
| **Formato** | FPR12 (fatture tra privati B2B/B2C) |
| **Schema** | v1.2.2 |
| **Namespace** | `http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2` |
| **Schema XSD** | `https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_v1.2.2.xsd` |
| **Encoding** | UTF-8 |
| **Formato file** | XML |

### 2.2 Struttura XML Completa

```
FatturaElettronica (root, versione="FPR12")
|
+-- FatturaElettronicaHeader
|   |
|   +-- DatiTrasmissione
|   |   +-- IdTrasmittente
|   |   |   +-- IdPaese (xs:string, 2 char, es. "IT")
|   |   |   +-- IdCodice (xs:string, max 28 char)
|   |   +-- ProgressivoInvio (xs:string, max 10 char)
|   |   +-- FormatoTrasmissione (xs:string, "FPR12")
|   |   +-- CodiceDestinatario (xs:string, 7 char)
|   |   +-- ContattiTrasmittente [0..1]
|   |   |   +-- Telefono [0..1]
|   |   |   +-- Email [0..1]
|   |   +-- PECDestinatario [0..1] (xs:string)
|   |
|   +-- CedentePrestatore
|   |   +-- DatiAnagrafici
|   |   |   +-- IdFiscaleIVA
|   |   |   |   +-- IdPaese (xs:string, 2 char)
|   |   |   |   +-- IdCodice (xs:string, max 28 char)
|   |   |   +-- CodiceFiscale [0..1] (xs:string, 11-16 char)
|   |   |   +-- Anagrafica
|   |   |   |   +-- Denominazione [alt] (xs:string, max 80 char)
|   |   |   |   +-- Nome [alt] (xs:string, max 60 char)
|   |   |   |   +-- Cognome [alt] (xs:string, max 60 char)
|   |   |   |   +-- Titolo [0..1] (xs:string, 2-10 char)
|   |   |   |   +-- CodEORI [0..1] (xs:string, 13-17 char)
|   |   |   +-- AlboProfessionale [0..1]
|   |   |   +-- ProvinciaAlbo [0..1]
|   |   |   +-- NumeroIscrizioneAlbo [0..1]
|   |   |   +-- DataIscrizioneAlbo [0..1]
|   |   |   +-- RegimeFiscale (xs:string, 4 char, es. "RF01")
|   |   +-- Sede
|   |   |   +-- Indirizzo (xs:string, max 60 char)
|   |   |   +-- NumeroCivico [0..1] (xs:string, max 8 char)
|   |   |   +-- CAP (xs:string, 5 char)
|   |   |   +-- Comune (xs:string, max 60 char)
|   |   |   +-- Provincia [0..1] (xs:string, 2 char)
|   |   |   +-- Nazione (xs:string, 2 char)
|   |   +-- StabileOrganizzazione [0..1]
|   |   |   +-- (stessa struttura di Sede)
|   |   +-- IscrizioneREA [0..1]
|   |   |   +-- Ufficio (xs:string, 2 char, sigla provincia)
|   |   |   +-- NumeroREA (xs:string, max 20 char)
|   |   |   +-- CapitaleSociale [0..1] (xs:decimal)
|   |   |   +-- SocioUnico [0..1] (SU = unico, SM = piu soci)
|   |   |   +-- StatoLiquidazione (LS = in liquidazione, LN = non in liquidazione)
|   |   +-- Contatti [0..1]
|   |   |   +-- Telefono [0..1]
|   |   |   +-- Fax [0..1]
|   |   |   +-- Email [0..1]
|   |   +-- RiferimentoAmministrazione [0..1]
|   |
|   +-- RappresentanteFiscale [0..1]
|   |   +-- DatiAnagrafici
|   |       +-- IdFiscaleIVA
|   |       +-- CodiceFiscale [0..1]
|   |       +-- Anagrafica
|   |
|   +-- CessionarioCommittente
|   |   +-- DatiAnagrafici
|   |   |   +-- IdFiscaleIVA [0..1]
|   |   |   |   +-- IdPaese
|   |   |   |   +-- IdCodice
|   |   |   +-- CodiceFiscale [0..1]
|   |   |   +-- Anagrafica
|   |   |       +-- Denominazione [alt]
|   |   |       +-- Nome [alt]
|   |   |       +-- Cognome [alt]
|   |   |       +-- Titolo [0..1]
|   |   |       +-- CodEORI [0..1]
|   |   +-- Sede
|   |   |   +-- Indirizzo
|   |   |   +-- NumeroCivico [0..1]
|   |   |   +-- CAP
|   |   |   +-- Comune
|   |   |   +-- Provincia [0..1]
|   |   |   +-- Nazione
|   |   +-- StabileOrganizzazione [0..1]
|   |   +-- RappresentanteFiscale [0..1]
|   |
|   +-- TerzoIntermediarioOSoggettoEmittente [0..1]
|   |   +-- DatiAnagrafici
|   |
|   +-- SoggettoEmittente [0..1] (CC = cessionario, TZ = terzo)
|
+-- FatturaElettronicaBody [1..N]
    |
    +-- DatiGenerali
    |   +-- DatiGeneraliDocumento
    |   |   +-- TipoDocumento (xs:string, 4 char)
    |   |   +-- Divisa (xs:string, 3 char, "EUR")
    |   |   +-- Data (xs:date, YYYY-MM-DD)
    |   |   +-- Numero (xs:string, max 20 char)
    |   |   +-- DatiRitenuta [0..N]
    |   |   |   +-- TipoRitenuta (RT01-RT06)
    |   |   |   +-- ImportoRitenuta (xs:decimal)
    |   |   |   +-- AliquotaRitenuta (xs:decimal)
    |   |   |   +-- CausalePagamento (A-ZO, codice CU)
    |   |   +-- DatiBollo [0..1]
    |   |   |   +-- BolloVirtuale (xs:string, "SI")
    |   |   |   +-- ImportoBollo (xs:decimal, 2.00)
    |   |   +-- DatiCassaPrevidenziale [0..N]
    |   |   |   +-- TipoCassa (TC01-TC22)
    |   |   |   +-- AlCassa (xs:decimal, %)
    |   |   |   +-- ImportoContributoCassa (xs:decimal)
    |   |   |   +-- ImponibileCassa [0..1] (xs:decimal)
    |   |   |   +-- AliquotaIVA (xs:decimal)
    |   |   |   +-- Ritenuta [0..1] (xs:string, "SI")
    |   |   |   +-- Natura [0..1] (N1-N7.x)
    |   |   |   +-- RiferimentoAmministrazione [0..1]
    |   |   +-- ScontoMaggiorazione [0..N]
    |   |   |   +-- Tipo (SC = sconto, MG = maggiorazione)
    |   |   |   +-- Percentuale [0..1]
    |   |   |   +-- Importo [0..1]
    |   |   +-- ImportoTotaleDocumento [0..1] (xs:decimal)
    |   |   +-- Arrotondamento [0..1] (xs:decimal)
    |   |   +-- Causale [0..N] (xs:string, max 200 char)
    |   |   +-- Art73 [0..1] (xs:string, "SI")
    |   |
    |   +-- DatiOrdineAcquisto [0..N]
    |   |   +-- RiferimentoNumeroLinea [0..N]
    |   |   +-- IdDocumento
    |   |   +-- Data [0..1]
    |   |   +-- NumItem [0..1]
    |   |   +-- CodiceCommessaConvenzione [0..1]
    |   |   +-- CodiceCUP [0..1]
    |   |   +-- CodiceCIG [0..1]
    |   |
    |   +-- DatiContratto [0..N] (stessa struttura DatiOrdineAcquisto)
    |   +-- DatiConvenzione [0..N] (stessa struttura)
    |   +-- DatiRicezione [0..N] (stessa struttura)
    |   +-- DatiFattureCollegate [0..N] (stessa struttura)
    |   |
    |   +-- DatiSAL [0..N]
    |   |   +-- RiferimentoFase
    |   |
    |   +-- DatiDDT [0..N]
    |   |   +-- NumeroDDT
    |   |   +-- DataDDT
    |   |   +-- RiferimentoNumeroLinea [0..N]
    |   |
    |   +-- DatiTrasporto [0..1]
    |       +-- DatiAnagraficiVettore [0..1]
    |       +-- MezzoTrasporto [0..1]
    |       +-- CausaleTrasporto [0..1]
    |       +-- NumeroColli [0..1]
    |       +-- Descrizione [0..1]
    |       +-- UnitaMisuraPeso [0..1]
    |       +-- PesoLordo [0..1]
    |       +-- PesoNetto [0..1]
    |       +-- DataOraRitiro [0..1]
    |       +-- DataInizioTrasporto [0..1]
    |       +-- TipoResa [0..1]
    |       +-- IndirizzoResa [0..1]
    |
    +-- DatiBeniServizi
    |   +-- DettaglioLinee [1..N]
    |   |   +-- NumeroLinea (xs:integer, progressivo da 1)
    |   |   +-- TipoCessionePrestazione [0..1] (SC/PR/AB/AC)
    |   |   +-- CodiceArticolo [0..N]
    |   |   |   +-- CodiceTipo (xs:string, max 35 char)
    |   |   |   +-- CodiceValore (xs:string, max 35 char)
    |   |   +-- Descrizione (xs:string, max 1000 char)
    |   |   +-- Quantita [0..1] (xs:decimal)
    |   |   +-- UnitaMisura [0..1] (xs:string)
    |   |   +-- DataInizioPeriodo [0..1] (xs:date)
    |   |   +-- DataFinePeriodo [0..1] (xs:date)
    |   |   +-- PrezzoUnitario (xs:decimal, fino a 8 decimali)
    |   |   +-- ScontoMaggiorazione [0..N]
    |   |   +-- PrezzoTotale (xs:decimal, fino a 8 decimali)
    |   |   +-- AliquotaIVA (xs:decimal, 2 decimali)
    |   |   +-- Ritenuta [0..1] (xs:string, "SI")
    |   |   +-- Natura [0..1] (N1-N7.x, obbligatorio se AliquotaIVA=0)
    |   |   +-- RiferimentoAmministrazione [0..1]
    |   |   +-- AltriDatiGestionali [0..N]
    |   |       +-- TipoDato
    |   |       +-- RiferimentoTesto [0..1]
    |   |       +-- RiferimentoNumero [0..1]
    |   |       +-- RiferimentoData [0..1]
    |   |
    |   +-- DatiRiepilogo [1..N]
    |       +-- AliquotaIVA (xs:decimal)
    |       +-- Natura [0..1] (obbligatorio se AliquotaIVA=0)
    |       +-- SpeseAccessorie [0..1] (xs:decimal)
    |       +-- Arrotondamento [0..1] (xs:decimal)
    |       +-- ImponibileImporto (xs:decimal)
    |       +-- Imposta (xs:decimal)
    |       +-- EsigibilitaIVA [0..1] (I/D/S)
    |       +-- RiferimentoNormativo [0..1] (xs:string, max 100 char)
    |
    +-- DatiVeicoli [0..1]
    |   +-- Data
    |   +-- TotalePercorso
    |
    +-- DatiPagamento [0..N]
    |   +-- CondizioniPagamento (TP01 = rate, TP02 = completo, TP03 = anticipo)
    |   +-- DettaglioPagamento [1..N]
    |       +-- Beneficiario [0..1]
    |       +-- ModalitaPagamento (MP01-MP23)
    |       +-- DataRiferimentoTerminiPagamento [0..1]
    |       +-- GiorniTerminiPagamento [0..1]
    |       +-- DataScadenzaPagamento [0..1]
    |       +-- ImportoPagamento (xs:decimal)
    |       +-- CodUfficioPostale [0..1]
    |       +-- CognomeQuietanzante [0..1]
    |       +-- NomeQuietanzante [0..1]
    |       +-- CFQuietanzante [0..1]
    |       +-- TitoloQuietanzante [0..1]
    |       +-- IstitutoFinanziario [0..1]
    |       +-- IBAN [0..1]
    |       +-- ABI [0..1]
    |       +-- CAB [0..1]
    |       +-- BIC [0..1]
    |       +-- ScontoPagamentoAnticipato [0..1]
    |       +-- DataLimitePagamentoAnticipato [0..1]
    |       +-- PenalitaPagamentiRitardati [0..1]
    |       +-- DataDecorrenzaPenale [0..1]
    |       +-- CodicePagamento [0..1]
    |
    +-- Allegati [0..N]
        +-- NomeAttachment (xs:string, max 60 char)
        +-- AlgoritmoCompressione [0..1]
        +-- FormatoAttachment [0..1]
        +-- DescrizioneAttachment [0..1]
        +-- Attachment (xs:base64Binary)
```

---

## 3. Codifiche Ufficiali

### 3.1 TipoDocumento

| Codice | Descrizione |
|---|---|
| **TD01** | Fattura |
| **TD02** | Acconto/anticipo su fattura |
| **TD03** | Acconto/anticipo su parcella |
| **TD04** | Nota di credito |
| **TD05** | Nota di debito |
| **TD06** | Parcella |
| **TD07** | Fattura semplificata |
| **TD08** | Nota di credito semplificata |
| **TD09** | Nota di debito semplificata |
| **TD16** | Integrazione fattura reverse charge interno |
| **TD17** | Integrazione/autofattura per acquisto servizi dall'estero |
| **TD18** | Integrazione per acquisto di beni intracomunitari |
| **TD19** | Integrazione/autofattura per acquisto di beni ex art.17 c.2 DPR 633/72 |
| **TD20** | Autofattura per regolarizzazione e integrazione delle fatture (art.6 c.8 DLgs 471/97 o art.46 c.5 DL 331/93) |
| **TD21** | Autofattura per splafonamento |
| **TD22** | Estrazione beni da Deposito IVA |
| **TD23** | Estrazione beni da Deposito IVA con versamento IVA |
| **TD24** | Fattura differita di cui all'art.21 c.4 lett.a) |
| **TD25** | Fattura differita di cui all'art.21 c.4 terzo periodo lett.b) |
| **TD26** | Cessione di beni ammortizzabili e per passaggi interni (art.36 DPR 633/72) |
| **TD27** | Fattura per autoconsumo o per cessioni gratuite senza rivalsa |
| **TD28** | Acquisti da San Marino con IVA (fattura cartacea) |

### 3.2 Natura IVA (operazioni senza IVA)

| Codice | Descrizione |
|---|---|
| **N1** | Escluse ex art. 15 DPR 633/72 |
| **N2.1** | Non soggette ad IVA — artt. da 7 a 7-septies DPR 633/72 |
| **N2.2** | Non soggette — altri casi |
| **N3.1** | Non imponibili — esportazioni |
| **N3.2** | Non imponibili — cessioni intracomunitarie |
| **N3.3** | Non imponibili — cessioni verso San Marino |
| **N3.4** | Non imponibili — operazioni assimilate alle cessioni all'esportazione |
| **N3.5** | Non imponibili — a seguito di dichiarazioni d'intento (art.8 c.1 lett.c) |
| **N3.6** | Non imponibili — altre operazioni che non concorrono alla formazione del plafond |
| **N4** | Esenti (art. 10 DPR 633/72) |
| **N5** | Regime del margine / IVA non esposta in fattura |
| **N6.1** | Inversione contabile — cessione di rottami e materiali di recupero |
| **N6.2** | Inversione contabile — cessione di oro e argento ai sensi della L. 7/2000 e di oreficeria usata |
| **N6.3** | Inversione contabile — subappalto nel settore edile |
| **N6.4** | Inversione contabile — cessione di fabbricati |
| **N6.5** | Inversione contabile — cessione di telefoni cellulari |
| **N6.6** | Inversione contabile — cessione di prodotti elettronici |
| **N6.7** | Inversione contabile — prestazioni comparto edile e settori connessi |
| **N6.8** | Inversione contabile — operazioni settore energetico |
| **N6.9** | Inversione contabile — altri casi |
| **N7** | IVA assolta in altro stato UE (prestazioni di servizi di telecomunicazioni, tele-radiodiffusione ed elettronici ex art.7-octies lett.a, b, art.74-sexies DPR 633/72) |

### 3.3 RegimeFiscale

| Codice | Descrizione |
|---|---|
| **RF01** | Regime ordinario |
| **RF02** | Regime dei contribuenti minimi (art.1, c.96-117, L. 244/2007) |
| **RF04** | Agricoltura e attivita connesse e pesca (artt.34 e 34-bis DPR 633/72) |
| **RF05** | Vendita sali e tabacchi (art.74 c.1 DPR 633/72) |
| **RF06** | Commercio di fiammiferi (art.74 c.1 DPR 633/72) |
| **RF07** | Editoria (art.74 c.1 DPR 633/72) |
| **RF08** | Gestione di servizi di telefonia pubblica (art.74 c.1 DPR 633/72) |
| **RF09** | Rivendita di documenti di trasporto pubblico e di sosta (art.74 c.1 DPR 633/72) |
| **RF10** | Intrattenimenti, giochi e altre attivita di cui alla tariffa allegata al DPR 640/72 (art.74 c.6 DPR 633/72) |
| **RF11** | Agenzie di viaggi e turismo (art.74-ter DPR 633/72) |
| **RF12** | Agriturismo (art.5 c.2 L. 413/91) |
| **RF13** | Vendite a domicilio (art.25-bis c.6 DPR 600/73) |
| **RF14** | Rivendita di beni usati, di oggetti d'arte, d'antiquariato o da collezione (art.36 DL 41/95) |
| **RF15** | Agenzie di vendite all'asta di oggetti d'arte, antiquariato o da collezione (art.40-bis DL 41/95) |
| **RF16** | IVA per cassa PA (art.6 c.5 DPR 633/72) |
| **RF17** | IVA per cassa (art.32-bis DL 83/2012) |
| **RF18** | Altro |
| **RF19** | Regime forfettario (art.1 c.54-89 L. 190/2014) |

### 3.4 ModalitaPagamento

| Codice | Descrizione |
|---|---|
| **MP01** | Contanti |
| **MP02** | Assegno |
| **MP03** | Assegno circolare |
| **MP04** | Contanti presso Tesoreria |
| **MP05** | Bonifico |
| **MP06** | Vaglia cambiario |
| **MP07** | Bollettino bancario |
| **MP08** | Carta di pagamento |
| **MP09** | RID |
| **MP10** | RID utenze |
| **MP11** | RID veloce |
| **MP12** | RIBA |
| **MP13** | MAV |
| **MP14** | Quietanza erario |
| **MP15** | Giroconto su conti di contabilita speciale |
| **MP16** | Domiciliazione bancaria |
| **MP17** | Domiciliazione postale |
| **MP18** | Bollettino di c/c postale |
| **MP19** | SEPA Direct Debit |
| **MP20** | SEPA Direct Debit CORE |
| **MP21** | SEPA Direct Debit B2B |
| **MP22** | Trattenuta su somme gia riscosse |
| **MP23** | PagoPA |

### 3.5 TipoCassa (casse previdenziali)

| Codice | Descrizione |
|---|---|
| **TC01** | Cassa nazionale previdenza e assistenza avvocati e procuratori legali |
| **TC02** | Cassa previdenza dottori commercialisti |
| **TC03** | Cassa previdenza e assistenza geometri |
| **TC04** | Cassa nazionale previdenza e assistenza ingegneri e architetti liberi professionisti |
| **TC05** | Cassa nazionale del notariato |
| **TC06** | Cassa nazionale previdenza e assistenza ragionieri e periti commerciali |
| **TC07** | Ente nazionale assistenza agenti e rappresentanti di commercio (ENASARCO) |
| **TC08** | Ente nazionale previdenza e assistenza consulenti del lavoro (ENPACL) |
| **TC09** | Ente nazionale previdenza e assistenza medici (ENPAM) |
| **TC10** | Ente nazionale previdenza e assistenza farmacisti (ENPAF) |
| **TC11** | Ente nazionale previdenza e assistenza veterinari (ENPAV) |
| **TC12** | Ente nazionale previdenza e assistenza impiegati dell'agricoltura (ENPAIA) |
| **TC13** | Fondo previdenza impiegati imprese di spedizione e agenzie marittime |
| **TC14** | Istituto nazionale previdenza giornalisti italiani (INPGI) |
| **TC15** | Opera nazionale assistenza orfani sanitari italiani (ONAOSI) |
| **TC16** | Cassa autonoma assistenza integrativa giornalisti italiani (CASAGIT) |
| **TC17** | Ente previdenza periti industriali e periti industriali laureati (EPPI) |
| **TC18** | Ente previdenza e assistenza pluricategoriale (EPAP) |
| **TC19** | Ente nazionale previdenza e assistenza biologi (ENPAB) |
| **TC20** | Ente nazionale previdenza e assistenza professione infermieristica (ENPAPI) |
| **TC21** | Ente nazionale previdenza e assistenza psicologi (ENPAP) |
| **TC22** | INPS |

### 3.6 TipoRitenuta

| Codice | Descrizione |
|---|---|
| **RT01** | Ritenuta di acconto persone fisiche |
| **RT02** | Ritenuta di acconto persone giuridiche |
| **RT03** | Contributo INPS |
| **RT04** | Contributo ENASARCO |
| **RT05** | Contributo ENPAM |
| **RT06** | Altro contributo previdenziale |

### 3.7 EsigibilitaIVA

| Codice | Descrizione |
|---|---|
| **I** | Esigibilita immediata |
| **D** | Esigibilita differita |
| **S** | Scissione dei pagamenti (split payment, art.17-ter DPR 633/72) |

### 3.8 Mapping TipoRitenuta interno → CausalePagamento (codici CU)

| TipoRitenuta (app) | TipoRitenuta SDI | CausalePagamento |
|---|---|---|
| LAVORO_AUTONOMO | RT01 | A (prestazioni di lavoro autonomo) |
| PROVVIGIONI | RT01 | R (provvigioni) |
| OCCASIONALE | RT01 | M (prestazioni occasionali) |
| DIRITTI_AUTORE | RT01 | L (diritti d'autore) |

---

## 4. CodiceDestinatario — Regole

| Scenario | CodiceDestinatario | PECDestinatario | Note |
|---|---|---|---|
| B2B con codice | Codice 7 caratteri del destinatario | Non compilare | Es. "ABCDEFG" |
| B2B via PEC | "0000000" | Indirizzo PEC | 7 zeri |
| B2C (persona fisica senza P.IVA) | "0000000" | Non compilare | Fattura disponibile in area riservata AdE |
| Soggetto estero | "XXXXXXX" | Non compilare | 7 X maiuscole |
| PA | Codice IPA 6 caratteri | Non compilare | Formato FPA12, fuori scope |

---

## 5. Nomenclatura File

### 5.1 Nome file fattura

Formato: `IT{PIVA}_{progressivo}.xml`

| Componente | Regola |
|---|---|
| `IT` | Codice paese (fisso per emittenti italiani) |
| `{PIVA}` | Partita IVA del trasmittente (11 cifre) |
| `_` | Separatore (underscore) |
| `{progressivo}` | Alfanumerico, max 5 caratteri, univoco per trasmittente. Es. "00001", "0000A" |
| `.xml` | Estensione |

Esempio: `IT01234567890_00001.xml`

### 5.2 Lotto di fatture

Un file XML puo contenere piu FatturaElettronicaBody (lotto), ma il nome file resta unico per trasmissione.

### 5.3 File firmato

Se firmato digitalmente: `IT01234567890_00001.xml.p7m` (CAdES) oppure estensione `.xml` con firma XAdES-BES incorporata.

---

## 6. Notifiche SDI

### 6.1 Tipi di notifica

| Notifica | Sigla file | Significato | Azione |
|---|---|---|---|
| Ricevuta di consegna | `RC` | Fattura consegnata al destinatario | Stato → CONSEGNATA |
| Notifica di mancata consegna | `MC` | SDI non e riuscito a consegnare | La fattura e comunque valida; SDI riprovera. Stato → MANCATA_CONSEGNA |
| Notifica di scarto | `NS` | Fattura rifiutata per errori formali | Stato → SCARTATA. Correggere e riemettere con stesso numero/data entro 5 gg |
| Notifica esito committente | `EC` | Accettazione o rifiuto da PA | Solo per PA |
| Attestazione di avvenuta trasmissione con impossibilita di recapito | `AT` | SDI non riesce a consegnare dopo i tentativi | Fattura disponibile in area AdE del destinatario. Stato → IMPOSSIBILITA_RECAPITO |
| Notifica di decorrenza termini | `DT` | Nessun esito PA entro 15 gg | Solo per PA |
| Ricevuta di scarto per file non conforme | — | File non XML o non valido | Non entra nel flusso |
| Metadati file fattura | `MT` | Metadati associati alla fattura ricevuta | Solo per ricezione |

### 6.2 Nome file notifica

Formato: `IT{PIVA}_{progressivo}_{tipo}_{progressivoNotifica}.xml`

Esempio: `IT01234567890_00001_RC_001.xml`

---

## 7. Regole di Validazione

### 7.1 Controlli aritmetici

| Regola | Formula | Tolleranza |
|---|---|---|
| **PrezzoTotale linea** | PrezzoUnitario * Quantita (- sconti + maggiorazioni) | +/- 1 centesimo (0.01) per linea |
| **ImponibileImporto riepilogo** | Somma PrezzoTotale delle linee con stessa AliquotaIVA e Natura | +/- 1 centesimo |
| **Imposta riepilogo** | ImponibileImporto * AliquotaIVA / 100 | +/- 1 centesimo |
| **ImportoTotaleDocumento** | Somma di tutti ImponibileImporto + Imposta (+/- arrotondamenti, bollo, cassa, ritenute) | Controllo non bloccante (warning) |

### 7.2 Controlli di coerenza

| Regola | Codice errore SDI |
|---|---|
| Se AliquotaIVA = 0, Natura obbligatoria | 00400 |
| Se AliquotaIVA > 0, Natura NON deve essere presente | 00401 |
| Se TipoDocumento = TD01/TD02/TD03/TD06/TD24/TD25, Importo NON negativo | 00418 |
| Se TipoDocumento = TD04, Importo NON negativo (ma e una nota credito) | 00418 |
| IdFiscaleIVA o CodiceFiscale obbligatorio per CessionarioCommittente | 00417 |
| Partita IVA cedente deve essere attiva (controllo SDI) | 00301 |
| Numero documento deve contenere almeno una cifra | 00425 |
| Data documento non puo essere nel futuro | 00403 |
| CodiceDestinatario deve essere "XXXXXXX" se IdPaese cessionario != "IT" | 00313 |
| Se BolloVirtuale = "SI", ImportoBollo obbligatorio | 00471 |
| Se DatiRitenuta presente, almeno una linea con Ritenuta = "SI" | 00411 |
| Divisa = "EUR" (in pratica, quasi sempre) | Non bloccante |

### 7.3 Codici errore SDI piu frequenti

| Codice | Descrizione |
|---|---|
| 00200 | File non conforme al formato |
| 00300 | IdFiscaleIVA cedente non coerente |
| 00301 | IdFiscaleIVA cedente non presente in Anagrafe Tributaria |
| 00305 | IdFiscaleIVA cessionario non presente in Anagrafe Tributaria |
| 00311 | CodiceDestinatario non valido |
| 00313 | CodiceDestinatario non coerente con nazione cessionario |
| 00400 | Natura obbligatoria se AliquotaIVA = 0 |
| 00401 | Natura non ammessa se AliquotaIVA > 0 |
| 00403 | Data documento nel futuro |
| 00411 | DatiRitenuta senza linee con Ritenuta = "SI" |
| 00417 | Identificativo fiscale cessionario mancante |
| 00418 | ImportoTotaleDocumento incoerente con TipoDocumento |
| 00425 | Numero documento senza cifre |
| 00427 | Fattura duplicata (stesso IdTrasmittente + progressivo) |
| 00471 | BolloVirtuale senza ImportoBollo |

---

## 8. Bollo Virtuale

### 8.1 Quando si applica

Il bollo da **EUR 2,00** e obbligatorio sulle fatture (e documenti equipollenti):
- Con importo > EUR 77,47
- **Esenti IVA** (art. 10 DPR 633/72, Natura N4)
- **Non imponibili** senza addebito IVA (Natura N2.1, N2.2, N3.x in alcuni casi)
- **Escluse da IVA** (art. 15 DPR 633/72, Natura N1)
- **Regime forfettario** (Natura N2.2 per forfettari)
- **Regime dei minimi**

Non si applica a:
- Fatture con IVA esposta (aliquota > 0)
- Importi <= EUR 77,47
- Note di credito (discusso, ma prassi prevalente: si applica)

### 8.2 Implementazione in FatturaPA

```xml
<DatiBollo>
  <BolloVirtuale>SI</BolloVirtuale>
  <ImportoBollo>2.00</ImportoBollo>
</DatiBollo>
```

### 8.3 Versamento

Il bollo virtuale va versato con F24:
- Codice tributo: **2501** (I trimestre), **2502** (II), **2503** (III), **2504** (IV)
- Scadenza: entro l'ultimo giorno del 2 mese successivo al trimestre
- Se importo < EUR 5.000 nei primi due trimestri, versamento differito al 30/11

---

## 9. Split Payment (Scissione dei Pagamenti)

### 9.1 Soggetti interessati

- PA e societa controllate dalla PA (elenchi pubblicati da MEF)
- Non applicabile a professionisti soggetti a ritenuta d'acconto

### 9.2 Implementazione in FatturaPA

- `EsigibilitaIVA` = **S** nel `DatiRiepilogo`
- L'IVA e esposta in fattura ma non incassata dal cedente
- `ImportoTotaleDocumento` include l'IVA
- Il pagamento effettivo e al netto dell'IVA

---

## 10. Numero Documento e Sezionali

### 10.1 Regole di numerazione

| Regola | Fonte |
|---|---|
| Numerazione progressiva per anno solare | Art. 21 c.2 lett.b) DPR 633/72 |
| Deve contenere almeno una cifra | Specifica tecnica SDI |
| Puo contenere prefissi/suffissi alfanumerici | Ris. AdE 1/E del 10/1/2013 |
| Piu sezionali consentiti purche ciascuno progressivo | Ris. AdE 1/E del 10/1/2013 |
| Il numero deve permettere l'univoca identificazione della fattura | Art. 21 c.2 lett.b) DPR 633/72 |

### 10.2 Formato sezionale tipico

Esempi accettati:
- `1`, `2`, `3` ... (numerico semplice)
- `FV/1`, `FV/2` ... (prefisso + separatore + numero)
- `2026/FV/001` (anno + prefisso + numero)
- `1/A`, `2/A` (numero + suffisso sezionale)

### 10.3 Continuita numerazione

- Non sono ammessi buchi nella numerazione (salvo note di credito che annullano fatture)
- In caso di migrazione da altro sistema, il primo numero deve essere il successivo all'ultimo emesso

---

## 11. Mapping Interno → FatturaPA

### 11.1 RegimeFiscale

| Valore app (Societa.regimeFiscale) | Codice FatturaPA |
|---|---|
| ORDINARIO | RF01 |
| FORFETTARIO | RF19 |

### 11.2 NaturaIva

| Valore app (NaturaIva) | Codice FatturaPA |
|---|---|
| N1 | N1 |
| N2_1 | N2.1 |
| N2_2 | N2.2 |
| N3_1 | N3.1 |
| N3_2 | N3.2 |
| N3_3 | N3.3 |
| N3_4 | N3.4 |
| N3_5 | N3.5 |
| N3_6 | N3.6 |
| N4 | N4 |
| N5 | N5 |
| N6_1 | N6.1 |
| N6_2 | N6.2 |
| N6_3 | N6.3 |
| N6_4 | N6.4 |
| N6_5 | N6.5 |
| N6_6 | N6.6 |
| N6_7 | N6.7 |
| N6_8 | N6.8 |
| N6_9 | N6.9 |
| N7 | N7 |

Nota: il carattere `_` nell'enum Prisma diventa `.` nel codice FatturaPA.

### 11.3 TipoDocumentoSdi

La mappatura e diretta: il nome dell'enum corrisponde al codice (TD01, TD02, ecc.).

### 11.4 TipoRitenuta app → TipoRitenuta SDI

| TipoRitenuta (app) | TipoRitenuta SDI |
|---|---|
| LAVORO_AUTONOMO | RT01 |
| PROVVIGIONI | RT01 |
| OCCASIONALE | RT01 |
| DIRITTI_AUTORE | RT01 |

Tutti mappano a RT01 (persone fisiche). Per persone giuridiche, usare RT02 in base a `TipoSoggetto` dell'anagrafica.
