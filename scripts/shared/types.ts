/**
 * Shared types used by all Bible extraction pipelines.
 */

/** A single parsed verse. */
export type Verse = { number: number; text: string };

/** Fields common to every per-book configuration entry. */
export type BaseBookConfig = {
  /** Canonical helloao order (1-based). */
  order: number;
  /** USFM book code, e.g. "GEN", "MAT". */
  usfmCode: string;
  /** Romanian abbreviation. */
  nameAbbrev: string;
};

/** helloao-compatible chapter shape inside a book entry. */
export type HelloaoChapter = {
  chapter: {
    number: number;
    bookName: string;
    content: { type: 'verse'; number: number; content: string[] }[];
  };
};

/** helloao-compatible book entry. */
export type HelloaoBook = {
  id: string;
  name: string;
  shortName: string;
  commonName: string;
  title: string;
  order: number;
  numberOfChapters: number;
  totalNumberOfVerses: number;
  isApocryphal: boolean;
  chapters: HelloaoChapter[];
};

/** Translation metadata in helloao output. */
export type HelloaoTranslation = {
  id: string;
  name: string;
  englishName: string;
  shortName: string;
  textDirection: string;
  language: string;
  website: string;
  licenseUrl: string;
  numberOfBooks: number;
  totalNumberOfChapters: number;
  totalNumberOfVerses: number;
  availableFormats: string[];
};

/** Top-level helloao-compatible output structure. */
export type HelloaoOutput = {
  translation: HelloaoTranslation;
  books: HelloaoBook[];
};
