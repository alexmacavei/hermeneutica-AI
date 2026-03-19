import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { join } from "path";
import { access, readFile } from "fs/promises";

const BIBLE_API_BASE = "https://bible.helloao.org/api";

/** Maximum chapter number accepted in API requests (Psalms has 150; 200 gives comfortable headroom). */
const MAX_CHAPTER = 200;

/** Maximum verse number accepted in parallel-verse requests. */
const MAX_VERSE = 500;

/**
 * Ordered list of translation IDs available in the application.
 * Corresponds to: Hebrew Masoretic Text, Greek Septuagint,
 * Greek New Testament, King James Version with Apocrypha,
 * and Romanian Synodal Bible (local file; included only when available).
 */
const ALLOWED_TRANSLATION_IDS = [
  "hbo_wlc",
  "grc_bre",
  "grc_byz",
  "eng_kja",
  "ro_sinodala",
  "ro_anania",
] as const;

/** Metadata for translations whose text is served from a local JSON file. */
const LOCAL_TRANSLATIONS: Record<
  string,
  { name: string; englishName: string; language: string }
> = {
  ro_sinodala: {
    name: "Biblia Sinodală",
    englishName: "Romanian Synodal Bible",
    language: "ro",
  },
  ro_anania: {
    name: "Biblia Anania",
    englishName: "Romanian Anania Bible",
    language: "ro",
  },
};

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
  // Format A (newer): chapter.content array (upstream API)
  chapter?: {
    number: number;
    // Optional: local BSR chapters use the `verses` array instead
    content?: ApiVerseContent[];
  };
  // Format B (simplified): flat verses array (local data and some upstream)
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

export interface ParallelTranslation {
  translationId: string;
  translationName: string;
  language: string;
  textDirection: string;
  available: boolean;
  verses: BibleVerse[];
}

// ─── Local Bible types ─────────────────────────────────────────────────────

interface LocalBibleVerse {
  verse: number;
  text: string;
}

interface LocalBibleChapter {
  chapter: { number: number };
  verses?: LocalBibleVerse[];
}

interface LocalBibleBook {
  id: string;
  name: string;
  numberOfChapters: number;
  chapters: LocalBibleChapter[];
}

