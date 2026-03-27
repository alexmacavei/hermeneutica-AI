# PDF Export – Hermeneutical Analysis

Logged-in users can download the hermeneutical analysis for any analysed Scripture verse as a
formatted PDF file.

## How to use

1. Log in to the application.
2. Select a Scripture passage and run an analysis from the **Bible Viewer**.
3. Once the analysis results appear, click the **📄 PDF export** button (file-pdf icon) in the
   results header, next to the notes button.
4. The application fetches your personal notes for that verse, sends them to the backend, and
   the PDF is automatically downloaded to your device.

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
| `backend/src/pdf/pdf.service.ts` | Builds the HTML document and renders it to PDF via Puppeteer (headless Chromium). |
| `backend/src/pdf/pdf.controller.ts` | Exposes `POST /api/pdf/export` (JWT-protected). Returns the PDF binary as `application/pdf`. |
| `backend/src/pdf/pdf.module.ts` | NestJS module that wires the controller and service. |
| `frontend/src/app/services/pdf-export.service.ts` | Sends the analysis payload to the backend and triggers a browser file download. |
| `frontend/src/app/analysis/results-viewer.component.ts` | Hosts the export button; injects `PdfExportService`, `NotesService`, and `AuthService`. |

### Backend rendering with Puppeteer

PDF generation is done server-side using [Puppeteer](https://pptr.dev/) with the system Chromium
binary. This approach:

- **Correct Unicode rendering** — Chromium's font stack handles all characters including
  Romanian diacritics (ă, â, î, ș, ț) without any font-encoding workarounds.
- **Proper text wrapping** — the browser layout engine wraps text to the A4 page width correctly.
- **No user interaction** — the PDF is generated silently and downloaded directly; no print
  dialog is shown to the user.
- **Consistent output** — identical PDF layout across all client browsers and operating systems.

### Docker / deployment

The backend `Dockerfile` installs the `chromium` package from the Alpine package registry.
The `PUPPETEER_EXECUTABLE_PATH` environment variable is set to `/usr/bin/chromium-browser`
inside the container — no further configuration is required when running via Docker Compose.

### Local development setup

When running the backend outside Docker (`npm run start:dev`), Puppeteer needs access to a
local Chrome or Chromium binary.

**Step 1 – Install Chrome or Chromium on your machine** (if you haven't already):

| OS | Recommended option |
|----|--------------------|
| macOS | [Google Chrome](https://www.google.com/chrome/) or `brew install chromium` |
| Ubuntu/Debian | `sudo apt install chromium-browser` or `google-chrome-stable` |
| Windows | [Google Chrome](https://www.google.com/chrome/) |

**Step 2 – Set `PUPPETEER_EXECUTABLE_PATH` in your `.env` file:**

```dotenv
# macOS – Google Chrome (typical install path)
PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome

# macOS – Chromium (Homebrew)
PUPPETEER_EXECUTABLE_PATH=/Applications/Chromium.app/Contents/MacOS/Chromium

# Ubuntu / Debian
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Windows
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

> **Note:** If Chrome or Chromium is installed at one of the standard paths above, it will be
> detected automatically and you do not need to set `PUPPETEER_EXECUTABLE_PATH` at all.
> The variable is only needed when your binary lives in a non-standard location.

### API endpoint

`POST /api/pdf/export`  
Requires a valid JWT (Bearer token). Returns `application/pdf`.

**Request body:**

```json
{
  "reference": "Facerea 1:1",
  "language": "ro",
  "text": "La început a făcut Dumnezeu cerul și pământul.",
  "cards": {
    "hermeneutics": "...",
    "philosophy": "...",
    "patristics": "...",
    "philology": "..."
  },
  "timestamp": "2026-03-26T12:00:00.000Z",
  "notes": [
    { "note_title": "Titlu", "note_text": "...", "created_at": "2026-03-20T10:00:00.000Z" }
  ]
}
```

### `PdfExportService.exportAnalysis(result, notes)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `result` | `AnalysisResult` | Full analysis result from the backend. |
| `notes` | `UserNote[]` | User notes for the verse (may be an empty array). |

Returns `Promise<void>` that resolves once the download has been triggered.

The service POSTs the analysis payload to `/api/pdf/export` with `responseType: 'blob'`, then
creates an object URL and programmatically clicks an `<a download>` anchor to save the file.

