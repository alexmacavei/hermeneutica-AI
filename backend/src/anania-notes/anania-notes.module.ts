import { Module } from '@nestjs/common';
import { AnaniaNotesController } from './anania-notes.controller';
import { AnaniaNotesService } from './anania-notes.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AnaniaNotesController],
  providers: [AnaniaNotesService],
  exports: [AnaniaNotesService],
})
export class AnaniaNotesModule {}
