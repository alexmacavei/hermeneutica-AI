import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { AiModule } from '../ai/ai.module';
import { DatabaseModule } from '../database/database.module';
import { BibleModule } from '../bible/bible.module';

@Module({
  imports: [AiModule, DatabaseModule, BibleModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
