/**
 * anania-pipeline.ts
 *
 * Pipeline:
 *  1) Read the Anania Bible from a local PDF file.
 *     Path is read from ANANIA_PDF_PATH in ../.env, falling back to
 *     data/bibles/anania-source.pdf.
 *  2) Extract the raw text from every PDF page.
 *  3) Parse book, chapter, and verse boundaries using Romanian heading
 *     patterns and the static booksConfig table.
 *  4) Detect superscript note markers in verse text, record the word they
 *     are attached to, then strip them before saving.
 *  5) Parse footnote blocks that follow the verse text of each chapter.
 *  6) Build a helloao-compatible JSON structure and write to
 *     data/bibles/ro_anania.json.
 *  7) Optionally bulk-insert all collected notes into PostgreSQL
 *     (anania_adnotari table) when DATABASE_URL is set.
 *
 * Run:  npm run anania-pipeline
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import * as fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import { Pool } from 'pg';

import {
  BIBLES_DIR,
  type Verse,
  type BaseBookConfig,
  validateEnglishNames,
  buildChapterEntry,
  buildBookEntry,
  writeOutput,
} from './shared';

// ─── Constants ───────────────────────────────────────────────────────────────

const TRANSLATION_ID = 'ro_anania';

const DOWNLOAD_LINK = 'https://dervent.ro/biblia/Biblia-ANANIA.pdf';

/** Maximum chapter number per book (Psalms has 150, the highest in the Bible). */
const MAX_CHAPTER_NUMBER = 150;

/** Maximum footnote/note number we accept (Anania notes can go up to ~15 per chapter). */
const MAX_NOTE_NUMBER = 20;

/**
 * Path to the source PDF.
 *  - First checks ANANIA_PDF_PATH env var (loaded from ../.env).
 *  - Falls back to data/bibles/anania-source.pdf.
 */
const PDF_SOURCE = process.env['ANANIA_PDF_PATH']
  ? path.resolve(process.env['ANANIA_PDF_PATH'])
  : path.resolve(BIBLES_DIR, 'anania-source.pdf');

// ─── Types ───────────────────────────────────────────────────────────────────

/** Anania-specific book config extends the shared base with Romanian names. */
type BookConfig = BaseBookConfig & {
  /** Full Romanian book name as it appears in the PDF headings.
   *  Used as the primary matching key (case-insensitive). */
  pdfHeading: string;
  /** Optional alternative heading forms that may appear in some PDF editions. */
  altHeadings?: string[];
};

/** A single extracted Anania footnote / annotation. */
type AnaniaNote = {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  note_number: number;
  note_text: string;
  metadata: {
    attached_to_word?: string;
    original_marker?: string;
  } | null;
};

/** Result returned by parseBookText: parsed verses + extracted notes. */
type ParseResult = {
  chapters: Map<number, Verse[]>;
  notes: AnaniaNote[];
};

// ─── Static books configuration ──────────────────────────────────────────────
//
// pdfHeading values are the Romanian book headings typically found in Anania
// Bible PDFs.  They are matched case-insensitively against the extracted text.
//
// order values follow the helloao bookOrderMap:
//   canonical Protestant canon:  GEN=1 … REV=66
//   apocryphal/deuterocanonical: TOB=67, JDT=68, ESG=69, WIS=70, SIR=71,
//     BAR=72, LJE=73, S3Y=74, SUS=75, BEL=76, 1MA=77, 2MA=78, 3MA=79,
//     4MA=80, 1ES=81, 2ES=82, MAN=83, PS2=84 …

