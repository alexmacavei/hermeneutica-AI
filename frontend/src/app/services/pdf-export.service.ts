import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
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
   * Generates and downloads a PDF with the full hermeneutical analysis for a
   * Scripture verse, including all analysis cards and the user's personal notes.
   *
   * Uses jsPDF's html() method with `autoPaging: 'slice'` (backed by html2canvas) so
   * that the browser's own font stack renders the HTML as image slices – this ensures
   * Romanian diacritics (ă, â, î, ș, ț) and all other Unicode characters are displayed
   * correctly without relying on jsPDF's built-in Helvetica font encoding.
   *
   * Returns a Promise that resolves once the PDF has been saved.
   *
   * @param result  The analysis result returned by the backend.
   * @param notes   The current user's notes for the analysed verse (may be empty).
   */
  exportAnalysis(result: AnalysisResult, notes: UserNote[]): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const safeName = result.reference.replace(/[^a-zA-Z0-9_-]/g, '_');

    return doc.html(this.buildHtml(result, notes), {
      callback: (pdf) => pdf.save(`analiza-${safeName}.pdf`),
      // 15 mm margins on all sides; content occupies 180 mm of A4's 210 mm width.
      margin: [15, 15, 15, 15],
      // 'slice' renders the HTML via html2canvas as image slices, so the browser's
      // own font stack is used – all Unicode characters (including Romanian diacritics)
      // render correctly. 'text' mode re-renders with jsPDF's Helvetica and breaks them.
      autoPaging: 'slice',
      width: 180,
      // Virtual browser window width in CSS px; scale = 180 mm / 700 px ≈ 0.257 mm/px.
      // At this scale a 14 px body font ≈ 3.6 mm ≈ 10 pt in the PDF.
      windowWidth: 700,
    }).then(() => {});
  }

  private buildHtml(result: AnalysisResult, notes: UserNote[]): string {
    const date = new Date(result.timestamp).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const cardsHtml = CARD_DEFS.filter((c) => result.cards[c.key]?.trim())
      .map(
        (c) => `
        <div style="margin-bottom:16px;">
          <h4 style="font-size:15px;color:#323264;font-weight:bold;margin:0 0 6px 0;
                     padding-bottom:4px;border-bottom:1px solid #d0d0e0;">
            ${escapeHtml(c.title)}
          </h4>
          <p style="font-size:14px;color:#464660;margin:0;line-height:1.6;word-wrap:break-word;">
            ${markdownToHtml(result.cards[c.key])}
          </p>
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
            <div style="margin-bottom:12px;padding:10px;background:#f0f0ff;
                        border-left:3px solid #7878c8;border-radius:4px;">
              <div style="font-size:14px;font-weight:bold;color:#323264;margin-bottom:4px;">${title}</div>
              <div style="font-size:14px;color:#464660;line-height:1.6;">
                ${markdownToHtml(n.note_text)}
              </div>
            </div>`;
        })
        .join('');

      notesSection = `
        <hr style="border:none;border-top:1px solid #c0c0d0;margin:16px 0;"/>
        <h3 style="font-size:18px;color:#1e1e3c;font-weight:bold;margin:0 0 12px 0;">
          Notițe personale
        </h3>
        ${noteItems}`;
    }

    return `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1e1e3c;
                  margin:0;padding:0;width:700px;word-wrap:break-word;overflow-wrap:break-word;">
        <h1 style="font-size:25px;color:#1e1e3c;margin:0 0 8px 0;font-weight:bold;">
          Analiză Hermeneutică
        </h1>
        <h2 style="font-size:18px;color:#1e1e3c;margin:0 0 6px 0;font-weight:bold;">
          ${escapeHtml(result.reference)}
        </h2>
        <p style="font-size:12px;color:#888888;margin:0 0 16px 0;">Generat: ${date}</p>
        <hr style="border:none;border-top:1.5px solid #7878a0;margin:0 0 16px 0;"/>

        <h3 style="font-size:18px;color:#1e1e3c;font-weight:bold;margin:0 0 8px 0;">
          Pasaj Biblic
        </h3>
        <p style="font-size:15px;color:#3c3c5a;margin:0 0 20px 0;line-height:1.6;
                  font-style:italic;word-wrap:break-word;">
          ${escapeHtml(result.text)}
        </p>
        <hr style="border:none;border-top:1px solid #c0c0d0;margin:0 0 16px 0;"/>

        <h3 style="font-size:18px;color:#1e1e3c;font-weight:bold;margin:0 0 16px 0;">
          Analiza Hermeneutică
        </h3>
        ${cardsHtml}
        ${notesSection}
      </div>`;
  }
}
