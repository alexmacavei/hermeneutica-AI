import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { catchError, finalize, of } from 'rxjs';

import { BibleSelectorComponent, BibleNavigation } from './bible-selector.component';
import { BibleTextComponent } from './bible-text.component';
import { ResultsViewerComponent } from '../analysis/results-viewer.component';
import { SemanticSearchComponent, SearchNavigateEvent } from './semantic-search.component';
import { AnalysisService, AnalysisResult } from '../services/analysis.service';
import { BibleApiService, BibleVerse, ParallelTranslation } from '../services/bible-api.service';
import { SearchService } from '../services/search.service';
import { ParallelViewerComponent } from './parallel-viewer.component';
import { VerseSelection } from './verse-highlighter.directive';

@Component({
  selector: 'app-bible-viewer',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ToastModule,
    BibleSelectorComponent,
    BibleTextComponent,
    ResultsViewerComponent,
    SemanticSearchComponent,
    ParallelViewerComponent,
  ],
  providers: [MessageService],
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
          (navigate)="onNavigate($event)"
        ></app-bible-selector>
        <app-semantic-search
          [translationId]="currentNav?.translationId ?? ''"
          (navigateTo)="onSearchNavigate($event)"
        ></app-semantic-search>
      </header>

      <!-- Main Layout -->
      <main class="main-layout">
        <!-- Bible Text Panel -->
        <section class="bible-panel">
          <div class="loading-chapter" *ngIf="loadingChapter">
            <i class="pi pi-spin pi-spinner"></i> Se încarcă...
          </div>

          <app-bible-text
            *ngIf="!loadingChapter"
            [bookName]="currentNav?.bookName ?? ''"
            [chapterNumber]="currentNav?.chapter?.toString() ?? ''"
            [verses]="currentVerses"
            [selectedVerses]="selectedVerseNumbers"
            (verseSelected)="onVerseSelected($event)"
          ></app-bible-text>

          <!-- Footer navigation -->
          <footer class="verse-footer">
            <button
              pButton
              icon="pi pi-chevron-left"
              class="p-button-text p-button-rounded nav-btn"
              (click)="prevChapter()"
              [disabled]="!hasPrevChapter()"
            ></button>
            <span class="footer-ref" *ngIf="selectedSelection">
              &#128204; {{ selectedSelection.range }}
            </span>
            <span class="footer-ref no-selection" *ngIf="!selectedSelection">
              Selecteaz&#259; un verset pentru analiz&#259;
            </span>
            <button
              pButton
              icon="pi pi-chevron-right"
              class="p-button-text p-button-rounded nav-btn"
              (click)="nextChapter()"
              [disabled]="!hasNextChapter()"
            ></button>
          </footer>
        </section>

        <!-- Analysis Panel -->
        <aside class="analysis-panel" *ngIf="analysisResult || analyzing">
          <app-results-viewer
            [result]="analysisResult"
            [loading]="analyzing"
          ></app-results-viewer>
        </aside>

        <!-- Parallel Study Panel -->
        <aside class="parallel-panel" *ngIf="showParallelView">
          <app-parallel-viewer
            [translations]="parallelVerses"
            [loading]="loadingParallel"
            [reference]="selectedSelection?.range ?? ''"
            (close)="closeParallelView()"
          ></app-parallel-viewer>
        </aside>
      </main>

      <!-- Big Analyze Button -->
      <div class="analyze-bar">
        <button
          pButton
          label="&#127892; Analizeaz&#259; Selec&#539;ia"
          icon="pi pi-search"
          iconPos="left"
          class="analyze-btn"
          [class.analyze-btn-pulse]="!!selectedSelection && !analyzing"
          [disabled]="!selectedSelection || analyzing"
          [loading]="analyzing"
          (click)="analyze()"
        ></button>

        <button
          pButton
          label="Studiu Paralel"
          icon="pi pi-book"
          iconPos="left"
          class="parallel-btn"
          [class.parallel-btn-active]="showParallelView"
          [disabled]="!selectedSelection"
          [loading]="loadingParallel"
          (click)="toggleParallelView()"
        ></button>

        <span class="selection-preview" *ngIf="selectedSelection">
          "{{ selectedSelection.text | slice:0:60 }}{{ selectedSelection.text.length > 60 ? '…' : '' }}"
          — <em>{{ selectedSelection.range }}</em>
        </span>
      </div>
    </div>
  `,
  styles: [`
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
    .brand-cross { color: var(--gold); font-size: 1.8rem; }
    .brand-title {
      color: var(--text-light);
      font-size: 1.1rem;
      font-weight: 500;
      font-family: 'Palatino Linotype', serif;
    }
    .main-layout { flex: 1; display: flex; overflow: hidden; }
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
    .footer-ref { color: var(--text-muted); font-size: 0.85rem; }
    .no-selection { font-style: italic; opacity: 0.6; }
    .nav-btn { color: var(--text-muted) !important; }
    .analyze-bar {
      padding: 14px 24px;
      background: #0a0a1f;
      border-top: 2px solid rgba(198, 40, 40, 0.4);
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    :host ::ng-deep .analyze-btn.p-button {
      background: var(--cross-red);
      border-color: var(--cross-red);
      color: white;
      font-size: 1rem;
      font-weight: 600;
      padding: 10px 28px;
      border-radius: 24px;
      height: 46px;
    }
    :host ::ng-deep .analyze-btn.p-button:not(:disabled):hover {
      background: #b71c1c;
      border-color: #b71c1c;
    }
    :host ::ng-deep .analyze-btn.p-button:disabled {
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
      .main-layout { flex-direction: column; }
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
  `],
})
export class BibleViewerComponent {
  currentNav: BibleNavigation | null = null;
  currentVerses: BibleVerse[] = [];
  selectedVerseNumbers: string[] = [];
  selectedSelection: VerseSelection | null = null;

  analysisResult: AnalysisResult | null = null;
  analyzing = false;
  loadingChapter = false;

  showParallelView = false;
  parallelVerses: ParallelTranslation[] = [];
  loadingParallel = false;

  constructor(
    private readonly bibleApi: BibleApiService,
    private readonly analysisService: AnalysisService,
    private readonly searchService: SearchService,
    private readonly messageService: MessageService,
  ) {}

  onNavigate(nav: BibleNavigation): void {
    this.currentNav = nav;
    this.selectedSelection = null;
    this.selectedVerseNumbers = [];
    this.loadingChapter = true;

    this.bibleApi
      .getChapter(nav.translationId, nav.bookId, nav.chapter)
      .pipe(
        catchError(() => {
          this.messageService.add({
            severity: 'error',
            summary: 'Eroare',
            detail: 'Eroare la încărcarea capitolului.',
            life: 4000,
          });
          return of([] as BibleVerse[]);
        }),
        finalize(() => (this.loadingChapter = false)),
      )
      .subscribe((verses) => {
        this.currentVerses = verses;
        // Lazily ingest embeddings for this chapter in the background
        if (verses.length > 0) {
          this.searchService.ingestChapter(
            nav.translationId,
            nav.bookId,
            nav.bookName,
            nav.chapter,
            verses,
          );
        }
      });
  }

  /**
   * Handles navigation events from the semantic search component.
   * Loads books for the current translation to get numChapters, then navigates.
   */
  onSearchNavigate(event: SearchNavigateEvent): void {
    if (!this.currentNav) return;
    const { translationId, translationName } = this.currentNav;

    this.bibleApi.getBooks(translationId)
      .pipe(catchError(() => of([])))
      .subscribe((books) => {
        const book = books.find((b) => b.id === event.bookId);
        if (!book) return;
        const nav: BibleNavigation = {
          translationId,
          translationName,
          bookId: event.bookId,
          bookName: event.bookName,
          chapter: event.chapter,
          numChapters: book.numChapters,
        };
        this.onNavigate(nav);
        // Highlight the specific verse after the chapter loads
        this.selectedVerseNumbers = [String(event.verseNumber)];
      });
  }

  onVerseSelected(selection: VerseSelection): void {
    this.selectedSelection = selection;
    // Clear stale parallel data; if panel is already open, auto-fetch for the new verse
    this.parallelVerses = [];

    const match = /(\d+)(?:-(\d+))?$/.exec(selection.range);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : start;
      this.selectedVerseNumbers = Array.from(
        { length: end - start + 1 },
        (_, i) => String(start + i),
      );
    }

    if (this.showParallelView) {
      this.openParallelView();
    }
  }

  analyze(): void {
    if (!this.selectedSelection || this.analyzing || !this.currentNav) return;

    this.analyzing = true;
    this.analysisResult = null;

    this.analysisService
      .analyze({
        text: this.selectedSelection.text,
        range: this.selectedSelection.range,
        language: this.currentNav.translationName,
      })
      .pipe(
        catchError((err) => {
          console.error('Analysis error', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Eroare analiză',
            detail: 'Verificaţi conexiunea şi configurarea API.',
            life: 5000,
          });
          return of(null);
        }),
        finalize(() => (this.analyzing = false)),
      )
      .subscribe((result) => {
        if (result) this.analysisResult = result;
      });
  }

  toggleParallelView(): void {
    if (this.showParallelView) {
      this.closeParallelView();
      return;
    }
    this.openParallelView();
  }

  openParallelView(): void {
    if (!this.selectedSelection || !this.currentNav) return;

    this.showParallelView = true;
    this.loadingParallel = true;
    this.parallelVerses = [];

    const verseNums = this.selectedVerseNumbers
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n));
    const verseStart = verseNums.length > 0 ? Math.min(...verseNums) : 1;
    const verseEnd = verseNums.length > 0 ? Math.max(...verseNums) : verseStart;

    this.bibleApi
      .getParallelVerses(
        this.currentNav.bookId,
        this.currentNav.chapter,
        verseStart,
        verseEnd,
        this.currentNav.translationId,
      )
      .pipe(
        catchError(() => {
          this.messageService.add({
            severity: 'error',
            summary: 'Eroare',
            detail: 'Eroare la încărcarea traducerilor paralele.',
            life: 4000,
          });
          return of([] as ParallelTranslation[]);
        }),
        finalize(() => (this.loadingParallel = false)),
      )
      .subscribe((result) => {
        this.parallelVerses = result;
      });
  }

  closeParallelView(): void {
    this.showParallelView = false;
  }

  prevChapter(): void {
    if (!this.currentNav || !this.hasPrevChapter()) return;
    this.currentNav = { ...this.currentNav, chapter: this.currentNav.chapter - 1 };
    this.onNavigate(this.currentNav);
  }

  nextChapter(): void {
    if (!this.currentNav || !this.hasNextChapter()) return;
    this.currentNav = { ...this.currentNav, chapter: this.currentNav.chapter + 1 };
    this.onNavigate(this.currentNav);
  }

  hasPrevChapter(): boolean {
    return (this.currentNav?.chapter ?? 1) > 1;
  }

  hasNextChapter(): boolean {
    if (!this.currentNav) return false;
    return this.currentNav.chapter < this.currentNav.numChapters;
  }
}
