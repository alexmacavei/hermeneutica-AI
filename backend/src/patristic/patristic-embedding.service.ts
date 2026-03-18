import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { PatristicLoaderService, PatristicChunk } from './patristic-loader.service';
import {
  COUNT_INDEXED_CHUNKS,
  UPSERT_PATRISTIC_CHUNK,
} from './patristic-queries';

@Injectable()
export class PatristicEmbeddingService {
  private readonly logger = new Logger(PatristicEmbeddingService.name);

  /**
   * Maximum number of chunks sent to the OpenAI embeddings API in a single
   * batch call.  Keeping this small avoids hitting rate-limit / token limits.
   */
  private readonly BATCH_SIZE = 50;

  constructor(
    private readonly loaderService: PatristicLoaderService,
    private readonly aiService: AiService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Runs the full ingestion pipeline:
   *   load → clean → chunk → embed → store
   *
   * Chunks whose `source_file` is already present in the database are skipped
   * so the command is safe to run multiple times (idempotent per file).
   *
   * Returns the total number of chunks successfully stored.
   */
  async indexAll(): Promise<number> {
    const pool = this.databaseService.getPool();
    if (!pool) {
      this.logger.warn(
        'No database connection available; patristic indexing skipped.',
      );
      return 0;
    }
    if (!this.aiService.hasApiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set; patristic indexing skipped.',
      );
      return 0;
    }

    const allChunks = await this.loaderService.loadAll();
    if (allChunks.length === 0) {
      this.logger.log('No patristic chunks to index.');
      return 0;
    }

    // Group chunks by source file so we can skip already-indexed files
    const byFile = this.groupBySourceFile(allChunks);
    let totalStored = 0;

    for (const [sourceFile, chunks] of byFile.entries()) {
      try {
        const { rows } = await pool.query<{ count: number }>(
          COUNT_INDEXED_CHUNKS,
          [sourceFile],
        );
        if ((rows[0]?.count ?? 0) > 0) {
          this.logger.log(`Skipping already-indexed file: ${sourceFile}`);
          continue;
        }

        const stored = await this.embedAndStore(chunks);
        totalStored += stored;
        this.logger.log(
          `Indexed ${stored} chunk(s) from "${sourceFile}".`,
        );
      } catch (error) {
        this.logger.error(
          `Error indexing file "${sourceFile}"`,
          error,
        );
      }
    }

    this.logger.log(`Patristic indexing complete. Total chunks stored: ${totalStored}.`);
    return totalStored;
  }

  /**
   * Generates embeddings for `chunks` in batches and persists each chunk to
   * the `patristic_chunks` table.
   *
   * Returns the number of rows inserted (duplicates silently skipped).
   */
  private async embedAndStore(chunks: PatristicChunk[]): Promise<number> {
    const pool = this.databaseService.getPool();
    if (!pool) return 0;

    let stored = 0;

    for (let i = 0; i < chunks.length; i += this.BATCH_SIZE) {
      const batch = chunks.slice(i, i + this.BATCH_SIZE);
      const texts = batch.map((c) => {
        // Prepend author / work / chapter so the embedding captures
        // metadata context alongside the raw chunk text.  This improves
        // cross-language retrieval because the query (Romanian verse) and
        // the stored vectors share topical context words (author names,
        // work titles, biblical book references).
        const meta = [
          c.metadata.author,
          c.metadata.work,
          c.metadata.chapter,
        ]
          .filter(Boolean)
          .join(' – ');
        return meta ? `${meta}:\n${c.text}` : c.text;
      });

      const embeddings = await this.aiService.generateEmbeddings(texts);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];
          if (!chunk || !embedding) continue;

          const vectorStr = `[${embedding.join(',')}]`;
          const result = await client.query(UPSERT_PATRISTIC_CHUNK, [
            chunk.metadata.author,
            chunk.metadata.work,
            chunk.metadata.chapter ?? null,
            chunk.metadata.sourceFile,
            chunk.metadata.sourceUrl ?? null,
            chunk.chunkIndex,
            chunk.text,
            vectorStr,
          ]);
          // rowCount is 1 for a new insert, 0 when ON CONFLICT DO NOTHING skips it
          stored += result.rowCount ?? 0;
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return stored;
  }

  /** Groups a flat list of chunks by their `sourceFile` path. */
  private groupBySourceFile(
    chunks: PatristicChunk[],
  ): Map<string, PatristicChunk[]> {
    const map = new Map<string, PatristicChunk[]>();
    for (const chunk of chunks) {
      const key = chunk.metadata.sourceFile;
      const existing = map.get(key) ?? [];
      existing.push(chunk);
      map.set(key, existing);
    }
    return map;
  }
}
