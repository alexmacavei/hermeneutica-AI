import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getSearchResults } from 'biblesdk';
import { AiService } from '../ai/ai.service';
import { BibleService } from '../bible/bible.service';
import { DatabaseService } from '../database/database.service';
import {
  COUNT_INDEXED_VERSES,
  SEARCH_VERSES_BY_EMBEDDING,
  UPSERT_VERSE_EMBEDDING,
} from './search.queries';

/**
 * Translation IDs whose source is a local JSON file on disk.
 * These are pre-indexed at startup so semantic search works immediately,
 * without requiring the user to browse every chapter first.
 */
const LOCAL_TRANSLATION_IDS = ['ro_sinodala', 'ro_anania'];

export interface SearchResult {
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verseNumber: number;
  verseText: string;
  similarity: number;
  reference: string;
  consensusBoost: boolean;
}

export interface SearchResponse {
  query: string;
  translationId: string;
  results: SearchResult[];
  total: number;
}

interface VerseRow {
  translation_id: string;
  book_id: string;
  book_name: string;
  chapter_number: number;
  verse_number: number;
  verse_text: string;
  similarity: number;
}

interface CountRow {
  count: number;
}

/**
 * Provides semantic search over Bible verses stored as pgvector embeddings.
 *
 * Verses are indexed lazily via `ingestChapter()` – called whenever a chapter
 * is loaded – so the embedding store builds up incrementally as users browse.
 * Local translations (ro_sinodala, ro_anania) are also pre-indexed at startup
 * so semantic search is fully functional without requiring prior browsing.
 * Both search and ingestion degrade gracefully when the database or the OpenAI
 * API key are unavailable.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly bibleService: BibleService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Schedules background pre-indexing of local translations after startup.
   * Runs fire-and-forget; errors are caught per-translation so one failure
   * does not prevent the others from being indexed.
   */
  onModuleInit(): void {
    if (!this.aiService.hasApiKey) return;
    // Delay startup by 5 s to let the DB connection and schema init complete.
    setTimeout(() => void this.warmUpLocalTranslations(), 5_000);
  }

  /** Pre-indexes all chapters of every local translation that are not yet in the DB. */
  private async warmUpLocalTranslations(): Promise<void> {
    for (const translationId of LOCAL_TRANSLATION_IDS) {
      try {
        await this.warmUpTranslation(translationId);
      } catch (err) {
        this.logger.warn(
          `Background warmup failed for ${translationId}: ${(err as Error)?.message ?? err}`,
        );
      }
    }
  }

  /**
   * Iterates through every book/chapter of a translation and ingests any
   * chapters that have not yet been indexed.  Processes chapters one at a
   * time with a short pause to stay well within OpenAI rate limits.
   */
  private async warmUpTranslation(translationId: string): Promise<void> {
    const pool = this.databaseService.getPool();
    if (!pool) return;

    const books = await this.bibleService.getBooks(translationId);
    let newChapters = 0;

    for (const book of books) {
      for (let chapter = 1; chapter <= book.numChapters; chapter++) {
        const { rows } = await pool.query<CountRow>(COUNT_INDEXED_VERSES, [
          translationId,
          book.id,
          chapter,
        ]);
        if ((rows[0]?.count ?? 0) > 0) continue; // already indexed

        const verses = await this.bibleService.getChapter(
          translationId,
          book.id,
          chapter,
        );
        await this.ingestChapter(
          translationId,
          book.id,
          book.name,
          chapter,
          verses.map((v) => ({ number: v.number, text: v.text })),
        );
        newChapters++;

        // 50 ms breathing room between embedding API calls.
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
    }

    if (newChapters > 0) {
      this.logger.log(
        `Warmup complete for ${translationId}: ${newChapters} new chapters indexed.`,
      );
    } else {
      this.logger.debug(`Warmup: ${translationId} was already fully indexed.`);
    }
  }

  /**
   * Searches for Bible verses semantically related to `query` within the
   * given translation.  Returns an empty result set when the database or API
   * key are not available.
   */
  async searchVerses(
    query: string,
    translationId: string,
    limit = 10,
  ): Promise<SearchResponse> {
    const pool = this.databaseService.getPool();
    if (!pool || !this.aiService.hasApiKey) {
      return { query, translationId, results: [], total: 0 };
    }

    try {
      const embedding = await this.aiService.generateEmbedding(query);
      const vectorStr = `[${embedding.join(',')}]`;

      const [pgResult, sdkResult] = await Promise.all([
        pool.query<VerseRow>(SEARCH_VERSES_BY_EMBEDDING, [vectorStr, translationId, limit]),
        getSearchResults(query).catch((err) => {
          this.logger.warn(`biblesdk search failed, falling back to local only: ${(err as Error)?.message ?? err}`);
          return [];
        }),
      ]);

      const localResults: SearchResult[] = pgResult.rows.map((row) => ({
        translationId: row.translation_id,
        bookId: row.book_id,
        bookName: row.book_name,
        chapter: Number(row.chapter_number),
        verseNumber: Number(row.verse_number),
        verseText: row.verse_text,
        similarity: Number(row.similarity),
        reference: `${row.book_name} ${row.chapter_number}:${row.verse_number}`,
        consensusBoost: false,
      }));

      const results = this.mergeWithSdkResults(localResults, sdkResult);

      return { query, translationId, results, total: results.length };
    } catch (error) {
      this.logger.error('Error performing semantic search', error);
      return { query, translationId, results: [], total: 0 };
    }
  }

  /**
   * Merges local pgvector results with SDK results, applying a consensus boost
   * (+0.08, capped at 1.0) to verses found in both result sets, then returns
   * the merged list sorted by descending similarity.
   */
  private mergeWithSdkResults(
    localResults: SearchResult[],
    sdkResults: Array<{ book: string; chapter: number; verse: number; score: number }>,
  ): SearchResult[] {
    const sdkKeys = new Set(
      sdkResults.map((r) => `${r.book}:${r.chapter}:${r.verse}`),
    );

    const merged = localResults.map((r) => {
      const key = `${r.bookId}:${r.chapter}:${r.verseNumber}`;
      if (sdkKeys.has(key)) {
        return {
          ...r,
          consensusBoost: true,
          similarity: Math.min(1.0, r.similarity + 0.08),
        };
      }
      return { ...r };
    });

    return merged.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Generates and stores embeddings for all verses of a chapter.
   * Skips the chapter if its embeddings already exist.
   * Designed to be called fire-and-forget; errors are logged, not thrown.
   */
  async ingestChapter(
    translationId: string,
    bookId: string,
    bookName: string,
    chapterNumber: number,
    verses: { number: string; text: string }[],
  ): Promise<void> {
    const pool = this.databaseService.getPool();
    if (!pool || !this.aiService.hasApiKey || verses.length === 0) return;

    try {
      const { rows: existing } = await pool.query<CountRow>(
        COUNT_INDEXED_VERSES,
        [translationId, bookId, chapterNumber],
      );
      if ((existing[0]?.count ?? 0) > 0) return;

      const texts = verses.map((v) => v.text);
      const embeddings = await this.aiService.generateEmbeddings(texts);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (let i = 0; i < verses.length; i++) {
          const verse = verses[i];
          const embedding = embeddings[i];
          if (!verse || !embedding) continue;

          const vectorStr = `[${embedding.join(',')}]`;
          await client.query(UPSERT_VERSE_EMBEDDING, [
            translationId,
            bookId,
            bookName,
            chapterNumber,
            parseInt(verse.number, 10),
            verse.text,
            vectorStr,
          ]);
        }
        await client.query('COMMIT');
        this.logger.log(
          `Ingested ${verses.length} verses for ${translationId}/${bookId}/${chapterNumber}`,
        );
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.error(
        `Error ingesting chapter ${translationId}/${bookId}/${chapterNumber}`,
        error,
      );
    }
  }
}
