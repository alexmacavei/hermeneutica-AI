import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { SEARCH_PATRISTIC_BY_EMBEDDING } from './patristic-queries';
import { PATRISTIC_SIMILARITY_THRESHOLD, PATRISTIC_SEARCH_CANDIDATES } from './pipeline.config';

/** A single patristic chunk returned by the similarity search. */
export interface PatristicChunkResult {
  author: string;
  work: string;
  chapter: string | null;
  chunkText: string;
  similarity: number;
}

/** Message returned when the local corpus contains no relevant chunks. */
export const PATRISTIC_FALLBACK =
  'Nu s-au găsit comentarii patristice relevante în corpusul local.';

interface PatristicRow {
  author: string;
  work: string;
  chapter: string | null;
  chunk_text: string;
  similarity: number;
}

/**
 * RAG (Retrieval-Augmented Generation) service for the „Comentarii Patristice" card.
 *
 * 1. Converts the Bible verse into a vector embedding.
 * 2. Queries the `patristic_chunks` table for the closest matches.
 * 3. Builds a structured prompt and asks the AI model to produce 2–3
 *    patristic comments grounded exclusively in the retrieved fragments.
 */
@Injectable()
export class PatristicRagService {
  private readonly logger = new Logger(PatristicRagService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Returns the most relevant patristic chunks for the given Bible verse.
   * Only chunks whose cosine-similarity score meets the configured threshold
   * are returned.  An empty array signals that the corpus has no good match.
   *
   * @param verseText  Plain-text content of the Bible verse.
   * @param reference  Human-readable reference (e.g. „Ioan 3,16").
   * @param limit      Maximum number of chunks to retrieve (default 3).
   */
  async findRelevantChunksForVerse(
    verseText: string,
    reference: string,
    limit = 3,
  ): Promise<PatristicChunkResult[]> {
    const pool = this.databaseService.getPool();
    if (!pool || !this.aiService.hasApiKey) {
      return [];
    }

    try {
      // Embed the query verse so it can be compared against the stored
      // patristic chunk embeddings using pgvector cosine similarity.
      const queryText = `${reference} ${verseText}`;
      const embedding = await this.aiService.generateEmbedding(queryText);
      const vectorStr = `[${embedding.join(',')}]`;

      // Fetch more candidates than the final limit so that the threshold filter
      // has enough material to work with even when the closest vectors are only
      // moderately similar (common in cross-language matching).
      const candidateLimit = limit * PATRISTIC_SEARCH_CANDIDATES;
      const { rows } = await pool.query<PatristicRow>(
        SEARCH_PATRISTIC_BY_EMBEDDING,
        [vectorStr, candidateLimit],
      );

      return rows
        .filter((row) => Number(row.similarity) >= PATRISTIC_SIMILARITY_THRESHOLD)
        .slice(0, limit)
        .map((row) => ({
          author: row.author,
          work: row.work,
          chapter: row.chapter,
          chunkText: row.chunk_text,
          similarity: Number(row.similarity),
        }));
    } catch (error) {
      this.logger.error('Error searching patristic chunks', error);
      return [];
    }
  }

  /**
   * Generates a structured patristic commentary for the given Bible verse
   * using RAG: it first retrieves relevant local corpus fragments and then
   * asks the AI to produce 2–3 comments exclusively from those fragments.
   *
   * Returns `PATRISTIC_FALLBACK` when:
   *  - the local corpus has no sufficiently similar chunks, or
   *  - the AI service is unavailable.
   *
   * @param verseText  Plain-text content of the Bible verse.
   * @param reference  Human-readable reference (e.g. „Ioan 3,16").
   */
  async buildPatristicSummary(
    verseText: string,
    reference: string,
  ): Promise<string> {
    const topChunks = await this.findRelevantChunksForVerse(verseText, reference);

    if (topChunks.length === 0) {
      return PATRISTIC_FALLBACK;
    }

    const contextBlocks = topChunks
      .map(
        (c, i) =>
          `[${i + 1}] ${c.author} – ${c.work}${c.chapter ? `, ${c.chapter}` : ''}:\n«${c.chunkText}»`,
      )
      .join('\n\n');

    const result = await this.aiService.generatePatristicSummary(
      reference,
      verseText,
      contextBlocks,
      PATRISTIC_FALLBACK,
    );

    return result || PATRISTIC_FALLBACK;
  }
}
