import { Injectable, Logger } from '@nestjs/common';
import { getPhrases } from 'biblesdk';

export interface ConcordanceEntry {
  word: string;
  strongsNumber: number;
  strongsType: string;
  transliteration: string;
  definition: string;
  originalWord: string;
}

@Injectable()
export class ConcordanceService {
  private readonly logger = new Logger(ConcordanceService.name);
  private readonly cache = new Map<string, ConcordanceEntry[]>();

  async getVerseConcordance(
    bookId: string,
    chapter: number,
    verse: number,
  ): Promise<ConcordanceEntry[]> {
    const cacheKey = `${bookId}.${chapter}.${verse}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    try {
      const phrases = await getPhrases(bookId, chapter, [verse, verse], true);
      const entries: ConcordanceEntry[] = phrases
        .filter((p) => p.strongs_number !== null)
        .map((p) => ({
          word: p.text,
          strongsNumber: p.strongs_number!,
          strongsType: p.strongs_type ?? '',
          transliteration: p.transliteration ?? '',
          definition: p.definition ?? '',
          originalWord: p.greek_word ?? p.hebrew_word ?? '',
        }));
      this.cache.set(cacheKey, entries);
      return entries;
    } catch (error) {
      this.logger.warn(`Concordance fetch failed for ${cacheKey}: ${(error as Error)?.message ?? error}`);
      return [];
    }
  }

  formatConcordanceContext(entries: ConcordanceEntry[]): string {
    if (entries.length === 0) return '';
    return entries
      .map(
        (e) =>
          `• "${e.word}" → ${e.originalWord} (Strong's ${e.strongsType}${e.strongsNumber}): ${e.transliteration} — ${e.definition}`,
      )
      .join('\n');
  }
}
