import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BehaviorSubject, catchError, finalize, of } from 'rxjs';

import { BibleSelectorComponent, BibleNavigation } from './bible-selector.component';
import { BibleTextComponent } from './bible-text.component';
import { ResultsViewerComponent } from '../analysis/results-viewer.component';
import { AnalysisService, AnalysisResult } from '../services/analysis.service';
import { VerseSelection } from './verse-highlighter.directive';

type BibleData = Record<string, Record<string, Record<string, Record<string, string>>>>;

@Component({
  selector: 'app-bible-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    BibleSelectorComponent,
    BibleTextComponent,
    ResultsViewerComponent,
  ],
  template: `
    <div class="viewer-shell">
      <!-- Navbar -->
      <header class="top-bar">
        <div class="brand">
          <span class="brand-cross">✝</span>
          <span class="brand-title">AI Hermeneutica Orthodoxa</span>
        </div>
        <app-bible-selector
          [bibleData]="bibleData"
          (navigate)="onNavigate($event)"
        ></app-bible-selector>
      </header>

      <!-- Main Layout -->
      <main class="main-layout" [class.with-results]="analysisResult || analyzing">
        <!-- Bible Text Panel (70%) -->
        <section class="bible-panel">
          <app-bible-text
            [bookName]="currentBook"
            [chapterNumber]="currentChapter"
            [verses]="currentVerses"
            [selectedVerses]="selectedVerseNumbers"
            (verseSelected)="onVerseSelected($event)"
          ></app-bible-text>

          <!-- Footer navigation -->
          <footer class="verse-footer">
            <button mat-icon-button (click)="prevChapter()" [disabled]="!hasPrevChapter()">
              <mat-icon>chevron_left</mat-icon>
            </button>
            <span class="footer-ref" *ngIf="selectedSelection">
              📌 {{ selectedSelection.range }}
            </span>
            <span class="footer-ref no-selection" *ngIf="!selectedSelection">
              Selectează un verset pentru analiză
            </span>
            <button mat-icon-button (click)="nextChapter()" [disabled]="!hasNextChapter()">
              <mat-icon>chevron_right</mat-icon>
            </button>
          </footer>
        </section>

        <!-- Analysis Panel (30%) -->
        <aside class="analysis-panel" *ngIf="analysisResult || analyzing">
          <app-results-viewer
            [result]="analysisResult"
            [loading]="analyzing"
          ></app-results-viewer>
        </aside>
      </main>

      <!-- Big Analyze Button -->
      <div class="analyze-bar">
        <button
          mat-raised-button
          class="analyze-btn"
          [class.analyze-btn-pulse]="!!selectedSelection && !analyzing"
          [disabled]="!selectedSelection || analyzing"
          (click)="analyze()"
        >
          <mat-icon>school</mat-icon>
          🎓 Analizează Selecția
        </button>

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

    /* Top Bar */
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

    /* Main Layout */
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
      max-height: calc(100vh - 180px);
    }

    .analysis-panel {
      width: 40%;
      min-width: 320px;
      border-left: 1px solid rgba(121, 134, 203, 0.2);
      overflow-y: auto;
      max-height: calc(100vh - 180px);
      background: rgba(10, 10, 30, 0.5);
    }

    /* Footer */
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

    /* Analyze Bar */
    .analyze-bar {
      padding: 16px 24px;
      background: #0a0a1f;
      border-top: 2px solid rgba(198, 40, 40, 0.4);
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .analyze-btn {
      background: var(--cross-red) !important;
      color: white !important;
      font-size: 1.1rem !important;
      padding: 0 28px !important;
      height: 48px !important;
      letter-spacing: 0.5px;
      font-weight: 600 !important;
      border-radius: 24px !important;
    }

    .analyze-btn:disabled {
      background: rgba(198, 40, 40, 0.3) !important;
      color: rgba(255,255,255,0.4) !important;
    }

    .selection-preview {
      color: var(--text-muted);
      font-style: italic;
      font-size: 0.9rem;
      flex: 1;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .main-layout { flex-direction: column; }
      .analysis-panel {
        width: 100%;
        border-left: none;
        border-top: 1px solid rgba(121, 134, 203, 0.2);
      }
    }
  `],
})
export class BibleViewerComponent implements OnInit {
  bibleData: BibleData = {};
  currentTestament = 'NT';
  currentBook = 'Matei';
  currentChapter = '5';
  currentLanguage = 'sinodala-ro';

