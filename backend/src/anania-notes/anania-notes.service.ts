import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface AnaniaAdnotare {
  id: number;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  note_number: number;
  note_text: string;
  metadata: {
    page?: number;
    original_marker?: string;
    attached_to_word?: string;
  } | null;
  created_at: Date;
}

@Injectable()
export class AnaniaNotesService {
  private readonly logger = new Logger(AnaniaNotesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns all Anania notes matching a specific verse.
   * Matches notes where verse_start <= verse AND (verse_end IS NULL OR verse_end >= verse).
   */
  async findByVerse(
    book: string,
    chapter: number,
    verse: number,
  ): Promise<AnaniaAdnotare[]> {
    const pool = this.db.getPool();
    if (!pool) return [];
    const result = await pool.query<AnaniaAdnotare>(
      `SELECT * FROM anania_adnotari
       WHERE book = $1
         AND chapter = $2
         AND verse_start <= $3
         AND (verse_end IS NULL OR verse_end >= $3)
       ORDER BY verse_start, note_number`,
      [book, chapter, verse],
    );
    return result.rows;
  }

  /**
   * Bulk-insert notes for the pipeline.
   * Clears existing data first (idempotent re-run).
   */
  async bulkInsert(
    notes: Omit<AnaniaAdnotare, 'id' | 'created_at'>[],
  ): Promise<number> {
    const pool = this.db.getPool();
    if (!pool) throw new Error('Database not available');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM anania_adnotari');

      let inserted = 0;
      for (const n of notes) {
        await client.query(
          `INSERT INTO anania_adnotari
             (book, chapter, verse_start, verse_end, note_number, note_text, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            n.book,
            n.chapter,
            n.verse_start,
            n.verse_end,
            n.note_number,
            n.note_text,
            n.metadata ? JSON.stringify(n.metadata) : null,
          ],
        );
        inserted++;
      }

      await client.query('COMMIT');
      this.logger.log(`Inserted ${inserted} Anania notes`);
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