const booksConfig: BookConfig[] = [
  // ── Pentateuch ──────────────────────────────────────────────────────────
  { order: 1,  usfmCode: 'GEN', pdfHeading: 'Facerea',                                  nameAbbrev: 'Fac'    },
  { order: 2,  usfmCode: 'EXO', pdfHeading: 'Ieșirea',           altHeadings: ['Iesirea'],                          nameAbbrev: 'Ieș'    },
  { order: 3,  usfmCode: 'LEV', pdfHeading: 'Leviticul',                                nameAbbrev: 'Lev'    },
  { order: 4,  usfmCode: 'NUM', pdfHeading: 'Numerii',           altHeadings: ['Numeri'],                           nameAbbrev: 'Num'    },
  { order: 5,  usfmCode: 'DEU', pdfHeading: 'Deuteronomul',                             nameAbbrev: 'Deut'   },

  // ── Historical books ─────────────────────────────────────────────────────
  { order: 6,  usfmCode: 'JOS', pdfHeading: 'Iosua Navi',       altHeadings: ['Iosua'],                            nameAbbrev: 'Ios'    },
  { order: 7,  usfmCode: 'JDG', pdfHeading: 'Judecătorii',      altHeadings: ['Judecatori', 'Judecători'],          nameAbbrev: 'Jud'    },
  { order: 8,  usfmCode: 'RUT', pdfHeading: 'Rut',              altHeadings: ['Ruta'],                              nameAbbrev: 'Rut'    },
  { order: 9,  usfmCode: '1SA', pdfHeading: 'Cartea întâi a Regilor',  altHeadings: ['I Regi', '1 Regi'],           nameAbbrev: '1Reg'   },
  { order: 10, usfmCode: '2SA', pdfHeading: 'Cartea a doua a Regilor', altHeadings: ['II Regi', '2 Regi'],          nameAbbrev: '2Reg'   },
  { order: 11, usfmCode: '1KI', pdfHeading: 'Cartea a treia a Regilor', altHeadings: ['III Regi', '3 Regi'],        nameAbbrev: '3Reg'   },
  { order: 12, usfmCode: '2KI', pdfHeading: 'Cartea a patra a Regilor', altHeadings: ['IV Regi', '4 Regi'],         nameAbbrev: '4Reg'   },
  { order: 13, usfmCode: '1CH', pdfHeading: 'Cartea întâi a Cronicilor', altHeadings: ['I Paralipomena', '1 Paralipomena', 'I Cronici'], nameAbbrev: '1Par' },
  { order: 14, usfmCode: '2CH', pdfHeading: 'Cartea a doua a Cronicilor', altHeadings: ['II Paralipomena', '2 Paralipomena', 'II Cronici'], nameAbbrev: '2Par' },
  { order: 15, usfmCode: 'EZR', pdfHeading: 'Cartea lui Ezdra', altHeadings: ['Ezdra', 'I Ezdra'],                 nameAbbrev: '2Ezd'   },
  { order: 16, usfmCode: 'NEH', pdfHeading: 'Cartea lui Neemia', altHeadings: ['Neemia'],                           nameAbbrev: 'Neem'   },
  { order: 17, usfmCode: 'EST', pdfHeading: 'Cartea Esterei',   altHeadings: ['Estera'],                            nameAbbrev: 'Est'    },
  { order: 67, usfmCode: 'TOB', pdfHeading: 'Cartea lui Tobit', altHeadings: ['Tobit'],                             nameAbbrev: 'Tob'    },
  { order: 68, usfmCode: 'JDT', pdfHeading: 'Cartea Iuditei',  altHeadings: ['Iudita'],                            nameAbbrev: 'Iudt'   },
  { order: 77, usfmCode: '1MA', pdfHeading: 'Cartea întâi a Macabeilor', altHeadings: ['I Macabei', '1 Macabei'],   nameAbbrev: '1Mac'   },
  { order: 78, usfmCode: '2MA', pdfHeading: 'Cartea a doua a Macabeilor', altHeadings: ['II Macabei', '2 Macabei'], nameAbbrev: '2Mac'   },
  { order: 79, usfmCode: '3MA', pdfHeading: 'Cartea a treia a Macabeilor', altHeadings: ['III Macabei', '3 Macabei'], nameAbbrev: '3Mac' },

  // ── Poetic / Wisdom books ────────────────────────────────────────────────
  { order: 18, usfmCode: 'JOB', pdfHeading: 'Cartea lui Iov',  altHeadings: ['Iov'],                               nameAbbrev: 'Iov'    },
  { order: 19, usfmCode: 'PSA', pdfHeading: 'Psalmii',         altHeadings: ['Psalmi', 'Cartea Psalmilor'],         nameAbbrev: 'Ps'     },
  { order: 83, usfmCode: 'MAN', pdfHeading: 'Rugăciunea lui Manase', altHeadings: ['Manase'],                       nameAbbrev: 'RgMan'  },
  { order: 20, usfmCode: 'PRO', pdfHeading: 'Proverbele lui Solomon', altHeadings: ['Pildele lui Solomon', 'Pilde', 'Proverbele'], nameAbbrev: 'Pild' },
  { order: 21, usfmCode: 'ECC', pdfHeading: 'Ecclesiastul',                                                         nameAbbrev: 'Eccl'   },
  { order: 22, usfmCode: 'SNG', pdfHeading: 'Cântarea Cântărilor', altHeadings: ['Cântări', 'Cantarea Cantarilor'], nameAbbrev: 'Cânt'   },
  { order: 70, usfmCode: 'WIS', pdfHeading: 'Înțelepciunea lui Solomon', altHeadings: ['Solomon'],                  nameAbbrev: 'ÎnțSol' },
  { order: 71, usfmCode: 'SIR', pdfHeading: 'Înțelepciunea lui Isus, fiul lui Sirah', altHeadings: ['Ecclesiasticul', 'Sirah'], nameAbbrev: 'Sir' },
  { order: 81, usfmCode: '1ES', pdfHeading: 'Cartea a treia a lui Ezdra', altHeadings: ['III Ezdra', '3 Ezdra'],   nameAbbrev: '1Ezd'   },

  // ── Major prophets ───────────────────────────────────────────────────────
  { order: 23, usfmCode: 'ISA', pdfHeading: 'Isaia',            altHeadings: ['Cartea lui Isaia'],                  nameAbbrev: 'Is'     },
  { order: 24, usfmCode: 'JER', pdfHeading: 'Ieremia',          altHeadings: ['Cartea lui Ieremia'],                nameAbbrev: 'Ier'    },
  { order: 25, usfmCode: 'LAM', pdfHeading: 'Plângerile lui Ieremia', altHeadings: ['Plângeri', 'Plangeri'],        nameAbbrev: 'Plâng'  },
  { order: 72, usfmCode: 'BAR', pdfHeading: 'Baruh',            altHeadings: ['Cartea lui Baruh'],                  nameAbbrev: 'Bar'    },
  { order: 73, usfmCode: 'LJE', pdfHeading: 'Epistola lui Ieremia', altHeadings: ['Scrisoarea lui Ieremia'],        nameAbbrev: 'EpIer'  },
  { order: 26, usfmCode: 'EZK', pdfHeading: 'Iezechiel',       altHeadings: ['Cartea lui Iezechiel'],               nameAbbrev: 'Iez'    },
  { order: 27, usfmCode: 'DAN', pdfHeading: 'Daniel',           altHeadings: ['Cartea lui Daniel'],                 nameAbbrev: 'Dan'    },
  { order: 74, usfmCode: 'S3Y', pdfHeading: 'Cântarea celor trei tineri', altHeadings: ['3 tineri'],                nameAbbrev: 'S3Y'    },
  { order: 75, usfmCode: 'SUS', pdfHeading: 'Istoria Susanei',  altHeadings: ['Susana'],                            nameAbbrev: 'Sus'    },
  { order: 76, usfmCode: 'BEL', pdfHeading: 'Bel și balaurul',  altHeadings: ['Bel si balaurul', 'Balaurul și Bel'], nameAbbrev: 'Bel'   },

  // ── Minor prophets ───────────────────────────────────────────────────────
  { order: 28, usfmCode: 'HOS', pdfHeading: 'Osea',             altHeadings: ['Cartea lui Osea'],                   nameAbbrev: 'Os'     },
  { order: 29, usfmCode: 'JOL', pdfHeading: 'Ioil',             altHeadings: ['Cartea lui Ioil'],                   nameAbbrev: 'Ioel'   },
  { order: 30, usfmCode: 'AMO', pdfHeading: 'Amos',             altHeadings: ['Cartea lui Amos'],                   nameAbbrev: 'Amos'   },
  { order: 31, usfmCode: 'OBA', pdfHeading: 'Avdia',            altHeadings: ['Obadia'],                            nameAbbrev: 'Obad'   },
  { order: 32, usfmCode: 'JON', pdfHeading: 'Iona',             altHeadings: ['Cartea lui Iona'],                   nameAbbrev: 'Ion'    },
  { order: 33, usfmCode: 'MIC', pdfHeading: 'Miheia',           altHeadings: ['Cartea lui Miheia', 'Mica'],         nameAbbrev: 'Mica'   },
  { order: 34, usfmCode: 'NAM', pdfHeading: 'Naum',             altHeadings: ['Cartea lui Naum'],                   nameAbbrev: 'Naum'   },
  { order: 35, usfmCode: 'HAB', pdfHeading: 'Avacum',           altHeadings: ['Cartea lui Avacum', 'Habacuc'],      nameAbbrev: 'Hab'    },
  { order: 36, usfmCode: 'ZEP', pdfHeading: 'Sofonie',          altHeadings: ['Cartea lui Sofonie'],                nameAbbrev: 'Sof'    },
  { order: 37, usfmCode: 'HAG', pdfHeading: 'Agheu',            altHeadings: ['Cartea lui Agheu', 'Hagai'],         nameAbbrev: 'Ag'     },
  { order: 38, usfmCode: 'ZEC', pdfHeading: 'Zaharia',          altHeadings: ['Cartea lui Zaharia'],                nameAbbrev: 'Zah'    },
  { order: 39, usfmCode: 'MAL', pdfHeading: 'Maleahi',          altHeadings: ['Cartea lui Maleahi'],                nameAbbrev: 'Mal'    },

  // ── New Testament ────────────────────────────────────────────────────────
  { order: 40, usfmCode: 'MAT', pdfHeading: 'Evanghelia după Matei',       altHeadings: ['Sfânta Evanghelie după Matei', 'Matei'],  nameAbbrev: 'Mat'  },
  { order: 41, usfmCode: 'MRK', pdfHeading: 'Evanghelia după Marcu',       altHeadings: ['Sfânta Evanghelie după Marcu', 'Marcu'],  nameAbbrev: 'Mc'   },
  { order: 42, usfmCode: 'LUK', pdfHeading: 'Evanghelia după Luca',        altHeadings: ['Sfânta Evanghelie după Luca', 'Luca'],    nameAbbrev: 'Lc'   },
  { order: 43, usfmCode: 'JHN', pdfHeading: 'Evanghelia după Ioan',        altHeadings: ['Sfânta Evanghelie după Ioan', 'Ioan'],    nameAbbrev: 'In'   },
  { order: 44, usfmCode: 'ACT', pdfHeading: 'Faptele Apostolilor',         altHeadings: ['Faptele Sfinților Apostoli'],             nameAbbrev: 'FA'   },
  { order: 45, usfmCode: 'ROM', pdfHeading: 'Epistola către Romani',       altHeadings: ['Romani'],                                 nameAbbrev: 'Rom'  },
  { order: 46, usfmCode: '1CO', pdfHeading: 'Epistola întâi către Corinteni', altHeadings: ['I Corinteni', '1 Corinteni'],          nameAbbrev: '1Cor' },
  { order: 47, usfmCode: '2CO', pdfHeading: 'Epistola a doua către Corinteni', altHeadings: ['II Corinteni', '2 Corinteni'],        nameAbbrev: '2Cor' },
  { order: 48, usfmCode: 'GAL', pdfHeading: 'Epistola către Galateni',     altHeadings: ['Galateni'],                               nameAbbrev: 'Gal'  },
  { order: 49, usfmCode: 'EPH', pdfHeading: 'Epistola către Efeseni',      altHeadings: ['Efeseni'],                                nameAbbrev: 'Ef'   },
  { order: 50, usfmCode: 'PHP', pdfHeading: 'Epistola către Filipeni',     altHeadings: ['Filipeni'],                               nameAbbrev: 'Flp'  },
  { order: 51, usfmCode: 'COL', pdfHeading: 'Epistola către Coloseni',     altHeadings: ['Coloseni'],                               nameAbbrev: 'Col'  },
  { order: 52, usfmCode: '1TH', pdfHeading: 'Epistola întâi către Tesaloniceni', altHeadings: ['I Tesaloniceni', '1 Tesaloniceni'], nameAbbrev: '1Tes' },
  { order: 53, usfmCode: '2TH', pdfHeading: 'Epistola a doua către Tesaloniceni', altHeadings: ['II Tesaloniceni', '2 Tesaloniceni'], nameAbbrev: '2Tes' },
  { order: 54, usfmCode: '1TI', pdfHeading: 'Epistola întâi către Timotei', altHeadings: ['I Timotei', '1 Timotei'],                nameAbbrev: '1Tim' },
  { order: 55, usfmCode: '2TI', pdfHeading: 'Epistola a doua către Timotei', altHeadings: ['II Timotei', '2 Timotei'],              nameAbbrev: '2Tim' },
  { order: 56, usfmCode: 'TIT', pdfHeading: 'Epistola către Tit',          altHeadings: ['Tit'],                                    nameAbbrev: 'Tit'  },
  { order: 57, usfmCode: 'PHM', pdfHeading: 'Epistola către Filimon',      altHeadings: ['Filimon'],                                nameAbbrev: 'Flm'  },
  { order: 58, usfmCode: 'HEB', pdfHeading: 'Epistola către Evrei',        altHeadings: ['Evrei'],                                  nameAbbrev: 'Evr'  },
  { order: 59, usfmCode: 'JAS', pdfHeading: 'Epistola lui Iacob',          altHeadings: ['Iacob', 'Epistola Sobornicească a lui Iacob'],  nameAbbrev: 'Iac' },
  { order: 60, usfmCode: '1PE', pdfHeading: 'Epistola întâi a lui Petru',  altHeadings: ['I Petru', '1 Petru'],                     nameAbbrev: '1Pet' },
  { order: 61, usfmCode: '2PE', pdfHeading: 'Epistola a doua a lui Petru', altHeadings: ['II Petru', '2 Petru'],                    nameAbbrev: '2Pet' },
  { order: 62, usfmCode: '1JN', pdfHeading: 'Epistola întâi a lui Ioan',   altHeadings: ['I Ioan', '1 Ioan'],                       nameAbbrev: '1In'  },
  { order: 63, usfmCode: '2JN', pdfHeading: 'Epistola a doua a lui Ioan',  altHeadings: ['II Ioan', '2 Ioan'],                      nameAbbrev: '2In'  },
  { order: 64, usfmCode: '3JN', pdfHeading: 'Epistola a treia a lui Ioan', altHeadings: ['III Ioan', '3 Ioan'],                     nameAbbrev: '3In'  },
  { order: 65, usfmCode: 'JUD', pdfHeading: 'Epistola lui Iuda',           altHeadings: ['Iuda'],                                   nameAbbrev: 'Iud'  },
  { order: 66, usfmCode: 'REV', pdfHeading: 'Apocalipsa',                  altHeadings: ['Apocalipsa lui Ioan'],                    nameAbbrev: 'Apoc' },
];

