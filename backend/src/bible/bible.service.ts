import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

export interface BibleData {
  [testament: string]: {
    [book: string]: {
      [chapter: string]: {
        [verse: string]: string;
      };
    };
  };
}

export interface VerseRange {
  testament: string;
  book: string;
  chapter: string;
  verses: string[];
}

/** Allow-list of valid Bible file identifiers to prevent path traversal. */
const ALLOWED_LANGUAGES = new Set(['sinodala-ro', 'greaca-nt']);

@Injectable()
export class BibleService {
  private readonly bibleCache = new Map<string, BibleData>();

  private loadBible(language: string): BibleData {
    if (!ALLOWED_LANGUAGES.has(language)) {
      throw new BadRequestException(
        `Invalid language: ${language}. Allowed: ${[...ALLOWED_LANGUAGES].join(', ')}`,
      );
    }

    if (this.bibleCache.has(language)) {
      return this.bibleCache.get(language)!;
    }

    // Resolve data directory: configurable via DATA_DIR env, defaults to ../data relative to cwd
    const defaultDataRoot = path.resolve(process.cwd(), '..', 'data');
    const dataRoot = process.env['DATA_DIR']
      ? path.resolve(process.env['DATA_DIR'])
      : defaultDataRoot;

    // Ensure the resolved path is an absolute path (no traversal via env injection)
    if (!path.isAbsolute(dataRoot)) {
      throw new BadRequestException('Invalid DATA_DIR configuration.');
    }

    const filePath = path.join(dataRoot, 'bibles', `${language}.json`);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Bible file not found: ${language}`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as BibleData;
    this.bibleCache.set(language, data);
    return data;
  }

  getChapter(
    language: string,
    testament: string,
    book: string,
    chapter: string,
  ): Record<string, string> {
    const bible = this.loadBible(language);
    const verses = bible[testament]?.[book]?.[chapter];
    if (!verses) {
      throw new NotFoundException(
        `Chapter not found: ${testament} / ${book} / ${chapter}`,
      );
    }
    return verses;
  }

  getVerse(
    language: string,
    testament: string,
    book: string,
    chapter: string,
    verse: string,
  ): string {
    const verses = this.getChapter(language, testament, book, chapter);
    const text = verses[verse];
    if (!text) {
      throw new NotFoundException(
        `Verse not found: ${book} ${chapter}:${verse}`,
      );
    }
    return text;
  }

  getBooks(language: string, testament: string): string[] {
    const bible = this.loadBible(language);
    const testamentData = bible[testament];
    if (!testamentData) {
      throw new NotFoundException(`Testament not found: ${testament}`);
    }
    return Object.keys(testamentData);
  }

  getChapters(
    language: string,
    testament: string,
    book: string,
  ): string[] {
    const bible = this.loadBible(language);
    const bookData = bible[testament]?.[book];
    if (!bookData) {
      throw new NotFoundException(`Book not found: ${book}`);
    }
    return Object.keys(bookData);
  }
}
