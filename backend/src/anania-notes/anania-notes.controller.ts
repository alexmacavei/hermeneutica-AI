import { Controller, Get, Query } from '@nestjs/common';
import { AnaniaNotesService } from './anania-notes.service';

@Controller('anania-notes')
export class AnaniaNotesController {
  constructor(private readonly ananiaNotesService: AnaniaNotesService) {}

  @Get()
  findByVerse(
    @Query('book') book: string,
    @Query('chapter') chapter: string,
    @Query('verse') verse: string,
  ) {
    return this.ananiaNotesService.findByVerse(
      book ?? '',
      parseInt(chapter, 10) || 0,
      parseInt(verse, 10) || 0,
    );
  }
}
