import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BibleModule } from './bible/bible.module';
import { AiModule } from './ai/ai.module';
import { AnalyzeModule } from './analyze/analyze.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    BibleModule,
    AiModule,
    AnalyzeModule,
  ],
})
export class AppModule {}
