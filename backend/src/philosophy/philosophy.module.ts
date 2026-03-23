import { Module } from '@nestjs/common';
import { PhilosophyEnrichmentService } from './philosophy-enrichment.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [PhilosophyEnrichmentService],
  exports: [PhilosophyEnrichmentService],
})
export class PhilosophyModule {}
