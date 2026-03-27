import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { catchError, from, of, switchMap } from 'rxjs';
import { AnalysisResult } from '../services/analysis.service';
import { NotesService } from '../services/notes.service';
import { AuthService } from '../services/auth.service';
import { PdfExportService } from '../services/pdf-export.service';
import { NotesDialogComponent } from './notes-dialog.component';
import { FormatCardPipe } from './format-card.pipe';

interface AnalysisCard {
  key: keyof AnalysisResult['cards'];
  title: string;
  icon: string;
  cssClass: string;
}

@Component({
  selector: 'app-results-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressSpinnerModule, SlicePipe, ButtonModule, TooltipModule, NotesDialogComponent, FormatCardPipe],
  template: `
    @if (result() || loading()) {
      <div class="results-section">
        <!-- Header -->
        @if (result()) {
          <div class="results-header">
            <i class="pi pi-book reference-icon"></i>
            <div class="reference-info">
              <h3 class="reference-title">{{ result()!.reference }}</h3>
              <p class="reference-text">{{ result()!.text | slice:0:120 }}{{ result()!.text.length > 120 ? '...' : '' }}</p>
            </div>
            <span class="language-badge">{{ result()!.language }}</span>
            <app-notes-dialog [verseReference]="result()!.reference"></app-notes-dialog>
            <p-button
              icon="pi pi-file-pdf"
              severity="secondary"
              [rounded]="true"
              [text]="true"
              pTooltip="Exportă analiza în PDF"
              tooltipPosition="left"
              (click)="exportPdf()"
              [loading]="exportingPdf()"
              styleClass="export-pdf-btn"
            ></p-button>
          </div>
        }

        <!-- Loading spinner -->
        @if (loading()) {
          <div class="loading-state">
            <p-progressSpinner strokeWidth="4" animationDuration=".8s"></p-progressSpinner>
            <p>Analiza hermeneutică în curs… 🎓</p>
          </div>
        }

        <!-- 4 Cards Grid -->
        @if (result() && !loading()) {
          <div class="cards-grid">
            @for (card of cardDefs; track card.key) {
              <div class="analysis-card {{ card.cssClass }}">
                <div class="card-header-row">
                  <span class="card-icon">{{ card.icon }}</span>
                  <span class="card-title">{{ card.title }}</span>
                </div>
                <p class="card-content-text" [innerHTML]="result()!.cards[card.key] | formatCard"></p>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .results-section {
      padding: 20px;
    }

    .results-header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 20px;
      padding: 14px;
      background: rgba(26, 35, 126, 0.4);
      border-radius: 8px;
      border: 1px solid rgba(121, 134, 203, 0.3);
    }

    .reference-icon {
      font-size: 1.8rem;
      color: var(--gold);
      margin-top: 4px;
    }

    .reference-info {
      flex: 1;
    }

    .reference-title {
      color: var(--gold);
      margin: 0 0 4px;
      font-size: 1.1rem;
    }

    .reference-text {
      color: var(--text-muted);
      margin: 0;
      font-style: italic;
      font-size: 0.85rem;
    }

    .language-badge {
      background: rgba(26, 35, 126, 0.8);
      color: var(--text-muted);
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      border: 1px solid rgba(121, 134, 203, 0.4);
      white-space: nowrap;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 40px;
      color: var(--text-muted);
    }

    .cards-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .analysis-card {
      background: var(--bg-card);
      color: var(--text-light);
      border-radius: 8px;
      border: 1px solid rgba(121, 134, 203, 0.15);
      overflow: hidden;
    }

    .analysis-card.card-hermeneutics { border-left: 4px solid #7986cb; }
    .analysis-card.card-philosophy   { border-left: 4px solid #4dd0e1; }
    .analysis-card.card-patristics   { border-left: 4px solid var(--gold); }
    .analysis-card.card-philology    { border-left: 4px solid #a5d6a7; }

    .card-header-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px 10px;
      border-bottom: 1px solid rgba(121, 134, 203, 0.12);
      background: rgba(26, 35, 126, 0.15);
    }

    .card-icon {
      font-size: 1.2rem;
    }

    .card-title {
      color: var(--text-light);
      font-weight: 600;
      font-size: 0.95rem;
    }

    .card-content-text {
      color: #b0bec5;
      line-height: 1.7;
      font-size: 0.88rem;
      margin: 0;
      padding: 14px 16px 16px;
    }

    @media (max-width: 480px) {
      .results-section {
        padding: 14px;
      }
      .results-header {
        flex-wrap: wrap;
        gap: 10px;
      }
      .language-badge {
        order: -1;
        align-self: flex-start;
      }
    }
  `],
})
export class ResultsViewerComponent {
  readonly result = input<AnalysisResult | null>(null);
  readonly loading = input(false);

  private readonly notesService = inject(NotesService);
  private readonly authService = inject(AuthService);
  private readonly pdfExportService = inject(PdfExportService);
  private readonly messageService = inject(MessageService);

  readonly exportingPdf = signal(false);

  exportPdf(): void {
    const currentResult = this.result();
    if (!currentResult) return;

    if (!this.authService.isLoggedIn()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Autentificare necesară',
        detail: 'Trebuie să fii autentificat pentru a exporta analiza în PDF.',
        life: 4000,
      });
      return;
    }

    this.exportingPdf.set(true);
    this.notesService
      .getNotesForVerse(currentResult.reference)
      .pipe(
        catchError(() => of([])),
        switchMap((notes) =>
          from(this.pdfExportService.exportAnalysis(currentResult, notes)),
        ),
        catchError(() => {
          this.messageService.add({
            severity: 'error',
            summary: 'Eroare',
            detail: 'PDF-ul nu a putut fi generat.',
            life: 3000,
          });
          return of(undefined);
        }),
      )
      .subscribe(() => this.exportingPdf.set(false));
  }

  readonly cardDefs: AnalysisCard[] = [
    {
      key: 'hermeneutics',
      title: 'Principii Hermeneutice',
      icon: '📖',
      cssClass: 'card-hermeneutics',
    },
    {
      key: 'philosophy',
      title: 'Influențe Filozofice',
      icon: '🧠',
      cssClass: 'card-philosophy',
    },
    {
      key: 'patristics',
      title: 'Comentarii Patristice',
      icon: '⛪',
      cssClass: 'card-patristics',
    },
    {
      key: 'philology',
      title: 'Analiză Filologică',
      icon: '🔤',
      cssClass: 'card-philology',
    },
  ];
}
