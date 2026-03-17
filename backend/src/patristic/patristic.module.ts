import { Module } from '@nestjs/common';
import { PatristicLoaderService } from './patristic-loader.service';
import { PatristicEmbeddingService } from './patristic-embedding.service';
import { AiModule } from '../ai/ai.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [AiModule, DatabaseModule],
  providers: [PatristicLoaderService, PatristicEmbeddingService],
  exports: [PatristicLoaderService, PatristicEmbeddingService],
})
export class PatristicModule {}
