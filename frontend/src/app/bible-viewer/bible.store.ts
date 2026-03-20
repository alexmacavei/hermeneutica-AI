import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { MessageService } from 'primeng/api';
import { catchError, filter, of, pipe, switchMap, tap } from 'rxjs';

import { AnalysisResult, AnalysisService } from '../services/analysis.service';
import { BibleApiService, BibleVerse, ParallelTranslation } from '../services/bible-api.service';
import { SearchService } from '../services/search.service';
import { BibleNavigation } from './bible-selector.component';
import { SearchNavigateEvent } from './semantic-search.component';
import { VerseSelection } from './verse-highlighter.directive';

interface BibleState {
  currentNav: BibleNavigation | null;
  currentVerses: BibleVerse[];
  selectedVerseNumbers: string[];
  selectedSelection: VerseSelection | null;
  analysisResult: AnalysisResult | null;
  analyzing: boolean;
  loadingChapter: boolean;
  showParallelView: boolean;
  parallelVerses: ParallelTranslation[];
  loadingParallel: boolean;
}

const initialState: BibleState = {
  currentNav: null,
  currentVerses: [],
  selectedVerseNumbers: [],
  selectedSelection: null,
  analysisResult: null,
  analyzing: false,
  loadingChapter: false,
  showParallelView: false,
  parallelVerses: [],
  loadingParallel: false,
};

export const BibleStore = signalStore(
  withState(initialState),

  withComputed(({ currentNav }) => ({
    hasPrevChapter: computed(() => (currentNav()?.chapter ?? 1) > 1),
    hasNextChapter: computed(() => {
      const nav = currentNav();
      return nav ? nav.chapter < nav.numChapters : false;
    }),
  })),

  withMethods((store) => {
    const bibleApi = inject(BibleApiService);
    const analysisService = inject(AnalysisService);
    const searchService = inject(SearchService);
    const messageService = inject(MessageService);

    // ── Private rxMethods ────────────────────────────────────────────────

    const loadChapter = rxMethod<BibleNavigation>(
      pipe(
        tap((nav) =>
          patchState(store, {
            currentNav: nav,
            loadingChapter: true,
            selectedSelection: null,
            selectedVerseNumbers: [],
          }),
        ),
        switchMap((nav) =>
          bibleApi.getChapter(nav.translationId, nav.bookId, nav.chapter).pipe(
            catchError(() => {
              messageService.add({
                severity: 'error',
                summary: 'Eroare',
                detail: 'Eroare la încărcarea capitolului.',
                life: 4000,
              });
              return of([] as BibleVerse[]);
            }),
            tap((verses) => {
              patchState(store, { currentVerses: verses, loadingChapter: false });
              if (verses.length > 0) {
                searchService.ingestChapter(
                  nav.translationId,
                  nav.bookId,
                  nav.bookName,
                  nav.chapter,
                  verses,
                );
              }
            }),
          ),
        ),
      ),
    );

    const runAnalysis = rxMethod<void>(
      pipe(
        filter(() => !!store.selectedSelection() && !store.analyzing() && !!store.currentNav()),
        tap(() => patchState(store, { analyzing: true, analysisResult: null })),
        switchMap(() => {
          const selection = store.selectedSelection()!;
          const nav = store.currentNav()!;
          return analysisService
            .analyze({
              text: selection.text,
              range: selection.range,
              language: nav.translationName,
              translationId: nav.translationId,
            })
            .pipe(
              catchError(() => {
                messageService.add({
                  severity: 'error',
                  summary: 'Eroare analiză',
                  detail: 'Verificaţi conexiunea şi configurarea API.',
                  life: 5000,
                });
                return of(null);
              }),
              tap((result) => {
                patchState(store, { analyzing: false });
                if (result) patchState(store, { analysisResult: result });
              }),
            );
        }),
      ),
    );

    const loadParallelVerses = rxMethod<void>(
      pipe(
        filter(() => !!store.selectedSelection() && !!store.currentNav()),
        tap(() =>
          patchState(store, {
            loadingParallel: true,
            parallelVerses: [],
            showParallelView: true,
          }),
        ),
        switchMap(() => {
          const nav = store.currentNav()!;
          const verseNums = store
            .selectedVerseNumbers()
            .map((n) => parseInt(n, 10))
            .filter((n) => !isNaN(n));
          const verseStart = verseNums.length > 0 ? Math.min(...verseNums) : 1;
          const verseEnd = verseNums.length > 0 ? Math.max(...verseNums) : verseStart;

          return bibleApi
            .getParallelVerses(nav.bookId, nav.chapter, verseStart, verseEnd, nav.translationId)
            .pipe(
              catchError(() => {
                messageService.add({
                  severity: 'error',
                  summary: 'Eroare',
                  detail: 'Eroare la încărcarea traducerilor paralele.',
                  life: 4000,
                });
                return of([] as ParallelTranslation[]);
              }),
              tap((result) => patchState(store, { parallelVerses: result, loadingParallel: false })),
            );
        }),
      ),
    );

    // ── Exported methods ─────────────────────────────────────────────────

    return {
      /** Navigate to a specific book/chapter/translation. */
      navigate(nav: BibleNavigation): void {
        loadChapter(nav);
      },

      /** Navigate using a search result (fetches books to resolve numChapters). */
      navigateFromSearch: rxMethod<SearchNavigateEvent>(
        pipe(
          filter(() => !!store.currentNav()),
          switchMap((event) => {
            const nav = store.currentNav()!;
            return bibleApi.getBooks(nav.translationId).pipe(
              catchError(() => of([])),
              tap((books) => {
                const book = books.find((b) => b.id === event.bookId);
                if (!book) return;
                const newNav: BibleNavigation = {
                  translationId: nav.translationId,
                  translationName: nav.translationName,
                  bookId: event.bookId,
                  bookName: event.bookName,
                  chapter: event.chapter,
                  numChapters: book.numChapters,
                };
                // loadChapter synchronously clears selectedVerseNumbers in its
                // leading tap; we immediately override it with the target verse.
                loadChapter(newNav);
                patchState(store, { selectedVerseNumbers: [String(event.verseNumber)] });
              }),
            );
          }),
        ),
      ),

      /** Record a verse/range selection made in the text panel. */
      selectVerse(selection: VerseSelection): void {
        patchState(store, { selectedSelection: selection, parallelVerses: [] });

        const match = /(\d+)(?:-(\d+))?$/.exec(selection.range);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : start;
          patchState(store, {
            selectedVerseNumbers: Array.from(
              { length: end - start + 1 },
              (_, i) => String(start + i),
            ),
          });
        }

        if (store.showParallelView()) {
          loadParallelVerses(undefined);
        }
      },

      /** Trigger hermeneutic analysis for the current selection. */
      analyze(): void {
        runAnalysis(undefined);
      },

      prevChapter(): void {
        const nav = store.currentNav();
        if (!nav || !store.hasPrevChapter()) return;
        loadChapter({ ...nav, chapter: nav.chapter - 1 });
      },

      nextChapter(): void {
        const nav = store.currentNav();
        if (!nav || !store.hasNextChapter()) return;
        loadChapter({ ...nav, chapter: nav.chapter + 1 });
      },

      toggleParallelView(): void {
        if (store.showParallelView()) {
          patchState(store, { showParallelView: false });
        } else {
          loadParallelVerses(undefined);
        }
      },

      closeParallelView(): void {
        patchState(store, { showParallelView: false });
      },
    };
  }),
);
