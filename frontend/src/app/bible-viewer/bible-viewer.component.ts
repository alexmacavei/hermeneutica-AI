import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { BibleStore } from './bible.store';
import { BibleSelectorComponent } from './bible-selector.component';
import { BibleTextComponent } from './bible-text.component';
import { ResultsViewerComponent } from '../analysis/results-viewer.component';
import { SemanticSearchComponent } from './semantic-search.component';
import { ParallelViewerComponent } from './parallel-viewer.component';
import { SlicePipe } from '@angular/common';

@Component({
  selector: 'app-bible-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    ToastModule,
    BibleSelectorComponent,
    BibleTextComponent,
    ResultsViewerComponent,
    SemanticSearchComponent,
    ParallelViewerComponent,
    SlicePipe,
  ],
  providers: [BibleStore, MessageService],
  template: `
    <p-toast position="top-right"></p-toast>

    <div class="viewer-shell">
      <!-- Navbar -->
      <header class="top-bar">
        <div class="brand">
          <span class="brand-cross">&#10013;</span>
          <span class="brand-title">AI Hermeneutica Orthodoxa</span>
        </div>
        <app-bible-selector
          (navigate)="store.navigate($event)"
        ></app-bible-selector>
        <app-semantic-search
          [translationId]="store.currentNav()?.translationId ?? ''"
          (navigateTo)="store.navigateFromSearch($event)"
        ></app-semantic-search>
      </header>

      <!-- Main Layout -->
      <main class="main-layout">
        <!-- Bible Text Panel -->
        <section class="bible-panel">
          @if (store.loadingChapter()) {
            <div class="loading-chapter">
              <i class="pi pi-spin pi-spinner"></i> Se încarcă...
            </div>
          }

          @if (!store.loadingChapter()) {
            <app-bible-text
              [bookName]="store.currentNav()?.bookName ?? ''"
              [chapterNumber]="store.currentNav()?.chapter?.toString() ?? ''"
              [verses]="store.currentVerses()"
              [selectedVerses]="store.selectedVerseNumbers()"
              (verseSelected)="store.selectVerse($event)"
            ></app-bible-text>
          }

          <!-- Footer navigation -->
          <footer class="verse-footer">
            <p-button
              icon="pi pi-chevron-left"
              variant="text"
              class="nav-btn"
              (click)="store.prevChapter()"
              [disabled]="!store.hasPrevChapter()"
              [rounded]="true"
            ></p-button>
            @if (store.selectedSelection()) {
              <span class="footer-ref">
                &#128204; {{ store.selectedSelection()!.range }}
              </span>
            } @else {
              <span class="footer-ref no-selection">
                Selectează un verset pentru analiză
              </span>
            }
            <p-button
              icon="pi pi-chevron-right"
              variant="text"
              class="nav-btn"
              (click)="store.nextChapter()"
              [disabled]="!store.hasNextChapter()"
              [rounded]="true"
            ></p-button>
          </footer>
        </section>

        <!-- Analysis Panel -->
        @if (store.analysisResult() || store.analyzing()) {
          <aside class="analysis-panel">
            <app-results-viewer
              [result]="store.analysisResult()"
              [loading]="store.analyzing()"
            ></app-results-viewer>
          </aside>
        }

        <!-- Parallel Study Panel -->
        @if (store.showParallelView()) {
          <aside class="parallel-panel">
            <app-parallel-viewer
              [translations]="store.parallelVerses()"
              [loading]="store.loadingParallel()"
              [reference]="store.selectedSelection()?.range ?? ''"
              (close)="store.closeParallelView()"
            ></app-parallel-viewer>
          </aside>
        }
      </main>

      <!-- Big Analyze Button -->
      <div class="analyze-bar">
        <p-button
          class="analyze-btn"
          [class.analyze-btn-pulse]="!!store.selectedSelection() && !store.analyzing()"
          [disabled]="!store.selectedSelection() || store.analyzing()"
          [loading]="store.analyzing()"
          (click)="store.analyze()"
          icon="pi pi-search"
          label="Analizează selecția"
        >
        </p-button>

        <p-button
          label="Studiu Paralel"
          icon="pi pi-book"
          iconPos="left"
          class="parallel-btn"
          [class.parallel-btn-active]="store.showParallelView()"
          [disabled]="!store.selectedSelection()"
          [loading]="store.loadingParallel()"
          (click)="store.toggleParallelView()"
        ></p-button>

        @if (store.selectedSelection()) {
          <span class="selection-preview">
            "{{ store.selectedSelection()!.text | slice: 0 : 60
            }}{{ store.selectedSelection()!.text.length > 60 ? '…' : '' }}" —
            <em>{{ store.selectedSelection()!.range }}</em>
          </span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .viewer-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--bg-dark);
      }
      .top-bar {
        background: #0a0a1f;
        border-bottom: 2px solid rgba(26, 35, 126, 0.6);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }
      .brand {
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 10px;
        white-space: nowrap;
      }
      .brand-cross {
        color: var(--gold);
        font-size: 1.8rem;
      }
      .brand-title {
        color: var(--text-light);
        font-size: 1.1rem;
        font-weight: 500;
        font-family: 'Palatino Linotype', serif;
      }
      .main-layout {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      .bible-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        max-height: calc(100vh - 160px);
      }
      .analysis-panel {
        width: 40%;
        min-width: 320px;
        border-left: 1px solid rgba(121, 134, 203, 0.2);
        overflow-y: auto;
        max-height: calc(100vh - 160px);
        background: rgba(10, 10, 30, 0.5);
      }
      .parallel-panel {
        width: 40%;
        min-width: 320px;
        border-left: 1px solid rgba(121, 134, 203, 0.2);
        overflow-y: auto;
        max-height: calc(100vh - 160px);
        background: rgba(10, 10, 30, 0.5);
      }
      .loading-chapter {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 60px;
        color: var(--text-muted);
        font-size: 1rem;
      }
      .verse-footer {
        padding: 10px 24px;
        background: #0a0a1f;
        border-top: 1px solid rgba(26, 35, 126, 0.4);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .footer-ref {
        color: var(--text-muted);
        font-size: 0.85rem;
      }
      .no-selection {
        font-style: italic;
        opacity: 0.6;
      }
      :host ::ng-deep .nav-btn .p-button {
        color: var(--text-muted) !important;
      }
      .analyze-bar {
        padding: 14px 24px;
        background: #0a0a1f;
        border-top: 2px solid rgba(198, 40, 40, 0.4);
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
      }
      :host ::ng-deep .analyze-btn .p-button {
        background: var(--cross-red);
        border-color: var(--cross-red);
        color: white;
        font-size: 1rem;
        font-weight: 600;
        padding: 10px 28px;
        border-radius: 24px;
        height: 46px;
      }
      :host ::ng-deep .analyze-btn .p-button:not(:disabled):hover {
        background: #b71c1c;
        border-color: #b71c1c;
      }
      :host ::ng-deep .analyze-btn .p-button:disabled {
        background: rgba(198, 40, 40, 0.3);
        border-color: rgba(198, 40, 40, 0.3);
        color: rgba(255, 255, 255, 0.4);
      }
      :host ::ng-deep .parallel-btn.p-button {
        background: rgba(26, 35, 126, 0.5);
        border-color: rgba(121, 134, 203, 0.5);
        color: #9fa8da;
        font-size: 1rem;
        font-weight: 600;
        padding: 10px 22px;
        border-radius: 24px;
        height: 46px;
      }
      :host ::ng-deep .parallel-btn.p-button:not(:disabled):hover {
        background: rgba(26, 35, 126, 0.7);
        border-color: rgba(121, 134, 203, 0.8);
        color: #c5cae9;
      }
      :host ::ng-deep .parallel-btn.parallel-btn-active.p-button {
        background: rgba(26, 35, 126, 0.8);
        border-color: #7986cb;
        color: #e8eaf6;
      }
      :host ::ng-deep .parallel-btn.p-button:disabled {
        background: rgba(26, 35, 126, 0.2);
        border-color: rgba(121, 134, 203, 0.2);
        color: rgba(159, 168, 218, 0.4);
      }
      .selection-preview {
        color: var(--text-muted);
        font-style: italic;
        font-size: 0.9rem;
        flex: 1;
      }
      @media (max-width: 768px) {
        .main-layout {
          flex-direction: column;
        }
        .analysis-panel {
          width: 100%;
          border-left: none;
          border-top: 1px solid rgba(121, 134, 203, 0.2);
        }
        .parallel-panel {
          width: 100%;
          border-left: none;
          border-top: 1px solid rgba(121, 134, 203, 0.2);
        }
      }
    `,
  ],
})
export class BibleViewerComponent {
  protected readonly store = inject(BibleStore);
}
