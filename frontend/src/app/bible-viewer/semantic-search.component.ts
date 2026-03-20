import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { EMPTY, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchService, SearchResult } from '../services/search.service';

export interface SearchNavigateEvent {
  bookId: string;
  bookName: string;
  chapter: number;
  verseNumber: number;
}

@Component({
  selector: 'app-semantic-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonModule, SlicePipe],
  template: `
    <div class="search-wrapper">
      <div class="search-input-row">
        <span class="search-icon pi pi-search"></span>
        <input
          class="search-input"
          type="text"
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
          placeholder="Căutare semantică (ex: iubire, pocăință...)"
          [disabled]="!translationId()"
          (keydown.enter)="search()"
        />
        @if (query()) {
          <p-button
            icon="pi pi-times"
            variant="text"
            class="clear-btn"
            (click)="clearSearch()"
            [rounded]="true"
          ></p-button>
        }
      </div>

      <!-- Results panel -->
      @if (results().length > 0 || (searched() && results().length === 0)) {
        <div class="search-results">
          @if (searched() && results().length === 0 && !loading()) {
            <div class="results-empty">
              <i class="pi pi-info-circle"></i>
              Niciun rezultat. Parcurgeți mai multe capitole pentru a construi indexul semantic.
            </div>
          }

          @if (loading()) {
            <div class="results-loading">
              <i class="pi pi-spin pi-spinner"></i> Se caută...
            </div>
          }

          @if (results().length > 0 && !loading()) {
            <ul class="results-list">
              @for (r of results(); track r.reference) {
                <li
                  class="result-item"
                  (click)="onResultClick(r)"
                  [title]="r.reference"
                >
                  <span class="result-ref">{{ r.reference }}</span>
                  <span class="result-text">{{ r.verseText | slice:0:90 }}{{ r.verseText.length > 90 ? '…' : '' }}</span>
                  <span class="result-score" title="Relevanță semantică">
                    {{ (r.similarity * 100).toFixed(0) }}%
                  </span>
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .search-wrapper {
      position: relative;
      flex: 1;
      min-width: 220px;
      max-width: 420px;
    }
    .search-input-row {
      display: flex;
      align-items: center;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(121, 134, 203, 0.35);
      border-radius: 22px;
      padding: 0 12px;
      height: 38px;
      gap: 6px;
      transition: border-color 0.2s;
    }
    .search-input-row:focus-within {
      border-color: var(--gold);
    }
    .search-icon {
      color: var(--gold);
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    .search-input {
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-light);
      font-size: 0.85rem;
      width: 100%;
    }
    .search-input::placeholder { color: var(--text-muted); }
    .search-input:disabled { opacity: 0.4; cursor: not-allowed; }
    :host ::ng-deep .clear-btn .p-button {
      width: 24px !important;
      height: 24px !important;
      padding: 0 !important;
      color: var(--text-muted) !important;
      flex-shrink: 0;
    }
    .search-results {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: #0d0d2e;
      border: 1px solid rgba(121, 134, 203, 0.3);
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      z-index: 1000;
      max-height: 360px;
      overflow-y: auto;
    }
    .results-empty, .results-loading {
      padding: 14px 16px;
      color: var(--text-muted);
      font-size: 0.82rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .results-list {
      list-style: none;
      margin: 0;
      padding: 6px 0;
    }
    .result-item {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: baseline;
      gap: 8px;
      padding: 9px 14px;
      cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.15s;
    }
    .result-item:last-child { border-bottom: none; }
    .result-item:hover { background: rgba(198, 40, 40, 0.12); }
    .result-ref {
      color: var(--gold);
      font-size: 0.78rem;
      font-weight: 600;
      white-space: nowrap;
      min-width: 80px;
    }
    .result-text {
      color: var(--text-light);
      font-size: 0.8rem;
      line-height: 1.4;
    }
    .result-score {
      color: var(--text-muted);
      font-size: 0.72rem;
      white-space: nowrap;
    }
  `],
})
export class SemanticSearchComponent {
  /** The currently selected translation ID – search is scoped to this. */
  readonly translationId = input('');

  /** Emitted when the user clicks a result to navigate to that verse. */
  readonly navigateTo = output<SearchNavigateEvent>();

  protected readonly query = signal('');
  protected readonly results = signal<SearchResult[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);

  private readonly querySubject = new Subject<string>();
  private readonly searchService = inject(SearchService);

  constructor() {
    // Clear search when the translation changes
    effect(() => {
      this.translationId(); // tracked dependency
      this.clearSearch();
    });

    // Debounced search pipeline
    this.querySubject
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q.trim() || !this.translationId()) {
            this.results.set([]);
            this.searched.set(false);
            this.loading.set(false);
            return EMPTY;
          }
          this.loading.set(true);
          return this.searchService.searchVerses(q.trim(), this.translationId());
        }),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        this.loading.set(false);
        this.results.set(response.results);
        this.searched.set(true);
      });
  }

  protected onQueryChange(q: string): void {
    this.query.set(q);
    this.querySubject.next(q);
  }

  protected search(): void {
    if (this.query().trim()) {
      this.querySubject.next(this.query());
    }
  }

  protected clearSearch(): void {
    this.query.set('');
    this.results.set([]);
    this.searched.set(false);
    this.loading.set(false);
  }

  protected onResultClick(result: SearchResult): void {
    this.navigateTo.emit({
      bookId: result.bookId,
      bookName: result.bookName,
      chapter: result.chapter,
      verseNumber: result.verseNumber,
    });
    this.clearSearch();
  }
}
