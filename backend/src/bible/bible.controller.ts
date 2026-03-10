import { Controller, Get, Param, Query } from '@nestjs/common';
import { BibleService } from './bible.service';

@Controller('bible')
export class BibleController {
  constructor(private readonly bibleService: BibleService) {}

  @Get('books')
  getBooks(
    @Query('language') language: string = 'sinodala-ro',
    @Query('testament') testament: string = 'NT',
  ): string[] {
    return this.bibleService.getBooks(language, testament);
  }

  @Get('chapters')
  getChapters(
    @Query('language') language: string = 'sinodala-ro',
    @Query('testament') testament: string = 'NT',
    @Query('book') book: string,
  ): string[] {
    return this.bibleService.getChapters(language, testament, book);
  }

  @Get(':testament/:book/:chapter')
  getChapter(
    @Param('testament') testament: string,
    @Param('book') book: string,
    @Param('chapter') chapter: string,
    @Query('language') language: string = 'sinodala-ro',
  ): Record<string, string> {
    return this.bibleService.getChapter(language, testament, book, chapter);
  }

  @Get(':testament/:book/:chapter/:verse')
  getVerse(
    @Param('testament') testament: string,
    @Param('book') book: string,
    @Param('chapter') chapter: string,
    @Param('verse') verse: string,
    @Query('language') language: string = 'sinodala-ro',
  ): { text: string } {
    const text = this.bibleService.getVerse(
      language,
      testament,
      book,
      chapter,
      verse,
    );
    return { text };
  }
}
