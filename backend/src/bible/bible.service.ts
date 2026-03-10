import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

const BIBLE_API_BASE = 'https://bible.helloao.org/api';

// ─── Upstream API types ────────────────────────────────────────────────────

interface ApiTranslation {
  id: string;
  name: string;
  englishName: string;
  language: string;
  textDirection: string;
  availableFormats?: string[];
}

interface ApiBook {
  id: string;
  name: string;
  numChapters: number;
  order?: number;
}

interface ApiVerseContent {
  type: string;
  number?: number;
  content?: (string | { text?: string })[];
}

interface ApiChapterResponse {
  // Format A (newer): chapter.content array
  chapter?: {
    number: number;
    content: ApiVerseContent[];
  };
  // Format B (simplified): flat verses array
  verses?: { verse: number; text: string }[];
}

// ─── Public types (returned to controllers) ────────────────────────────────

export interface Translation {
  id: string;
  name: string;
  englishName: string;
  language: string;
  textDirection: string;
}

export interface Book {
  id: string;
  name: string;
  numChapters: number;
}

export interface BibleVerse {
  number: string;
  text: string;
}

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class BibleService {
  private readonly logger = new Logger(BibleService.name);

  // Simple in-memory caches – populated on first request
  private cachedTranslations: Translation[] | null = null;
  private readonly booksCache = new Map<string, Book[]>();
  private readonly chapterCache = new Map<string, BibleVerse[]>();

  // ── Public methods ─────────────────────────────────────────────────────

  async getTranslations(): Promise<Translation[]> {
    if (this.cachedTranslations) return this.cachedTranslations;

    const data = await this.fetchJson<{ translations: ApiTranslation[] }>(
      `${BIBLE_API_BASE}/available_translations.json`,
    );

    this.cachedTranslations = data.translations.map((t) => ({
      id: t.id,
      name: t.name,
      englishName: t.englishName,
      language: t.language,
      textDirection: t.textDirection,
    }));

    return this.cachedTranslations;
  }

  async getBooks(translationId: string): Promise<Book[]> {
    this.validateSegment(translationId, 'translationId');

    if (this.booksCache.has(translationId)) {
      return this.booksCache.get(translationId)!;
    }

    const data = await this.fetchJson<{ books: ApiBook[] }>(
      `${BIBLE_API_BASE}/${translationId}/books.json`,
    );

    const books: Book[] = data.books.map((b) => ({
      id: b.id,
      name: b.name,
      numChapters: b.numChapters,
    }));

    this.booksCache.set(translationId, books);
    return books;
  }

  async getChapter(
    translationId: string,
    bookId: string,
    chapter: number,
  ): Promise<BibleVerse[]> {
    this.validateSegment(translationId, 'translationId');
    this.validateSegment(bookId, 'bookId');

    // Sanity-check the chapter number.  Psalms (150), Revelation (22) are the
    // practical upper bounds; 200 gives comfortable headroom without permitting
    // obviously invalid values that would just produce API 404s.
    if (chapter < 1 || chapter > 200) {
      throw new BadRequestException('chapter must be between 1 and 200');
    }

    const cacheKey = `${translationId}/${bookId}/${chapter}`;
    if (this.chapterCache.has(cacheKey)) {
      return this.chapterCache.get(cacheKey)!;
    }

    const data = await this.fetchJson<ApiChapterResponse>(
      `${BIBLE_API_BASE}/${translationId}/${bookId}/${chapter}.json`,
    );

    const verses = this.parseVerses(data);
    this.chapterCache.set(cacheKey, verses);
    return verses;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Handles both response shapes returned by the API:
   *   Shape A (newer): { chapter: { content: [{type:'verse', number, content:[...]}] } }
   *   Shape B (older):  { verses: [{ verse, text }] }
   */
  private parseVerses(data: ApiChapterResponse): BibleVerse[] {
    if (Array.isArray(data.verses) && data.verses.length > 0) {
      return data.verses.map((v) => ({
        number: String(v.verse),
        text: v.text,
      }));
    }

    if (data.chapter?.content) {
      return data.chapter.content
        .filter((item) => item.type === 'verse' && item.number != null)
        .map((item) => ({
          number: String(item.number),
          text: this.extractText(item.content ?? []),
        }));
    }

    return [];
  }

  private extractText(
    content: (string | { text?: string })[],
  ): string {
    return content
      .map((c) => (typeof c === 'string' ? c : (c.text ?? '')))
      .join(' ')
      .trim();
  }

  /**
   * Validates path segments to prevent path traversal attacks.
   * Only alphanumeric characters, hyphens, and underscores are allowed.
   */
  private validateSegment(value: string, name: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      throw new BadRequestException(`Invalid ${name}: "${value}"`);
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.error(`Network error fetching ${url}`, error);
      throw new InternalServerErrorException(
        'Cannot reach the Bible API. Check network connectivity.',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`Bible resource not found: ${url}`);
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Bible API returned HTTP ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  }
}
