import { Module } from '@nestjs/common';
import { ConcordanceService } from './concordance.service';

@Module({
  providers: [ConcordanceService],
  exports: [ConcordanceService],
})
export class ConcordanceModule {}
