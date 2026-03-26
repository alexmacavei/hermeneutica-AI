# PDF Export – Hermeneutical Analysis

Logged-in users can download the hermeneutical analysis for any analysed Scripture verse as a
formatted PDF file.

## How to use

1. Log in to the application.
2. Select a Scripture passage and run an analysis from the **Bible Viewer**.
3. Once the analysis results appear, click the **📄 PDF export** button (file-pdf icon) in the
   results header, next to the notes button.
4. The application fetches your personal notes for that verse and then generates the PDF.
5. The file is automatically downloaded by the browser as `analiza-<reference>.pdf`.

> **Note:** You must be authenticated to export. If you are not logged in, a warning toast is
> displayed instead.

---

## PDF structure

The exported PDF is an A4 portrait document with the following sections:

| # | Section | Contents |
|---|---------|----------|
| 1 | **Document title** | "Analiză Hermeneutică" + verse reference + generation date |
| 2 | **Pasaj Biblic** | Full text of the analysed Scripture verse |
| 3 | **Analiza Hermeneutică** | Four sub-sections, one per analysis card: |
|   | &emsp;Principii Hermeneutice | Hermeneutical principles |
|   | &emsp;Influențe Filozofice | Philosophical influences |
|   | &emsp;Comentarii Patristice | Patristic commentary |
|   | &emsp;Analiză Filologică | Philological analysis |
| 4 | **Notițe personale** | All user notes saved for the verse (omitted if none exist) |

---

## Technical implementation

| File | Role |
|------|------|
| `frontend/src/app/services/pdf-export.service.ts` | Injectable service that builds and downloads the PDF using [jsPDF](https://github.com/parallax/jsPDF)'s `html()` method backed by [html2canvas](https://html2canvas.hertzen.com/). |
| `frontend/src/app/analysis/results-viewer.component.ts` | Hosts the export button; injects `PdfExportService`, `NotesService`, and `AuthService`. |

### Dependencies

```
jspdf@4.2.1   (added to frontend/package.json; html2canvas is bundled with jsPDF)
```

### `PdfExportService.exportAnalysis(result, notes)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `result` | `AnalysisResult` | Full analysis result from the backend. |
| `notes` | `UserNote[]` | User notes for the verse (may be an empty array). |

Returns `Promise<void>` that resolves once the PDF has been saved.

The service:

1. Builds an HTML string (`buildHtml`) with inline styles.
2. Calls `jsPDF.html()`, which uses html2canvas to render the HTML in a hidden browser
   element and capture it to canvas images embedded in the PDF.
   - Because the browser's own font stack renders the HTML, **Romanian diacritics** (ă, â, î,
     ș, ț) and all other Unicode characters are displayed correctly.
   - Text wraps naturally according to CSS `word-wrap: break-word`.
3. Uses `autoPaging: 'slice'` to render the HTML as image slices via html2canvas, ensuring
   the browser's own font stack is used. This is what makes Romanian diacritics (ă, â, î,
   ș, ț) render correctly — `autoPaging: 'text'` would use jsPDF's internal Helvetica font
   which does not cover Latin Extended-A characters.
4. Calls `doc.save(filename)` to trigger the browser download.

Markdown bold markers (`**...**`) are converted to `<strong>` tags via `markdownToHtml()`.
LLM literal `\n\n` escape sequences are converted to real newlines before further processing.
All user-supplied content is HTML-escaped via `escapeHtml()` before insertion into the template.
