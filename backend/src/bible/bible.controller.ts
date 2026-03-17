import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  BibleService,
  Translation,
  Book,
  BibleVerse,
  ParallelTranslation,
} from './bible.service';

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

  /**
   * Get the selected verse(s) across all available translations for parallel study.
   * Must be declared before the generic :translationId/:bookId/:chapter route so
   * that the literal "parallel" segment is matched first.
   */
  @Get('parallel/:bookId/:chapter')
  getParallelVerses(
    @Param('bookId') bookId: string,
    @Param('chapter', ParseIntPipe) chapter: number,
    @Query('verseStart') verseStart: string,
    @Query('verseEnd') verseEnd: string,
    @Query('exclude') exclude?: string,
  ): Promise<ParallelTranslation[]> {
    const start = parseInt(verseStart, 10);
    if (isNaN(start)) {
      throw new BadRequestException('verseStart must be a number');
    }
    const end = verseEnd ? parseInt(verseEnd, 10) : start;
    if (isNaN(end)) {
      throw new BadRequestException('verseEnd must be a number');
    }
    return this.bibleService.getParallelVerses(bookId, chapter, start, end, exclude);
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
