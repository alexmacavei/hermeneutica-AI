# PDF Export – Hermeneutical Analysis

Logged-in users can download the hermeneutical analysis for any analysed Scripture verse as a
formatted PDF file.

## How to use

1. Log in to the application.
2. Select a Scripture passage and run an analysis from the **Bible Viewer**.
3. Once the analysis results appear, click the **📄 PDF export** button (file-pdf icon) in the
   results header, next to the notes button.
4. The application fetches your personal notes for that verse and then generates the PDF.
5. The browser's **print dialog** opens — choose **"Save as PDF"** (available on all modern
   browsers) and click **Save**.

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
| `frontend/src/app/services/pdf-export.service.ts` | Injectable service that builds a complete HTML document and triggers the browser's native print dialog via a hidden `<iframe>`. |
| `frontend/src/app/analysis/results-viewer.component.ts` | Hosts the export button; injects `PdfExportService`, `NotesService`, and `AuthService`. |

### No external PDF library required

PDF generation uses the browser's native print API (`window.print()`) rather than a third-party
library such as jsPDF. This approach:

- **Correct Unicode rendering** — the browser's own font stack handles all characters including
  Romanian diacritics (ă, â, î, ș, ț) without any font-encoding workarounds.
- **Proper text wrapping** — the browser's layout engine wraps text to the page width exactly as
  it would render any HTML page.
- **Smaller bundle** — no jsPDF (~370 KB) or html2canvas (~400 KB) in the build output.
- **Crisp vector text** — the PDF contains real selectable text, not rasterised canvas images.

### `PdfExportService.exportAnalysis(result, notes)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `result` | `AnalysisResult` | Full analysis result from the backend. |
| `notes` | `UserNote[]` | User notes for the verse (may be an empty array). |

Returns `Promise<void>` that resolves once the print dialog has been triggered.

The service:

1. Builds a complete `<!DOCTYPE html>` document string (`buildPrintHtml`) with embedded CSS,
   including `@page { size: A4; margin: 15mm; }` and `@media print` colour rules.
2. Creates a `Blob` from the HTML string and a `URL.createObjectURL` URL.
3. Injects a hidden `<iframe>` (positioned off-screen) and sets its `src` to the blob URL.
4. On `iframe.onload`, calls `iframe.contentWindow.print()` to open the browser's print dialog.
5. After 500 ms, removes the iframe and revokes the blob URL.

Markdown bold markers (`**...**`) are converted to `<strong>` tags via `markdownToHtml()`.
LLM literal `\n\n` escape sequences are converted to real newlines before further processing.
All user-supplied content is HTML-escaped via `escapeHtml()` before insertion into the template.
