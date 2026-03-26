import { Injectable } from '@angular/core';
import { AnalysisResult } from './analysis.service';
import { UserNote } from './notes.service';

interface CardDef {
  key: keyof AnalysisResult['cards'];
  title: string;
}

const CARD_DEFS: CardDef[] = [
  { key: 'hermeneutics', title: 'Principii Hermeneutice' },
  { key: 'philosophy', title: 'Influențe Filozofice' },
  { key: 'patristics', title: 'Comentarii Patristice' },
  { key: 'philology', title: 'Analiză Filologică' },
];

/** Escapes special HTML characters to prevent injection into the PDF template. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Converts AI markdown card text to safe HTML for embedding in the PDF template.
 * - Escapes HTML special characters first
 * - Replaces LLM literal \\n\\n sequences with real newlines
 * - Converts **bold** markers to <strong> tags
 * - Converts newlines to <br>
 */
function markdownToHtml(text: string): string {
  if (!text) return '';
  return escapeHtml(text)
    // LLM output contains the literal two-character sequence "\n" (backslash + n) twice;
    // replace those with a real newline before further processing.
    .replace(/\\n\\n/g, '\n')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  /**
   * Generates a PDF by rendering the analysis into a full HTML document and
   * opening the browser's native print dialog (which offers "Save as PDF" on
   * all modern browsers).
   *
   * A hidden `<iframe>` is used so the current page is not disrupted. The
   * browser's own rendering engine handles all layout, text wrapping, and
   * Unicode characters (including Romanian diacritics) correctly.
   *
   * Returns a Promise that resolves once the print dialog has been triggered.
   *
   * @param result  The analysis result returned by the backend.
   * @param notes   The current user's notes for the analysed verse (may be empty).
   */
  exportAnalysis(result: AnalysisResult, notes: UserNote[]): Promise<void> {
    // Delay (ms) between calling print() and cleaning up the iframe/blob URL.
    // The print dialog must have time to capture the document before the iframe
    // is removed from the DOM and the blob URL is revoked.
    const PRINT_DIALOG_DELAY_MS = 500;

    return new Promise<void>((resolve) => {
      const html = this.buildPrintHtml(result, notes);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;';

      iframe.onload = () => {
        iframe.contentWindow!.focus();
        iframe.contentWindow!.print();
        // Give the print dialog time to open before cleaning up the iframe/URL.
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
          resolve();
        }, PRINT_DIALOG_DELAY_MS);
      };

      document.body.appendChild(iframe);
      iframe.src = url;
    });
  }

  private buildPrintHtml(result: AnalysisResult, notes: UserNote[]): string {
    const date = new Date(result.timestamp).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const cardsHtml = CARD_DEFS.filter((c) => result.cards[c.key]?.trim())
      .map(
        (c) => `
        <div class="card-section">
          <h4 class="card-title">${escapeHtml(c.title)}</h4>
          <p class="card-text">${markdownToHtml(result.cards[c.key])}</p>
        </div>`,
      )
      .join('');

    let notesSection = '';
    if (notes.length > 0) {
      const noteItems = notes
        .map((n) => {
          const title = n.note_title?.trim()
            ? escapeHtml(n.note_title.trim())
            : `Notiță din ${new Date(n.created_at).toLocaleDateString('ro-RO', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}`;
          return `
            <div class="note-item">
              <div class="note-title">${title}</div>
              <div class="note-text">${markdownToHtml(n.note_text)}</div>
            </div>`;
        })
        .join('');

      notesSection = `
        <hr class="section-rule">
        <h3 class="section-title">Notițe personale</h3>
        ${noteItems}`;
    }

    return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>Analiză Hermeneutică – ${escapeHtml(result.reference)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1e1e3c;
    }

    h1 { font-size: 22pt; font-weight: bold; margin-bottom: 6pt; }
    h2 { font-size: 14pt; font-weight: bold; margin-bottom: 4pt; }

    .section-title {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 10pt;
    }

    .card-title {
      font-size: 11pt;
      color: #323264;
      font-weight: bold;
      margin-bottom: 4pt;
      padding-bottom: 3pt;
      border-bottom: 1px solid #d0d0e0;
    }

    .meta { font-size: 9pt; color: #888; margin-bottom: 12pt; }

    .header-rule {
      border: none;
      border-top: 1.5pt solid #7878a0;
      margin: 12pt 0;
    }

    .section-rule {
      border: none;
      border-top: 1pt solid #c0c0d0;
      margin: 12pt 0;
    }

    .verse-text {
      font-size: 11pt;
      color: #3c3c5a;
      font-style: italic;
      margin-bottom: 14pt;
    }

    .card-section { margin-bottom: 14pt; }
    .card-text { font-size: 10pt; color: #464660; }

    .note-item {
      margin-bottom: 10pt;
      padding: 8pt;
      background: #f0f0ff;
      border-left: 3pt solid #7878c8;
      border-radius: 3pt;
    }

    .note-title { font-size: 10pt; font-weight: bold; color: #323264; margin-bottom: 3pt; }
    .note-text { font-size: 10pt; color: #464660; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>Analiză Hermeneutică</h1>
  <h2>${escapeHtml(result.reference)}</h2>
  <p class="meta">Generat: ${date}</p>
  <hr class="header-rule">

  <h3 class="section-title">Pasaj Biblic</h3>
  <p class="verse-text">${escapeHtml(result.text)}</p>
  <hr class="section-rule">

  <h3 class="section-title">Analiza Hermeneutică</h3>
  ${cardsHtml}
  ${notesSection}
</body>
</html>`;
  }
}
