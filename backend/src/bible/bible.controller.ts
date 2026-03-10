import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { BibleService, Translation, Book, BibleVerse } from './bible.service';

@Controller('bible')
export class BibleController {
  constructor(private readonly bibleService: BibleService) {}

  /** List all available Bible translations. */
  @Get('translations')
  getTranslations(): Promise<Translation[]> {
    return this.bibleService.getTranslations();
  }

  /** List books available in a given translation. */
  @Get(':translationId/books')
  getBooks(
    @Param('translationId') translationId: string,
  ): Promise<Book[]> {
    return this.bibleService.getBooks(translationId);
  }

  /** Get verses for a specific chapter. */
  @Get(':translationId/:bookId/:chapter')
  getChapter(
    @Param('translationId') translationId: string,
    @Param('bookId') bookId: string,
    @Param('chapter', ParseIntPipe) chapter: number,
  ): Promise<BibleVerse[]> {
    return this.bibleService.getChapter(translationId, bookId, chapter);
  }
}
