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
    } finally {
      client.release();
    }
  }
}
