import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AnalysisResult } from '../services/analysis.service';

interface AnalysisCard {
  key: keyof AnalysisResult['cards'];
  title: string;
  icon: string;
  cssClass: string;
}

@Component({
  selector: 'app-results-viewer',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressSpinnerModule],
  template: `
    <div class="results-section" *ngIf="result || loading">
      <!-- Header -->
      <div class="results-header" *ngIf="result">
        <span class="material-icons reference-icon">book</span>
        <div class="reference-info">
          <h3 class="reference-title">{{ result.reference }}</h3>
          <p class="reference-text">{{ result.text | slice:0:120 }}{{ result.text.length > 120 ? '...' : '' }}</p>
        </div>
        <span class="language-badge">{{ result.language }}</span>
      </div>

      <!-- Loading spinner -->
      <div class="loading-state" *ngIf="loading">
        <mat-progress-spinner mode="indeterminate" diameter="60" color="accent"></mat-progress-spinner>
        <p>Analiza hermeneutică în curs… 🎓</p>
      </div>

      <!-- 4 Cards Grid -->
      <div class="cards-grid" *ngIf="result && !loading">
        <mat-card
          *ngFor="let card of cardDefs"
          class="analysis-card {{ card.cssClass }}"
        >
          <mat-card-header>
            <mat-card-title>
              <span class="card-icon">{{ card.icon }}</span>
              {{ card.title }}
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="card-content-text">{{ result.cards[card.key] }}</p>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .results-section {
      padding: 24px;
    }

    .results-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
      padding: 16px;
      background: rgba(26, 35, 126, 0.4);
      border-radius: 8px;
      border: 1px solid rgba(121, 134, 203, 0.3);
    }

    .reference-icon {
      font-size: 2rem;
      color: var(--gold);
      margin-top: 4px;
    }

    .reference-info {
      flex: 1;
    }

    .reference-title {
      color: var(--gold);
      margin: 0 0 4px;
      font-size: 1.2rem;
    }

    .reference-text {
      color: var(--text-muted);
      margin: 0;
      font-style: italic;
      font-size: 0.9rem;
    }

    .language-badge {
      background: rgba(26, 35, 126, 0.8);
      color: var(--text-muted);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      border: 1px solid rgba(121, 134, 203, 0.4);
      white-space: nowrap;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 40px;
      color: var(--text-muted);
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }

    .analysis-card {
      background: var(--bg-card) !important;
      color: var(--text-light) !important;
      border-radius: 8px !important;
    }

    :host ::ng-deep .analysis-card {
      .mat-mdc-card-header {
        padding: 16px 16px 8px;
      }
      .mat-mdc-card-title {
        color: var(--text-light);
        font-size: 1rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mat-mdc-card-content {
        padding: 8px 16px 16px;
      }
    }

    .card-icon {
      font-size: 1.3rem;
    }

    .card-content-text {
      color: #b0bec5;
      line-height: 1.7;
      font-size: 0.9rem;
      white-space: pre-line;
      margin: 0;
    }

    .card-hermeneutics { border-left: 4px solid #7986cb; }
    .card-philosophy   { border-left: 4px solid #4dd0e1; }
    .card-patristics   { border-left: 4px solid var(--gold); }
    .card-philology    { border-left: 4px solid #a5d6a7; }
  `],
})
export class ResultsViewerComponent {
  @Input() result: AnalysisResult | null = null;
  @Input() loading = false;

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
