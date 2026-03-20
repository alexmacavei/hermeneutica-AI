/**
 * anania-pipeline.ts
 *
 * Pipeline:
 *  1) Read the Anania Bible from a local PDF file.
 *     Expected location: data/bibles/anania-source.pdf
 *     (The user must place a legally-obtained copy there.)
 *  2) Extract the raw text from every PDF page.
 *  3) Parse book, chapter, and verse boundaries using Romanian heading
 *     patterns and the static booksConfig table.
 *  4) Build a helloao-compatible JSON structure and write to
 *     data/bibles/ro_anania.json.
 *
 * Run:  npm run anania-pipeline
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFParse } from 'pdf-parse';

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

/**
 * Path to the source PDF.  Users place their own legally-obtained copy here.
 * The file is .gitignore'd and never committed.
 */
const PDF_SOURCE = path.resolve(BIBLES_DIR, 'anania-source.pdf');

// ─── Types ───────────────────────────────────────────────────────────────────

/** Anania-specific book config extends the shared base with Romanian names. */
type BookConfig = BaseBookConfig & {
  /** Full Romanian book name as it appears in the PDF headings.
   *  Used as the primary matching key (case-insensitive). */
  pdfHeading: string;
  /** Optional alternative heading forms that may appear in some PDF editions. */
  altHeadings?: string[];
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

// ─── Text normalization ───────────────────────────────────────────────────────

/**
 * Normalizes a string for comparison: lowercases, strips diacritics,
 * collapses whitespace.
 */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
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

/** Matches chapter headings like "Capitolul 3", "Cap. 12". */
const CHAPTER_HEADING_RE = /^\s*(?:Capitolul|Cap\.?)\s+(\d+)\s*$/i;

/** Matches verse-number prefixed text: "1. In inceput...", "12 Text..." */
const VERSE_RE = /^(\d+)[.\s]\s*(.+)/;

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
 */
function splitIntoBookSegments(fullText: string): BookTextSegment[] {
  const headingMap = buildHeadingMap();
  const lines = fullText.split('\n');

  const segments: BookTextSegment[] = [];
  let currentBook: BookConfig | null = null;
  let currentName = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBook) currentLines.push('');
      continue;
    }

    // Check if this line is a book heading
    const normalized = normalizeForMatch(trimmed);
    const matchedBook = headingMap.get(normalized);

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
      continue;
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

  return segments;
}

/**
 * Parses a book's raw text into chapters, each containing an array of verses.
 *
 * Heuristics:
 *  - Lines matching CHAPTER_HEADING_RE start a new chapter.
 *  - Lines matching VERSE_RE (starting with a number) start a new verse.
 *  - Other lines are continuation text appended to the current verse.
 *  - If no explicit "Capitolul" heading is found before the first verse,
 *    chapter 1 is assumed (some single-chapter books omit the heading).
 */
function parseBookText(text: string): Map<number, Verse[]> {
  const chapters = new Map<number, Verse[]>();
  let currentChapter = 0; // 0 = not yet inside a chapter
  let currentVerses: Verse[] = [];
  let lastVerse: Verse | null = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for chapter heading
    const chapMatch = trimmed.match(CHAPTER_HEADING_RE);
    if (chapMatch) {
      // Flush current chapter
      if (currentChapter > 0 && currentVerses.length > 0) {
        chapters.set(currentChapter, currentVerses);
      }
      currentChapter = parseInt(chapMatch[1], 10);
      currentVerses = [];
      lastVerse = null;
      continue;
    }

    // Check for verse start
    const verseMatch = trimmed.match(VERSE_RE);
    if (verseMatch) {
      const vnum = parseInt(verseMatch[1], 10);
      const vtext = verseMatch[2].trim();

      // Assume chapter 1 if we encounter verses before any chapter heading
      if (currentChapter === 0) {
        currentChapter = 1;
      }

      // Accept any positive verse number (PDFs may have non-sequential numbering)
      if (vnum > 0) {
        lastVerse = { number: vnum, text: vtext };
        currentVerses.push(lastVerse);
        continue;
      }
    }

    // Continuation line: append to the last verse of the current chapter
    if (lastVerse) {
      lastVerse.text += ' ' + trimmed;
    }
  }

  // Flush the last chapter
  if (currentChapter > 0 && currentVerses.length > 0) {
    chapters.set(currentChapter, currentVerses);
  }

  return chapters;
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
      `   Please place a legally-obtained copy of the Anania Bible PDF at that path.\n` +
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

  // Deduplicate: if the same book appears more than once, keep only the first
  const seenCodes = new Set<string>();
  const uniqueSegments = segments.filter((s) => {
    if (seenCodes.has(s.book.usfmCode)) return false;
    seenCodes.add(s.book.usfmCode);
    return true;
  });

  // ── Step 3: parse chapters and verses from each book segment ──────────────
  const sorted = [...uniqueSegments].sort((a, b) => a.book.order - b.book.order);
  let totalChapters = 0;
  let totalVerses = 0;
  const books = [];

  for (const segment of sorted) {
    const { book, displayName } = segment;
    console.log(`[${book.usfmCode}] ${displayName}`);

    const chapterMap = parseBookText(segment.text);

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

    console.log(`  ✓ ${chapters.length} chapters, ${bookVerses} verses`);
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

  console.log('\n✅ Pipeline complete.');
  console.log(`   Written: ${outputPath}`);
  console.log(`   ${books.length} books, ${totalChapters} chapters, ${totalVerses} verses`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
