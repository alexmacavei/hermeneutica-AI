/**
 * Shared utility functions used by all Bible extraction pipelines.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { ENGLISH_BOOK_NAMES, APOCRYPHAL_CODES, BIBLES_DIR } from './constants';
import type { BaseBookConfig, HelloaoBook, HelloaoChapter, HelloaoOutput, Verse } from './types';

/** Returns a promise that resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validates that every USFM code in the given book config has a corresponding
 * English name entry.  Throws if any are missing.
 */
export function validateEnglishNames(books: BaseBookConfig[]): void {
  const missing = books
    .map((b) => b.usfmCode)
    .filter((code) => !(code in ENGLISH_BOOK_NAMES));
  if (missing.length > 0) {
    throw new Error(`Missing ENGLISH_BOOK_NAMES entries for: ${missing.join(', ')}`);
  }
}

/**
 * Builds a single helloao-compatible chapter entry from parsed verses.
 */
export function buildChapterEntry(chapterNumber: number, bookName: string, verses: Verse[]): HelloaoChapter {
  return {
    chapter: {
      number: chapterNumber,
      bookName,
      content: verses.map((v) => ({
        type: 'verse' as const,
        number: v.number,
        content: [v.text],
      })),
    },
  };
}

/**
 * Builds a single helloao-compatible book entry.
 */
export function buildBookEntry(opts: {
  usfmCode: string;
  name: string;
  shortName: string;
  order: number;
  chapters: HelloaoChapter[];
  totalVerses: number;
}): HelloaoBook {
  return {
    id: opts.usfmCode,
    name: opts.name,
    shortName: opts.shortName,
    commonName: ENGLISH_BOOK_NAMES[opts.usfmCode],
    title: opts.name,
    order: opts.order,
    numberOfChapters: opts.chapters.length,
    totalNumberOfVerses: opts.totalVerses,
    isApocryphal: APOCRYPHAL_CODES.has(opts.usfmCode),
    chapters: opts.chapters,
  };
}

/**
 * Writes the final helloao-compatible JSON to the configured BIBLES_DIR.
 */
export async function writeOutput(
  translationId: string,
  translation: HelloaoOutput['translation'],
  books: HelloaoBook[],
): Promise<string> {
  await fs.mkdir(BIBLES_DIR, { recursive: true });
  const outputPath = path.join(BIBLES_DIR, `${translationId}.json`);
  const output: HelloaoOutput = { translation, books };
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  return outputPath;
}
