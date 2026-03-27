import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AnalysisResult } from './analysis.service';
import { UserNote } from './notes.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Sends the analysis data to the backend, which renders a PDF via Puppeteer
   * and returns a binary response. The browser then triggers an automatic download.
   *
   * @param result  The analysis result returned by the backend.
   * @param notes   The current user's notes for the analysed verse (may be empty).
   */
  async exportAnalysis(result: AnalysisResult, notes: UserNote[]): Promise<void> {
    const payload = {
      reference: result.reference,
      language: result.language,
      text: result.text,
      cards: result.cards,
      timestamp: result.timestamp,
      notes: notes.map((n) => ({
        note_title: n.note_title,
        note_text: n.note_text,
        created_at: n.created_at,
      })),
    };

    const response = await firstValueFrom(
      this.http.post(`${this.apiUrl}/pdf/export`, payload, {
        responseType: 'blob',
        observe: 'response',
      }),
    );

    const blob = response.body!;
    // Use filename from Content-Disposition header (set by the backend) when available.
    const contentDisposition = response.headers.get('Content-Disposition') ?? '';
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch
      ? filenameMatch[1]
      : `analiza-${result.reference.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

