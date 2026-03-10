import { Module } from '@nestjs/common';
import { BibleService } from './bible.service';
import { BibleController } from './bible.controller';

@Module({
  providers: [BibleService],
  controllers: [BibleController],
  exports: [BibleService],
})
export class BibleModule {}
