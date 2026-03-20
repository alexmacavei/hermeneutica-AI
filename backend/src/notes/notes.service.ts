import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface UserNote {
  id: number;
  user_id: number;
  verse_reference: string;
  note_title: string;
  note_text: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class NotesService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    userId: number,
    verseReference: string,
    noteTitle: string,
    noteText: string,
  ): Promise<UserNote> {
    const pool = this.db.getPool();
    if (!pool) throw new Error('Database not available');
    const result = await pool.query<UserNote>(
      `INSERT INTO user_notes (user_id, verse_reference, note_title, note_text)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, verseReference, noteTitle, noteText],
    );
    return result.rows[0];
  }

  async findByVerse(
    userId: number,
    verseReference: string,
  ): Promise<UserNote[]> {
    const pool = this.db.getPool();
    if (!pool) return [];
    const result = await pool.query<UserNote>(
      `SELECT * FROM user_notes
       WHERE user_id = $1 AND verse_reference = $2
       ORDER BY created_at ASC`,
      [userId, verseReference],
    );
    return result.rows;
  }

  async update(
    id: number,
    userId: number,
    noteTitle: string,
    noteText: string,
  ): Promise<UserNote | null> {
    const pool = this.db.getPool();
    if (!pool) return null;
    const result = await pool.query<UserNote>(
      `UPDATE user_notes
       SET note_title = $1, note_text = $2, updated_at = now()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [noteTitle, noteText, id, userId],
    );
    return result.rows[0] ?? null;
  }

  async delete(id: number, userId: number): Promise<boolean> {
    const pool = this.db.getPool();
    if (!pool) return false;
    const result = await pool.query(
      'DELETE FROM user_notes WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
