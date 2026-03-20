import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AnalysisResult } from '../services/analysis.service';
import { NotesDialogComponent } from './notes-dialog.component';

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
  imports: [CardModule, ProgressSpinnerModule, SlicePipe, NotesDialogComponent],
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
              <p-card
                class="analysis-card {{ card.cssClass }}"
                [styleClass]="'analysis-card-inner'"
              >
                <ng-template pTemplate="header">
                  <div class="card-header-row">
                    <span class="card-icon">{{ card.icon }}</span>
                    <span class="card-title">{{ card.title }}</span>
                  </div>
                </ng-template>
                <p class="card-content-text">{{ result()!.cards[card.key] }}</p>
              </p-card>
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
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }

    .analysis-card {
      display: contents;
    }

    :host ::ng-deep .analysis-card-inner {
      background: var(--bg-card);
      color: var(--text-light);
      border-radius: 8px;
      border: 1px solid rgba(121, 134, 203, 0.15);

      .p-card-body { padding: 0; }
      .p-card-content { padding: 12px 16px 16px; }
    }

    :host ::ng-deep .card-hermeneutics .p-card {
      border-left: 4px solid #7986cb;
    }
    :host ::ng-deep .card-philosophy .p-card {
      border-left: 4px solid #4dd0e1;
    }
    :host ::ng-deep .card-patristics .p-card {
      border-left: 4px solid var(--gold);
    }
    :host ::ng-deep .card-philology .p-card {
      border-left: 4px solid #a5d6a7;
    }

    .card-header-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px 4px;
      border-bottom: 1px solid rgba(121, 134, 203, 0.1);
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
      white-space: pre-line;
      margin: 0;
    }
  `],
})
export class ResultsViewerComponent {
  readonly result = input<AnalysisResult | null>(null);
  readonly loading = input(false);

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
