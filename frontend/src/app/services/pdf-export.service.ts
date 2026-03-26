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

/** Converts AI markdown card text to plain text suitable for PDF output. */
function stripMarkdown(text: string): string {
  return text
    // LLM output contains the literal two-character sequence "\n" (backslash + n) twice;
    // replace those with a real newline before further processing.
    .replace(/\\n\\n/g, '\n')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  /**
   * Generates and downloads a PDF with the full hermeneutical analysis for a
   * Scripture verse, including all analysis cards and the user's personal notes.
   *
   * @param result  The analysis result returned by the backend.
   * @param notes   The current user's notes for the analysed verse (may be empty).
   */
  exportAnalysis(result: AnalysisResult, notes: UserNote[]): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 20;
    const contentWidth = pageWidth - marginX * 2;
    let y = 20;

    /** Adds wrapped text and returns the new y position. */
    const addWrappedText = (
      text: string,
      fontSize: number,
      fontStyle: 'normal' | 'bold' = 'normal',
    ): void => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      const lineHeight = fontSize * 0.353 * 1.4;
      const lines: string[] = doc.splitTextToSize(text, contentWidth);
      for (const line of lines) {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, marginX, y);
        y += lineHeight;
      }
    };

    /** Draws a horizontal rule and advances y. */
    const addHRule = (thickness = 0.3): void => {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      doc.setDrawColor(120, 120, 160);
      doc.setLineWidth(thickness);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 4;
    };

    /** Advances y by a fixed gap. */
    const addGap = (mm = 4): void => {
      y += mm;
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
    };

    // ── 1. Document title ────────────────────────────────────────────────────
    doc.setTextColor(30, 30, 60);
    addWrappedText('Analiză Hermeneutică', 18, 'bold');
    addWrappedText(result.reference, 13, 'bold');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 140);
    const date = new Date(result.timestamp).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    if (y <= pageHeight - 20) {
      doc.text(`Generat: ${date}`, marginX, y);
      y += 5;
    }

    addGap(3);
    addHRule(0.5);

    // ── 2. Scripture verse ───────────────────────────────────────────────────
    doc.setTextColor(30, 30, 60);
    addWrappedText('Pasaj Biblic', 13, 'bold');
    addGap(2);

    doc.setTextColor(60, 60, 90);
    addWrappedText(result.text, 11);

    addGap(5);
    addHRule();

    // ── 3. Analysis cards ────────────────────────────────────────────────────
    doc.setTextColor(30, 30, 60);
    addWrappedText('Analiza Hermeneutică', 13, 'bold');
    addGap(3);

    for (const card of CARD_DEFS) {
      const cardText = result.cards[card.key];
      if (!cardText?.trim()) continue;

      doc.setTextColor(50, 50, 100);
      addWrappedText(card.title, 11, 'bold');
      addGap(2);

      doc.setTextColor(70, 70, 90);
      addWrappedText(stripMarkdown(cardText), 10);
      addGap(5);
    }

    // ── 4. User notes ────────────────────────────────────────────────────────
    if (notes.length > 0) {
      addHRule();
      doc.setTextColor(30, 30, 60);
      addWrappedText('Notițe personale', 13, 'bold');
      addGap(3);

      for (const note of notes) {
        const title = note.note_title?.trim()
          ? note.note_title.trim()
          : `Notiță din ${new Date(note.created_at).toLocaleDateString('ro-RO', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}`;

        doc.setTextColor(50, 50, 100);
        addWrappedText(title, 10, 'bold');
        addGap(1);

        doc.setTextColor(70, 70, 90);
        addWrappedText(note.note_text, 10);
        addGap(4);
      }
    }

    // ── Save ─────────────────────────────────────────────────────────────────
    const safeName = result.reference.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`analiza-${safeName}.pdf`);
  }
}
