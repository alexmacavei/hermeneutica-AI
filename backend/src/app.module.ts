import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BibleModule } from './bible/bible.module';
import { AiModule } from './ai/ai.module';
import { AnalyzeModule } from './analyze/analyze.module';
import { DatabaseModule } from './database/database.module';
import { SearchModule } from './search/search.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    BibleModule,
    AiModule,
    AnalyzeModule,
    SearchModule,
  ],
})
export class AppModule {}
