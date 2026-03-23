import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { AiModule } from '../ai/ai.module';
import { PatristicModule } from '../patristic/patristic.module';
import { PhilosophyModule } from '../philosophy/philosophy.module';

@Module({
  imports: [AiModule, PatristicModule, PhilosophyModule],
  controllers: [AnalyzeController],
  providers: [AnalyzeService],
})
export class AnalyzeModule {}
