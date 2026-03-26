import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BibleModule } from './bible/bible.module';
import { AiModule } from './ai/ai.module';
import { AnalyzeModule } from './analyze/analyze.module';
import { DatabaseModule } from './database/database.module';
import { SearchModule } from './search/search.module';
import { PatristicModule } from './patristic/patristic.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NotesModule } from './notes/notes.module';
import { ChatModule } from './chat/chat.module';
import { PdfModule } from './pdf/pdf.module';
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
    PatristicModule,
    AuthModule,
    UsersModule,
    NotesModule,
    ChatModule,
    PdfModule,
  ],
})
export class AppModule {}
