import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { SearchService, SearchResponse } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { IngestChapterDto } from './dto/ingest-chapter.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Semantic search for Bible verses related to the given query term.
   *
   * GET /api/search?q=mântuire&translationId=BSR&limit=10
   */
  @Get()
  search(@Query() dto: SearchQueryDto): Promise<SearchResponse> {
    return this.searchService.searchVerses(
      dto.q,
      dto.translationId,
      dto.limit ?? 10,
    );
  }

  /**
   * Ingest embeddings for a single chapter.  Called fire-and-forget by the
   * frontend whenever a chapter is loaded, so the embedding store builds up
   * lazily as users browse.
   *
   * POST /api/search/ingest/:translationId/:bookId/:chapter
   */
  @Post('ingest/:translationId/:bookId/:chapter')
  @HttpCode(HttpStatus.ACCEPTED)
  ingestChapter(
    @Param('translationId') translationId: string,
    @Param('bookId') bookId: string,
    @Param('chapter', ParseIntPipe) chapter: number,
    @Body() dto: IngestChapterDto,
  ): { message: string } {
    void this.searchService.ingestChapter(
      translationId,
      bookId,
      dto.bookName,
      chapter,
      dto.verses,
    );
    return { message: 'Ingestion started' };
  }
}