interface LocalBibleData {
  books: LocalBibleBook[];
}

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class BibleService {
  private readonly logger = new Logger(BibleService.name);

  // Simple in-memory caches – populated on first request
  private cachedTranslations: Translation[] | null = null;
  private readonly booksCache = new Map<string, Book[]>();
  private readonly chapterCache = new Map<string, BibleVerse[]>();
  private readonly localBibleCache = new Map<string, LocalBibleData>();

  // ── Public methods ─────────────────────────────────────────────────────

  async getTranslations(): Promise<Translation[]> {
    if (this.cachedTranslations) return this.cachedTranslations;

    // Process each allowed translation
    const results = await Promise.all(
      ALLOWED_TRANSLATION_IDS.map(async (id) => {
        const localMeta = LOCAL_TRANSLATIONS[id];
        if (localMeta) {
          // Local translation – include only when the file is present on disk
          const localBiblePath = this.getLocalBiblePath(id);
          try {
            await access(localBiblePath);
            return {
              id,
              name: localMeta.name,
              englishName: localMeta.englishName,
              language: localMeta.language,
              textDirection: "ltr",
            };
          } catch {
            this.logger.warn(
              `Local Bible file not found at ${localBiblePath}; ${id} translation will not be available.`,
            );
            return null;
          }
        } else {
          // Upstream translation from helloao API
          try {
            const data = await this.fetchJson<{
              translation: ApiTranslation;
              books: ApiBook[];
            }>(`${BIBLE_API_BASE}/${id}/books.json`);

            // Also warm up books cache since we have the data
            if (!this.booksCache.has(id)) {
              this.booksCache.set(
                id,
                data.books.map((b) => ({
                  id: b.id,
                  name: b.name,
                  numChapters: b.numChapters,
                })),
              );
            }

            return {
              id: data.translation.id,
              name: data.translation.name,
              englishName: data.translation.englishName,
              language: data.translation.language,
              textDirection: data.translation.textDirection,
            };
          } catch (error) {
            this.logger.warn(
              `Failed to fetch metadata for translation ${id}: ${error.message}`,
            );
            return null;
          }
        }
      }),
    );

    this.cachedTranslations = results.filter(
      (t): t is Translation => t !== null,
    );
    return this.cachedTranslations;
  }

  async getBooks(translationId: string): Promise<Book[]> {
    this.validateSegment(translationId, "translationId");

    if (this.booksCache.has(translationId)) {
      return this.booksCache.get(translationId)!;
    }

    let books: Book[];
    if (LOCAL_TRANSLATIONS[translationId]) {
      const localData = await this.loadLocalBible(translationId);
      books = localData.books.map((b) => ({
        id: b.id,
        name: b.name,
        numChapters: b.numberOfChapters,
      }));
    } else {
      const data = await this.fetchJson<{ books: ApiBook[] }>(
        `${BIBLE_API_BASE}/${translationId}/books.json`,
      );

      books = data.books.map((b) => ({
        id: b.id,
        name: b.name,
        numChapters: b.numChapters,
      }));
    }

    this.booksCache.set(translationId, books);
    return books;
  }

  async getChapter(
    translationId: string,
    bookId: string,
    chapter: number,
  ): Promise<BibleVerse[]> {
    this.validateSegment(translationId, "translationId");
    this.validateSegment(bookId, "bookId");

    // Sanity-check the chapter number.  Psalms (150), Revelation (22) are the
    // practical upper bounds; MAX_CHAPTER gives comfortable headroom without
    // permitting obviously invalid values that would just produce API 404s.
    if (chapter < 1 || chapter > MAX_CHAPTER) {
      throw new BadRequestException("chapter must be between 1 and 200");
    }

    const cacheKey = `${translationId}/${bookId}/${chapter}`;
    if (this.chapterCache.has(cacheKey)) {
      return this.chapterCache.get(cacheKey)!;
    }

    let verses: BibleVerse[];

    if (LOCAL_TRANSLATIONS[translationId]) {
      const localData = await this.loadLocalBible(translationId);
      const book = localData.books.find((b) => b.id === bookId);
      if (!book) {
        throw new NotFoundException(
          `Book ${bookId} not found in ${translationId}`,
        );
      }
      const chapterData = book.chapters.find(
        (c) => c.chapter.number === chapter,
      );
      if (!chapterData) {
        throw new NotFoundException(
          `Chapter ${chapter} not found in book ${bookId} of ${translationId}`,
        );
      }
      verses = this.parseVerses(chapterData);
    } else {
      const data = await this.fetchJson<ApiChapterResponse>(
        `${BIBLE_API_BASE}/${translationId}/${bookId}/${chapter}.json`,
      );
      verses = this.parseVerses(data);
    }

    this.chapterCache.set(cacheKey, verses);
    return verses;
  }

  async getParallelVerses(
    bookId: string,
    chapter: number,
    verseStart: number,
    verseEnd: number,
    excludeTranslationId?: string,
  ): Promise<ParallelTranslation[]> {
    this.validateSegment(bookId, "bookId");
    if (excludeTranslationId) {
      this.validateSegment(excludeTranslationId, "excludeTranslationId");
    }

    if (chapter < 1 || chapter > MAX_CHAPTER) {
      throw new BadRequestException("chapter must be between 1 and 200");
    }
    if (verseStart < 1 || verseEnd < verseStart || verseEnd > MAX_VERSE) {
      throw new BadRequestException("Invalid verse range");
    }

    const translations = await this.getTranslations();
    const filtered = excludeTranslationId
      ? translations.filter((t) => t.id !== excludeTranslationId)
      : translations;

    return await Promise.all(
      filtered.map(async (translation): Promise<ParallelTranslation> => {
        try {
          const allVerses = await this.getChapter(
            translation.id,
            bookId,
            chapter,
          );
          const verses = allVerses.filter((v) => {
            const num = parseInt(v.number, 10);
            return !isNaN(num) && num >= verseStart && num <= verseEnd;
          });
          return {
            translationId: translation.id,
            translationName: translation.name,
            language: translation.language,
            textDirection: translation.textDirection,
            available: verses.length > 0,
            verses,
          };
        } catch {
          return {
            translationId: translation.id,
            translationName: translation.name,
            language: translation.language,
            textDirection: translation.textDirection,
            available: false,
            verses: [],
          };
        }
      }),
    );
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
        .filter((item) => item.type === "verse" && item.number != null)
        .map((item) => ({
          number: String(item.number),
          text: this.extractText(item.content ?? []),
        }));
    }

    return [];
  }

  private extractText(content: (string | { text?: string })[]): string {
    return content
      .map((c) => (typeof c === "string" ? c : (c.text ?? "")))
      .join(" ")
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

  private getLocalBiblePath(translationId: string): string {
    const dataDir = process.env["DATA_DIR"] ?? join(process.cwd(), "data");
    return join(dataDir, "bibles", `${translationId}.json`);
  }

  private async loadLocalBible(translationId: string): Promise<LocalBibleData> {
    const cached = this.localBibleCache.get(translationId);
    if (cached) return cached;

    const filePath = this.getLocalBiblePath(translationId);
    try {
      this.logger.log(`Loading local Bible from disk: ${filePath}`);
      const content = await readFile(filePath, "utf-8");
      const data = JSON.parse(content) as LocalBibleData;
      this.localBibleCache.set(translationId, data);
      return data;
    } catch (error) {
      this.logger.error(`Error loading local Bible file at ${filePath}`, error);
      throw new InternalServerErrorException("Failed to load local Bible data");
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.error(`Network error fetching ${url}`, error);
      throw new InternalServerErrorException(
        "Cannot reach the Bible API. Check network connectivity.",
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
