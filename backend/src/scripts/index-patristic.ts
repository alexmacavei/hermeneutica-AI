/**
 * index-patristic.ts
 *
 * NestJS standalone CLI script that indexes local patristic texts into the
 * `patristic_chunks` PostgreSQL table using pgvector embeddings.
 *
 * Usage:
 *   cd backend
 *   PATRISTIC_DATA_DIR=/path/to/patristic npm run index:patristic
 *
 * The script bootstraps the full NestJS application context so that all
 * configured services (database, AI, config) are available, then runs the
 * complete pipeline: load → clean → chunk → embed → store.
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PatristicEmbeddingService } from '../patristic/patristic-embedding.service';

const logger = new Logger('index-patristic');

async function bootstrap(): Promise<void> {
  // Create an application context without an HTTP server
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const embeddingService = app.get(PatristicEmbeddingService);
    logger.log('Starting patristic indexing pipeline…');

    const totalStored = await embeddingService.indexAll();

    logger.log(`Pipeline finished. ${totalStored} chunk(s) stored.`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err: unknown) => {
  logger.error('Fatal error during patristic indexing', err);
  process.exit(1);
});