// Startup validation: every usfmCode must have an English name entry
validateEnglishNames(booksConfig);

// ─── Superscript handling ─────────────────────────────────────────────────────

/**
 * Unicode superscript digits mapped to their ASCII equivalents:
 *   ⁰ (U+2070)→0, ¹ (U+00B9)→1, ² (U+00B2)→2, ³ (U+00B3)→3,
 *   ⁴ (U+2074)→4, ⁵ (U+2075)→5, ⁶ (U+2076)→6, ⁷ (U+2077)→7,
 *   ⁸ (U+2078)→8, ⁹ (U+2079)→9
 */
const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

const SUPERSCRIPT_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;

/**
 * Matches 1–2 digits that appear directly after a Unicode letter with no
 * intervening space, followed by punctuation / whitespace / end-of-string.
 *
 * This catches superscript markers that pdf-parse renders as regular digits,
 * e.g. "Dumnezeu6:" → the "6" is a note marker, not part of the word.
 *
 * Uses a lookbehind for \p{L} (any Unicode letter) so the letter itself is
 * not consumed by the match.
 */
const INLINE_SUPERSCRIPT_RE = /(?<=\p{L})(\d{1,2})(?=[\s:;,.\-"'!?„""—–\)\]\/>]|$)/gu;

function superscriptToNumber(sup: string): number {
  const digits = sup.split('').map(c => SUPERSCRIPT_MAP[c]).filter(d => d !== undefined).join('');
  const result = parseInt(digits, 10);
  return isNaN(result) ? -1 : result;
}

function stripSuperscripts(text: string): string {
  // Strip Unicode superscript digits (¹²³ etc.)
  let result = text.replace(SUPERSCRIPT_RE, '');
  // Strip inline digit superscripts rendered as regular digits by pdf-parse
  result = result.replace(/(?<=\p{L})\d{1,2}(?=[\s:;,.\-"'!?„""—–\)\]\/>]|$)/gu, '');
  return result.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Finds the word immediately preceding a superscript marker in a text string.
 * Returns undefined if no word is found.
 */
function findWordBefore(text: string, matchIndex: number): string | undefined {
  const before = text.slice(0, matchIndex);
  const wordMatch = before.match(/(\S+)\s*$/);
  return wordMatch ? wordMatch[1] : undefined;
}

// ─── Text normalization ───────────────────────────────────────────────────────

/**
 * Normalizes a string for comparison: lowercases, unifies the Romanian
 * î/â pair (same phoneme /ɨ/, different letters depending on position /
 * orthographic era), strips diacritics, and collapses whitespace.
 *
 * Both î and â are replaced with 'x' as a neutral placeholder before
 * NFD processing, avoiding collisions with real 'a' or 'i' in names.
 */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[îâ]/g, 'x')   // unify î/â (same phoneme) with a neutral char
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── PDF parsing helpers ──────────────────────────────────────────────────────

/**
 * Builds a lookup map: normalizedHeading → BookConfig.
 * Includes both pdfHeading and all altHeadings.
 */
function buildHeadingMap(): Map<string, BookConfig> {
  const map = new Map<string, BookConfig>();
  for (const book of booksConfig) {
    const headings = [book.pdfHeading, ...(book.altHeadings ?? [])];
    for (const h of headings) {
      map.set(normalizeForMatch(h), book);
    }
  }
  return map;
}

/**
 * Matches chapter headings:
 *  - "Capitolul 3", "Cap. 12" (explicit keyword)
 *  - "Psalmul 23", "Ps. 119" (Psalms)
 *  - "3", "12" (standalone 1–3 digit number on its own line — common in
 *    many Romanian Bible PDF editions where chapter numbers appear alone)
 */
const CHAPTER_HEADING_RE = /^\s*(?:(?:Capitolul|Cap\.?|Psalmul|Ps\.?)\s+)?(\d{1,3})\s*$/i;

/** Matches verse-number prefixed text: "1. In inceput...", "12 Text..." */
const VERSE_RE = /^(\d+)[.\s]\s*(.+)/;

/** Matches a footnote line: superscript digits optionally followed by =/:. then text. */
const NOTE_LINE_RE = /^([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*[=:.]?\s*(.+)/;

/**
 * Matches a footnote line using regular digits with a required separator
 * (= or :), to distinguish from verse-number lines.
 * Examples: "6 = Aceasta este nota", "12: Nota explicativă"
 */
const DIGIT_NOTE_LINE_RE = /^(\d{1,2})\s*[=:]\s*(.+)/;

/**
 * A raw text segment belonging to one book, as extracted from the PDF.
 */
type BookTextSegment = {
  book: BookConfig;
  displayName: string;
  text: string;
};

/**
 * Splits the full PDF text into per-book segments by searching for book
 * heading lines.
 *
 * Strategy: scan every line; when a line matches a known book heading,
 * start a new segment.  Lines before the first heading are discarded
 * (front matter, table of contents, etc.).
 *
 * Heading matching is attempted in two passes:
 *  1) Exact match (after normalization) against headingMap.
 *  2) If no exact match, strip a trailing number (handles PDF formats like
 *     "FACEREA 1" where the chapter number is on the same line as the book
 *     title).  When this matches, the extracted chapter number is prepended
 *     as a synthetic "Capitolul N" line to the segment text so the chapter
 *     parser picks it up automatically.
 */
function splitIntoBookSegments(fullText: string): BookTextSegment[] {
  const headingMap = buildHeadingMap();
  const lines = fullText.split('\n');

  const segments: BookTextSegment[] = [];
  let currentBook: BookConfig | null = null;
  let currentName = '';
  let currentLines: string[] = [];

  const unmatchedCandidates: string[] = [];   // for debug logging

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBook) currentLines.push('');
      continue;
    }

    // ── Heading detection ─────────────────────────────────────────────────
    const normalized = normalizeForMatch(trimmed);
    let matchedBook = headingMap.get(normalized);
    let headingChapter: number | undefined;

    // Pass 2: try stripping a trailing chapter number
    // (handles "FACEREA 1", "IESIREA 2", etc.)
    if (!matchedBook) {
      const trailingMatch = normalized.match(/^(.+?)\s+(\d{1,3})$/);
      if (trailingMatch) {
        matchedBook = headingMap.get(trailingMatch[1]);
        if (matchedBook) {
          headingChapter = parseInt(trailingMatch[2], 10);
        }
      }
    }

    if (matchedBook) {
      // Flush the previous book segment
      if (currentBook && currentLines.length > 0) {
        segments.push({
          book: currentBook,
          displayName: currentName,
          text: currentLines.join('\n'),
        });
      }
      currentBook = matchedBook;
      currentName = trimmed; // keep the original casing from the PDF
      currentLines = [];
      // If the heading included a chapter number, inject a synthetic heading
      if (headingChapter) {
        currentLines.push(`Capitolul ${headingChapter}`);
      }
      continue;
    }

    // Collect short non-numeric lines as potential unmatched headings (for debug)
    if (!currentBook && trimmed.length < 80 && !/^\d/.test(trimmed)) {
      unmatchedCandidates.push(trimmed);
    }

    if (currentBook) {
      currentLines.push(trimmed);
    }
  }

  // Flush the last segment
  if (currentBook && currentLines.length > 0) {
    segments.push({
      book: currentBook,
      displayName: currentName,
      text: currentLines.join('\n'),
    });
  }

  // Debug: show potential unmatched headings to help diagnose missing books
  if (unmatchedCandidates.length > 0) {
    const unique = [...new Set(unmatchedCandidates)].slice(0, 30);
    console.log('\n[DEBUG] Sample lines before the first matched heading (potential unrecognized headings):');
    for (const h of unique) {
      console.log(`  "${h}"`);
    }
  }

  return segments;
}

/**
 * Detects all superscript markers in a piece of text and returns an array of
 * { noteNumber, attachedWord, originalMarker } entries.
 *
 * Handles both:
 *  - Unicode superscript digits (¹²³ etc.) — some PDF editions preserve them
 *  - Regular digits rendered inline after a letter (e.g. "Dumnezeu6:") — the
 *    common case when pdf-parse converts superscripts to plain digits
 */
function detectSuperscripts(
  text: string,
  bookCode: string,
  chapter: number,
  verseNum: number,
): { noteNumber: number; attachedWord: string | undefined; originalMarker: string }[] {
  const results: { noteNumber: number; attachedWord: string | undefined; originalMarker: string }[] = [];
  let match: RegExpExecArray | null;

  // 1) Unicode superscript digits
  const unicodeRe = new RegExp(SUPERSCRIPT_RE.source, 'g');
  while ((match = unicodeRe.exec(text)) !== null) {
    const noteNumber = superscriptToNumber(match[0]);
    if (noteNumber < 0) continue;
    const attachedWord = findWordBefore(text, match.index);
    results.push({ noteNumber, attachedWord, originalMarker: match[0] });
  }

  // 2) Inline regular digits directly after a letter (pdf-parse artefact)
  const inlineRe = new RegExp(INLINE_SUPERSCRIPT_RE.source, 'gu');
  while ((match = inlineRe.exec(text)) !== null) {
    const noteNumber = parseInt(match[1], 10);
    if (noteNumber <= 0 || noteNumber > MAX_NOTE_NUMBER) continue;
    const attachedWord = findWordBefore(text, match.index);
    // Avoid duplicates if Unicode detection already found this number
    if (!results.some(r => r.noteNumber === noteNumber)) {
      results.push({ noteNumber, attachedWord, originalMarker: match[1] });
    }
  }

  for (const r of results) {
    console.log(
      `Detected superscript ${r.noteNumber} attached to word '${r.attachedWord ?? '?'}' on ${bookCode} ${chapter}:${verseNum}`,
    );
  }
  return results;
}

/**
 * Parses a book's raw text into chapters, each containing an array of verses,
 * plus any footnote annotations found in the text.
 *
 * Heuristics:
 *  - Lines matching CHAPTER_HEADING_RE start a new chapter.
 *  - Lines matching VERSE_RE (starting with a number) start a new verse.
 *  - Other lines are continuation text appended to the current verse.
 *  - If no explicit "Capitolul" heading is found before the first verse,
 *    chapter 1 is assumed (some single-chapter books omit the heading).
 *  - Lines matching NOTE_LINE_RE (starting with superscript digits) after
 *    verse text are treated as footnote lines for the current chapter.
 *  - Before saving verse text, superscripts are detected (for notes) then stripped.
 */
function parseBookText(text: string, bookCode: string): ParseResult {
  const chapters = new Map<number, Verse[]>();
  const notes: AnaniaNote[] = [];
  let currentChapter = 0; // 0 = not yet inside a chapter
  let currentVerses: Verse[] = [];
  let lastVerse: Verse | null = null;

  // Track superscripts detected per chapter: noteNumber → { verse, attachedWord, originalMarker }
  type SuperscriptInfo = { verse: number; attachedWord: string | undefined; originalMarker: string };
  let chapterSuperscripts: Map<number, SuperscriptInfo> = new Map();

  // Accumulate note lines per chapter: noteNumber → noteText
  let chapterNoteLines: Map<number, string> = new Map();

  /**
   * Flushes a completed chapter: merges detected superscripts with note lines
   * and produces AnaniaNote entries.
   */
  function flushChapter(): void {
    if (currentChapter > 0 && currentVerses.length > 0) {
      chapters.set(currentChapter, currentVerses);

      // Build notes from chapterNoteLines, associating with superscript info
      for (const [noteNum, noteText] of chapterNoteLines) {
        const supInfo = chapterSuperscripts.get(noteNum);
        notes.push({
          book: bookCode,
          chapter: currentChapter,
          verse_start: supInfo?.verse ?? currentVerses[currentVerses.length - 1].number,
          verse_end: null,
          note_number: noteNum,
          note_text: noteText,
          metadata: supInfo
            ? { attached_to_word: supInfo.attachedWord, original_marker: supInfo.originalMarker }
            : null,
        });
      }

      // Also create note entries for detected superscripts that have no note-line text
      for (const [noteNum, supInfo] of chapterSuperscripts) {
        if (!chapterNoteLines.has(noteNum)) {
          notes.push({
            book: bookCode,
            chapter: currentChapter,
            verse_start: supInfo.verse,
            verse_end: null,
            note_number: noteNum,
            note_text: '',
            metadata: { attached_to_word: supInfo.attachedWord, original_marker: supInfo.originalMarker },
          });
        }
      }
    }
  }

  /**
   * Scans a raw verse text for superscript markers, records them, then returns
   * the text with superscripts stripped.
   */
  function processVerseText(rawText: string, chapter: number, verseNum: number): string {
    const found = detectSuperscripts(rawText, bookCode, chapter, verseNum);
    for (const f of found) {
      // Keep the last occurrence if a superscript number appears more than once
      chapterSuperscripts.set(f.noteNumber, {
        verse: verseNum,
        attachedWord: f.attachedWord,
        originalMarker: f.originalMarker,
      });
    }
    return stripSuperscripts(rawText);
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for chapter heading
    const chapMatch = trimmed.match(CHAPTER_HEADING_RE);
    if (chapMatch) {
      const chapNum = parseInt(chapMatch[1], 10);
      // Only accept reasonable chapter numbers (1–MAX_CHAPTER_NUMBER)
      if (chapNum >= 1 && chapNum <= MAX_CHAPTER_NUMBER) {
        // Flush current chapter (including notes)
        flushChapter();
        currentChapter = chapNum;
        currentVerses = [];
        lastVerse = null;
        chapterSuperscripts = new Map();
        chapterNoteLines = new Map();
        continue;
      }
    }

    // Check for note line (Unicode superscript format: ⁶ = text)
    const noteMatch = trimmed.match(NOTE_LINE_RE);
    if (noteMatch && currentChapter > 0) {
      const noteNum = superscriptToNumber(noteMatch[1]);
      if (noteNum >= 0) {
        const existing = chapterNoteLines.get(noteNum);
        chapterNoteLines.set(noteNum, existing ? existing + ' ' + noteMatch[2].trim() : noteMatch[2].trim());
        continue;
      }
    }

    // Check for note line (regular digit format: "6 = text", "12: text")
    // Must be checked BEFORE verse regex to avoid misinterpreting "6 = note" as verse 6
    const digitNoteMatch = trimmed.match(DIGIT_NOTE_LINE_RE);
    if (digitNoteMatch && currentChapter > 0) {
      const noteNum = parseInt(digitNoteMatch[1], 10);
      if (noteNum > 0 && noteNum <= MAX_NOTE_NUMBER) {
        const existing = chapterNoteLines.get(noteNum);
        chapterNoteLines.set(noteNum, existing ? existing + ' ' + digitNoteMatch[2].trim() : digitNoteMatch[2].trim());
        continue;
      }
    }

    // Check for verse start
    const verseMatch = trimmed.match(VERSE_RE);
    if (verseMatch) {
      const vnum = parseInt(verseMatch[1], 10);
      const rawVtext = verseMatch[2].trim();

      // Assume chapter 1 if we encounter verses before any chapter heading
      if (currentChapter === 0) {
        currentChapter = 1;
      }

      // Accept any positive verse number (PDFs may have non-sequential numbering)
      if (vnum > 0) {
        const vtext = processVerseText(rawVtext, currentChapter, vnum);
        lastVerse = { number: vnum, text: vtext };
        currentVerses.push(lastVerse);
        continue;
      }
    }

    // Continuation line: append to the last verse of the current chapter
    if (lastVerse) {
      const cleanedCont = processVerseText(trimmed, currentChapter, lastVerse.number);
      lastVerse.text += ' ' + cleanedCont;
    }
  }

  // Flush the last chapter
  flushChapter();

  return { chapters, notes };
}

// ─── Database insertion ───────────────────────────────────────────────────────

async function insertNotesIntoDatabase(notes: AnaniaNote[]): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.log('\nDATABASE_URL not set – skipping database insertion.');
    return;
  }
  if (notes.length === 0) {
    console.log('\nNo notes to insert into database.');
    return;
  }

  console.log(`\nInserting ${notes.length} Anania notes into database...`);
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM anania_adnotari');

    // Bulk insert using parameterised VALUES
    const BATCH_SIZE = 500;
    for (let i = 0; i < notes.length; i += BATCH_SIZE) {
      const batch = notes.slice(i, i + BATCH_SIZE);
      const placeholders: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const note of batch) {
        placeholders.push(
          `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6})`,
        );
        values.push(
          note.book,
          note.chapter,
          note.verse_start,
          note.verse_end,
          note.note_number,
          note.note_text,
          note.metadata ? JSON.stringify(note.metadata) : null,
        );
        idx += 7;
      }

      await client.query(
        `INSERT INTO anania_adnotari
           (book, chapter, verse_start, verse_end, note_number, note_text, metadata)
         VALUES ${placeholders.join(', ')}`,
        values,
      );
    }

    await client.query('COMMIT');
    console.log(`  ✓ Inserted ${notes.length} notes into anania_adnotari.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Biblia Anania Pipeline (PDF source) ===\n');

  // ── Step 1: read and parse the PDF ────────────────────────────────────────
  console.log(`Reading PDF from: ${PDF_SOURCE}`);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await fs.readFile(PDF_SOURCE) as Buffer;
  } catch {
    console.error(
      `\n❌ Cannot read PDF file at:\n   ${PDF_SOURCE}\n\n` +
      `   Please download the Anania Bible PDF from:\n` +
      `     ${DOWNLOAD_LINK}\n\n` +
      `   Then either:\n` +
      `     • Place it at data/bibles/anania-source.pdf, or\n` +
      `     • Set ANANIA_PDF_PATH in your .env file to the PDF path.\n` +
      `   The file is .gitignore'd and will not be committed.\n`,
    );
    process.exit(1);
  }

  console.log(`PDF file size: ${(pdfBuffer.length / (1024 * 1024)).toFixed(1)} MB`);

  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
  const pdfData = await parser.getText();
  console.log(`Extracted ${pdfData.total} pages, ${pdfData.text.length} characters of text.\n`);

  // ── Step 2: split text into per-book segments ─────────────────────────────
  const segments = splitIntoBookSegments(pdfData.text);
  console.log(`Identified ${segments.length} book segment(s) in the PDF.\n`);

  if (segments.length === 0) {
    console.error(
      '❌ No book headings were detected in the PDF text.\n' +
      '   Ensure the PDF contains the Anania Bible with standard Romanian book headings.\n',
    );
    process.exit(1);
  }

  // Deduplicate: if the same book appears more than once, keep the segment
  // with the most text content (avoids false-positive short matches from
  // cross-references that happen to be standalone lines matching a heading).
  const segmentMap = new Map<string, BookTextSegment>();
  for (const seg of segments) {
    const existing = segmentMap.get(seg.book.usfmCode);
    if (!existing || seg.text.length > existing.text.length) {
      segmentMap.set(seg.book.usfmCode, seg);
    }
  }
  const uniqueSegments = [...segmentMap.values()];

  // ── Step 3: parse chapters, verses, and notes from each book segment ──────
  const sorted = [...uniqueSegments].sort((a, b) => a.book.order - b.book.order);
  let totalChapters = 0;
  let totalVerses = 0;
  const books = [];
  const allNotes: AnaniaNote[] = [];

  for (const segment of sorted) {
    const { book, displayName } = segment;
    console.log(`[${book.usfmCode}] ${displayName}`);

    const { chapters: chapterMap, notes: bookNotes } = parseBookText(segment.text, book.usfmCode);
    allNotes.push(...bookNotes);

    if (chapterMap.size === 0) {
      console.warn(`  [SKIP] No chapters/verses parsed for ${book.usfmCode}`);
      continue;
    }

    const chapterNums = [...chapterMap.keys()].sort((a, b) => a - b);
    const chapters = [];
    let bookVerses = 0;

    for (const chapNum of chapterNums) {
      const verses = chapterMap.get(chapNum)!;
      chapters.push(buildChapterEntry(chapNum, displayName, verses));
      bookVerses += verses.length;
    }

    totalChapters += chapters.length;
    totalVerses += bookVerses;

    books.push(buildBookEntry({
      usfmCode: book.usfmCode,
      name: displayName,
      shortName: book.nameAbbrev,
      order: book.order,
      chapters,
      totalVerses: bookVerses,
    }));

    console.log(`  ✓ ${chapters.length} chapters, ${bookVerses} verses, ${bookNotes.length} notes`);
  }

  // ── Log books from booksConfig that were not found in the PDF ─────────────
  const foundCodes = new Set(books.map((b) => b.id));
  const missingBooks = booksConfig.filter((b) => !foundCodes.has(b.usfmCode));
  if (missingBooks.length > 0) {
    console.warn(
      `\n[WARN] ${missingBooks.length} book(s) in booksConfig were not found in the PDF:\n` +
      missingBooks.map((b) => `  "${b.pdfHeading}" (${b.usfmCode})`).join('\n') +
      '\n  Check that the PDF contains these books with matching headings.',
    );
  }

  // ── Step 4: write output ───────────────────────────────────────────────────
  const outputPath = await writeOutput(TRANSLATION_ID, {
    id: TRANSLATION_ID,
    name: 'Biblia Anania',
    englishName: 'Romanian Anania Bible',
    shortName: 'Anania',
    textDirection: 'ltr',
    language: 'ro',
    website: '',
    licenseUrl: '',
    numberOfBooks: books.length,
    totalNumberOfChapters: totalChapters,
    totalNumberOfVerses: totalVerses,
    availableFormats: ['json'],
  }, books);

  console.log('\n✅ JSON output complete.');
  console.log(`   Written: ${outputPath}`);
  console.log(`   ${books.length} books, ${totalChapters} chapters, ${totalVerses} verses`);
  console.log(`   ${allNotes.length} total annotation notes collected.`);

  // ── Step 5: insert notes into database (if DATABASE_URL is set) ────────────
  await insertNotesIntoDatabase(allNotes);

  console.log('\n✅ Pipeline complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
