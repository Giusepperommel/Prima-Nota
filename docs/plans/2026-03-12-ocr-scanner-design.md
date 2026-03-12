# OCR Document Scanner - Design Document

## Goal

Aggiungere la possibilità di trascinare (drag & drop) un'immagine o PDF nella sezione "Nuova Operazione" per pre-compilare automaticamente il form tramite OCR, con un campo dedicato per incollare screenshot.

## Architecture

### Drop Zone Globale + Pre-compilazione Form

L'intera sezione "Nuova Operazione" diventa una drop zone invisibile. Quando l'utente trascina un file (immagine o PDF), appare un overlay visivo e parte l'OCR automaticamente. I dati estratti pre-compilano i campi del form esistente. L'utente modifica liberamente e salva normalmente.

**Flusso:**
1. Utente trascina file (img/PDF) ovunque nella sezione → overlay "Rilascia per scansionare"
2. OCR parte in automatico (Tesseract.js per immagini, pdf.js + Tesseract.js per PDF)
3. Parsing dei dati estratti (data, importo, fornitore, IVA, ecc.)
4. I campi del form vengono pre-compilati con i dati estratti
5. Campi pre-compilati evidenziati visivamente (bordo ambra) per indicare provenienza OCR
6. L'utente modifica liberamente qualsiasi campo
7. Salva come farebbe normalmente

Nessuno stato BOZZA separato. L'OCR è solo un modo rapido per compilare il form.

---

## Parsing e Campi Estratti

| Dato estratto | Campo form | Note |
|---|---|---|
| Data documento/fattura | Data operazione | Formato italiano DD/MM/YYYY |
| Numero fattura/ricevuta | Numero documento | |
| Ragione sociale/fornitore | Descrizione | Prefissato come "Fatt. [fornitore] - [num doc]" |
| Importo totale | Importo | |
| Imponibile | Imponibile | Se presente, calcola IVA di conseguenza |
| Aliquota IVA (22%, 10%, 4%) | Aliquota IVA | Seleziona dal dropdown |
| Importo IVA | Importo IVA | Usato come fallback se non c'è aliquota esplicita |

**Strategia di parsing:**
- Regex italiani per pattern comuni: `€`, `Totale`, `Imponibile`, `IVA`, `Data`, `Fattura n.`, `P.IVA`
- Se il documento è una fattura, prova a impostare tipo = "FATTURA"
- Se è un movimento bancario (screen), cerca importo e data, imposta descrizione dal testo
- Campi non trovati restano vuoti → l'utente li compila manualmente
- Mai sovrascrivere campi che l'utente ha già compilato prima del drop

---

## UX e Interazione

**Drop Zone:**
- Intera area del form "Nuova Operazione" è drop zone invisibile
- Al drag → overlay semi-trasparente con icona e testo "Rilascia per scansionare"
- Accetta: immagini (PNG, JPG, WEBP) e PDF
- File non supportati → toast di errore

**Campo Paste:**
- Posizionato sopra il form, discreto: area con placeholder "Incolla qui uno screenshot (Ctrl+V)"
- Intercetta evento `paste` con immagine dal clipboard
- Stessa pipeline OCR del drag & drop

**Indicatori OCR:**
- Durante scansione: spinner overlay sul form con "Scansione in corso..."
- Campi compilati dall'OCR: bordo ambra + piccola icona "scan"
- Al focus/modifica del campo, l'highlight scompare
- Toast successo: "Scansione completata - X campi compilati"
- Se OCR non trova nulla: toast warning "Nessun dato riconosciuto dal documento"

**Protezione dati esistenti:**
- Se il form ha campi compilati, dialog conferma: "Alcuni campi sono già compilati. Vuoi sovrascriverli con i dati estratti?"

---

## Stack Tecnico

**Librerie:**
- Tesseract.js v5 - OCR browser-side, worker dedicato, lingua italiana (`ita`)
- pdfjs-dist - Estrazione pagine PDF come immagini canvas
- Nessuna dipendenza server-side aggiuntiva

**Struttura file:**

```
src/
  lib/
    ocr/
      tesseract-worker.ts    — init/gestione worker Tesseract.js
      pdf-extractor.ts       — PDF → canvas → immagine con pdf.js
      parser.ts              — regex italiani per estrarre dati dal testo OCR
      types.ts               — tipi (OcrResult, ParsedDocument)
  hooks/
    use-ocr.ts               — hook React: orchestrazione OCR pipeline
  components/
    ocr/
      global-drop-zone.tsx   — wrapper drop zone invisibile
      paste-field.tsx         — campo incolla screenshot
      ocr-field-highlight.tsx — wrapper per evidenziare campi compilati da OCR
```

**Integrazione nel form:**
- `GlobalDropZone` wrappa il contenuto della sezione "Nuova Operazione" in `operazione-form.tsx`
- `PasteField` aggiunto sopra il form
- `useOcr()` chiamato nel form, restituisce `{ processFile, processImage, isProcessing, result }`
- Quando `result` cambia, un `useEffect` mappa i dati estratti nei campi del form

**Performance:**
- Worker Tesseract caricato lazy al primo utilizzo
- Worker resta in memoria per scansioni successive
- PDF: solo prima pagina processata di default
