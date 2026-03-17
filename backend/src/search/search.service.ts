import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import {
  COUNT_INDEXED_VERSES,
  SEARCH_VERSES_BY_EMBEDDING,
  UPSERT_VERSE_EMBEDDING,
} from './search.queries';

export interface SearchResult {
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verseNumber: number;
  verseText: string;
  similarity: number;
  reference: string;
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
 * Both search and ingestion degrade gracefully when the database or the OpenAI
 * API key are unavailable.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly databaseService: DatabaseService,
  ) {}

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

      const { rows } = await pool.query<VerseRow>(
        SEARCH_VERSES_BY_EMBEDDING,
        [vectorStr, translationId, limit],
      );

      const results: SearchResult[] = rows.map((row) => ({
        translationId: row.translation_id,
        bookId: row.book_id,
        bookName: row.book_name,
        chapter: Number(row.chapter_number),
        verseNumber: Number(row.verse_number),
        verseText: row.verse_text,
        similarity: Number(row.similarity),
        reference: `${row.book_name} ${row.chapter_number}:${row.verse_number}`,
      }));

      return { query, translationId, results, total: results.length };
    } catch (error) {
      this.logger.error('Error performing semantic search', error);
      return { query, translationId, results: [], total: 0 };
    }
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
