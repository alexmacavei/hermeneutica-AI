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
| `frontend/src/app/services/pdf-export.service.ts` | Injectable service that builds and downloads the PDF using [jsPDF](https://github.com/parallax/jsPDF). |
| `frontend/src/app/analysis/results-viewer.component.ts` | Hosts the export button; injects `PdfExportService`, `NotesService`, and `AuthService`. |

### Dependencies

```
jspdf@4.2.1   (added to frontend/package.json)
```

### `PdfExportService.exportAnalysis(result, notes)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `result` | `AnalysisResult` | Full analysis result from the backend. |
| `notes` | `UserNote[]` | User notes for the verse (may be an empty array). |

The service:

1. Creates a new `jsPDF` A4 document.
2. Renders the document title, date, and horizontal rule.
3. Renders the full Scripture verse text.
4. Iterates over the four `CARD_DEFS` and renders each non-empty card as a labelled section.
5. If `notes.length > 0`, appends a "Notițe personale" section listing each note with its title
   and text.
6. Calls `doc.save(filename)` to trigger browser download.

Markdown bold markers (`**...**`) and literal `\n\n` escape sequences from the LLM output are
stripped before writing to the PDF via the internal `stripMarkdown()` helper.
