import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer-core';

interface HermeneuticaCards {
  hermeneutics: string;
  philosophy: string;
  patristics: string;
  philology: string;
}

export interface ExportPdfDto {
  reference: string;
  language: string;
  text: string;
  cards: HermeneuticaCards;
  timestamp: string;
  notes: Array<{
    note_title?: string;
    note_text: string;
    created_at: string;
  }>;
}

interface CardDef {
  key: keyof HermeneuticaCards;
  title: string;
}

const CARD_DEFS: CardDef[] = [
  { key: 'hermeneutics', title: 'Principii Hermeneutice' },
  { key: 'philosophy', title: 'Influențe Filozofice' },
  { key: 'patristics', title: 'Comentarii Patristice' },
  { key: 'philology', title: 'Analiză Filologică' },
];

/** Escapes special HTML characters to prevent injection. */
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
 * - Replaces LLM literal \\n escape sequences with real newlines
 * - Converts **bold** markers to <strong> tags
 * - Converts newlines to <br>
 */
function markdownToHtml(text: string): string {
  if (!text) return '';
  return escapeHtml(text)
    .replace(/\\n\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Returns the path to the Chromium/Chrome binary to use.
   *
   * Resolution order:
   *  1. `PUPPETEER_EXECUTABLE_PATH` environment variable (explicit override).
   *  2. Well-known system paths for Alpine/Debian Linux, macOS, and Windows.
   *
   * Set `PUPPETEER_EXECUTABLE_PATH` in your `.env` file for local development
   * when Chrome/Chromium is installed in a non-standard location.
   */
  private getChromiumExecutablePath(): string | undefined {
    // 1. Honour explicit env var override (standard Puppeteer convention).
    const envPath = process.env['PUPPETEER_EXECUTABLE_PATH'];
    if (envPath?.trim()) return envPath.trim();

    // 2. Well-known paths for common OS / package installations.
    const candidates = [
      // Alpine Linux (used in the Docker image)
      '/usr/bin/chromium-browser',
      // Debian/Ubuntu
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      // macOS – Google Chrome
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      // macOS – Chromium
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      // Windows – Google Chrome (typical paths)
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const fs = require('fs') as typeof import('fs');
    return candidates.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
  }

  async generatePdf(data: ExportPdfDto): Promise<Buffer> {
    const executablePath = this.getChromiumExecutablePath();
    if (!executablePath) {
      throw new Error(
        'Chromium executable not found. ' +
          'Set PUPPETEER_EXECUTABLE_PATH in your .env file to the path of your ' +
          'Chrome or Chromium binary. ' +
          'See docs/pdf-export.md for setup instructions.',
      );
    }

    let browser: Browser | undefined;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
        ],
      });

      const page = await browser.newPage();
      const html = this.buildHtml(data);
      // The HTML template is self-contained (no external resources), so
      // 'domcontentloaded' is sufficient and avoids the 30 s networkidle0 timeout.
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser?.close();
    }
  }

  private buildHtml(data: ExportPdfDto): string {
    const date = new Date(data.timestamp).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const cardsHtml = CARD_DEFS.filter((c) => data.cards[c.key]?.trim())
      .map(
        (c) => `
        <div class="card-section">
          <h4 class="card-title">${escapeHtml(c.title)}</h4>
          <p class="card-text">${markdownToHtml(data.cards[c.key])}</p>
        </div>`,
      )
      .join('');

    let notesSection = '';
    if (data.notes.length > 0) {
      const noteItems = data.notes
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
  <title>Analiză Hermeneutică – ${escapeHtml(data.reference)}</title>
  <style>
    @page { size: A4; margin: 0; } /* Puppeteer page.pdf() margin option controls page margins */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1e1e3c;
      word-wrap: break-word;
      overflow-wrap: break-word;
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
  </style>
</head>
<body>
  <h1>Analiză Hermeneutică</h1>
  <h2>${escapeHtml(data.reference)}</h2>
  <p class="meta">Generat: ${date}</p>
  <hr class="header-rule">

  <h3 class="section-title">Pasaj Biblic</h3>
  <p class="verse-text">${escapeHtml(data.text)}</p>
  <hr class="section-rule">

  <h3 class="section-title">Analiza Hermeneutică</h3>
  ${cardsHtml}
  ${notesSection}
</body>
</html>`;
  }
}
