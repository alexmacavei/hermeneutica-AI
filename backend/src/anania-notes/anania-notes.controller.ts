import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
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
    if (!book) {
      throw new BadRequestException('Query parameter "book" is required');
    }
    const chapterNum = parseInt(chapter, 10);
    const verseNum = parseInt(verse, 10);
    if (!chapterNum || chapterNum < 1) {
      throw new BadRequestException('Query parameter "chapter" must be a positive number');
    }
    if (!verseNum || verseNum < 1) {
      throw new BadRequestException('Query parameter "verse" must be a positive number');
    }
    return this.ananiaNotesService.findByVerse(book, chapterNum, verseNum);
  }
}
