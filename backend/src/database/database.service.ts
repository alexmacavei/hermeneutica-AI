import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

/** Manages the PostgreSQL connection pool and ensures the pgvector schema exists. */
@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const databaseUrl = this.configService.get<string>('databaseUrl');
    if (!databaseUrl) {
      this.logger.warn(
        'DATABASE_URL not configured; semantic search will be unavailable.',
      );
      return;
    }

    try {
      this.pool = new Pool({ connectionString: databaseUrl, max: 5 });
      await this.initSchema();
      this.logger.log('Database connected and pgvector schema initialised.');
    } catch (error) {
      this.logger.error(
        'Failed to connect to database; semantic search will be unavailable.',
        error,
      );
      this.pool = null;
    }
  }

  /** Returns the active Pool, or null when the database is not configured/available. */
  getPool(): Pool | null {
    return this.pool;
  }

  private async initSchema(): Promise<void> {
    const client = await this.pool!.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      await client.query(`
        CREATE TABLE IF NOT EXISTS verse_embeddings (
          id               SERIAL PRIMARY KEY,
          translation_id   VARCHAR(20)  NOT NULL,
          book_id          VARCHAR(20)  NOT NULL,
          book_name        TEXT         NOT NULL,
          chapter_number   INT          NOT NULL,
          verse_number     INT          NOT NULL,
          verse_text       TEXT         NOT NULL,
          embedding        vector(1536),
          created_at       TIMESTAMPTZ  DEFAULT now(),
          UNIQUE (translation_id, book_id, chapter_number, verse_number)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS patristic_chunks (
          id           SERIAL PRIMARY KEY,
          author       TEXT          NOT NULL,
          work         TEXT          NOT NULL,
          chapter      TEXT,
          source_file  TEXT          NOT NULL,
          source_url   TEXT,
          chunk_index  INT           NOT NULL,
          chunk_text   TEXT          NOT NULL,
          embedding    vector(1536),
          created_at   TIMESTAMPTZ   DEFAULT now(),
          UNIQUE (source_file, chunk_index)
        )
      `);
      // HNSW index for fast cosine-similarity search on patristic embeddings.
      // vector_cosine_ops matches the <=> operator used in SEARCH_PATRISTIC_BY_EMBEDDING.
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_patristic_chunks_embedding
        ON patristic_chunks USING hnsw (embedding vector_cosine_ops)
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id               SERIAL PRIMARY KEY,
          email            VARCHAR(255) NOT NULL UNIQUE,
          hashed_password  TEXT         NOT NULL,
          created_at       TIMESTAMPTZ  DEFAULT now(),
          updated_at       TIMESTAMPTZ  DEFAULT now()
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_notes (
          id               SERIAL PRIMARY KEY,
          user_id          INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          verse_reference  TEXT         NOT NULL,
          note_title       TEXT         NOT NULL DEFAULT '',
          note_text        TEXT         NOT NULL,
          created_at       TIMESTAMPTZ  DEFAULT now(),
          updated_at       TIMESTAMPTZ  DEFAULT now()
        )
      `);
      // Idempotent migration: add note_title to existing deployments
      await client.query(`
        ALTER TABLE user_notes
        ADD COLUMN IF NOT EXISTS note_title TEXT NOT NULL DEFAULT ''
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_notes_user_verse
        ON user_notes (user_id, verse_reference)
      `);
    } finally {
      client.release();
    }
  }
}