  currentVerses: { number: string; text: string }[] = [];
  selectedVerseNumbers: string[] = [];
  selectedSelection: VerseSelection | null = null;

  analysisResult: AnalysisResult | null = null;
  analyzing = false;

  private readonly bibleDataSubject = new BehaviorSubject<BibleData>({});

  constructor(
    private readonly http: HttpClient,
    private readonly analysisService: AnalysisService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadBibleData('sinodala-ro');
  }

  private loadBibleData(language: string): void {
    this.http
      .get<BibleData>(`assets/bibles/${language}.json`)
      .pipe(
        catchError(() => {
          this.snackBar.open('Eroare la încărcarea Bibliei.', 'OK', { duration: 4000 });
          return of({} as BibleData);
        }),
      )
      .subscribe((data) => {
        this.bibleData = data;
        this.bibleDataSubject.next(data);
        this.loadChapter();
      });
  }

  onNavigate(nav: BibleNavigation): void {
    const languageChanged = nav.language !== this.currentLanguage;
    this.currentTestament = nav.testament;
    this.currentBook = nav.book;
    this.currentChapter = nav.chapter;
    this.currentLanguage = nav.language;

    if (languageChanged) {
      this.loadBibleData(nav.language);
    } else {
      this.loadChapter();
    }
  }

  private loadChapter(): void {
    const testament = this.bibleData[this.currentTestament];
    const book = testament?.[this.currentBook];
    const chapter = book?.[this.currentChapter];

    if (chapter) {
      this.currentVerses = Object.entries(chapter).map(([num, text]) => ({
        number: num,
        text,
      }));
    } else {
      this.currentVerses = [];
    }
    this.selectedVerseNumbers = [];
    this.selectedSelection = null;
  }

  onVerseSelected(selection: VerseSelection): void {
    this.selectedSelection = selection;

    // Extract verse numbers from range like "Matei 5:3" or "Matei 5:3-7"
    const match = /(\d+)(?:-(\d+))?$/.exec(selection.range);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : start;
      this.selectedVerseNumbers = Array.from(
        { length: end - start + 1 },
        (_, i) => String(start + i),
      );
    }
  }

  analyze(): void {
    if (!this.selectedSelection || this.analyzing) return;

    this.analyzing = true;
    this.analysisResult = null;

    const languageLabel = this.getLanguageLabel(this.currentLanguage);

    this.analysisService
      .analyze({
        text: this.selectedSelection.text,
        range: this.selectedSelection.range,
        language: languageLabel,
      })
      .pipe(
        catchError((err) => {
          console.error('Analysis error', err);
          this.snackBar.open(
            'Eroare la analiză. Verificați conexiunea și configurarea API.',
            'OK',
            { duration: 5000 },
          );
          return of(null);
        }),
        finalize(() => {
          this.analyzing = false;
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.analysisResult = result;
        }
      });
  }

  prevChapter(): void {
    const chapters = this.getChapterList();
    const idx = chapters.indexOf(this.currentChapter);
    if (idx > 0) {
      this.currentChapter = chapters[idx - 1];
      this.loadChapter();
    }
  }

  nextChapter(): void {
    const chapters = this.getChapterList();
    const idx = chapters.indexOf(this.currentChapter);
    if (idx < chapters.length - 1) {
      this.currentChapter = chapters[idx + 1];
      this.loadChapter();
    }
  }

  hasPrevChapter(): boolean {
    const chapters = this.getChapterList();
    return chapters.indexOf(this.currentChapter) > 0;
  }

  hasNextChapter(): boolean {
    const chapters = this.getChapterList();
    const idx = chapters.indexOf(this.currentChapter);
    return idx >= 0 && idx < chapters.length - 1;
  }

  private getChapterList(): string[] {
    const book = this.bibleData[this.currentTestament]?.[this.currentBook];
    return book ? Object.keys(book) : [];
  }

  private getLanguageLabel(lang: string): string {
    const labels: Record<string, string> = {
      'sinodala-ro': 'Sinodală Română',
      'greaca-nt': 'Greacă (NT)',
    };
    return labels[lang] ?? lang;
  }
}
