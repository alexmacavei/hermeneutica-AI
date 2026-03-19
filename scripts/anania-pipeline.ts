/**
 * anania-pipeline.ts
 *
 * Pipeline:
 *  1) Fetch the Old Testament index (https://biblia-online.ro/vechiul-testament)
 *     and the New Testament index (https://biblia-online.ro/noul-testament).
 *     In both pages the list of books lives inside:
 *       #root > div > div[class*="PageWrapper_wrapper"]
 *     Each <a> element there links to an individual book page.
 *  2) Scrape each discovered book chapter-by-chapter. Chapter pages follow the
 *     pattern /Biblie/Anania/<bookSlug>/<chapterNumber>. The readable content
 *     (title + verses) is inside #root > div on every chapter page.
 *  3) Build a helloao-compatible JSON structure and write to
 *     data/bibles/ro_anania.json.
 *
 * Run:  npm run anania-pipeline
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'https://biblia-online.ro';
const OT_INDEX_URL = `${BASE_URL}/vechiul-testament`;
const NT_INDEX_URL = `${BASE_URL}/noul-testament`;
/** CSS selector for the wrapper that contains the book-link list on index pages. */
const BOOK_LIST_SELECTOR = '#root > div > div[class*="PageWrapper_wrapper"]';
/** CSS selector for the main content container on chapter pages. */
const CHAPTER_CONTENT_SELECTOR = '#root > div';

const TRANSLATION_ID = 'ro_anania';
const BIBLES_DIR = path.resolve(__dirname, '../data/bibles');
const FINAL_OUTPUT = path.join(BIBLES_DIR, `${TRANSLATION_ID}.json`);

/** Maximum number of chapters probed when auto-detecting book length. */
const MAX_CHAPTER_PROBE = 200;
/** Delay (ms) between chapter probes during max-chapter detection. */
const CHAPTER_DETECTION_DELAY_MS = 500;
/** Delay (ms) between chapter fetches during the main scraping loop. */
const CHAPTER_FETCH_DELAY_MS = 300;

// ─── Types ───────────────────────────────────────────────────────────────────

/** A book entry discovered from the OT/NT index pages. */
type SiteBook = {
  /**
   * URL path to the book, e.g. "/Biblie/Anania/Facerea".
   * Chapter URLs are constructed as <bookPath>/<chapterNumber>.
   */
  bookPath: string;
  /** Display name extracted from the link text, e.g. "Facerea", "Evanghelia după Matei". */
  displayName: string;
};

type Verse = { number: number; text: string };

/** Static per-book metadata used for helloao JSON fields. */
type BookConfig = {
  /** Canonical helloao order (1-based). */
  order: number;
  /** USFM book code, e.g. "GEN", "MAT". */
  usfmCode: string;
  /**
   * Matching key: normalized form of the book display name on the site
   * (lowercase, diacritics stripped, spaces collapsed).
   * Must match the normalised link text in the index pages.
   */
  nameKey: string;
  /** Romanian abbreviation. */
  nameAbbrev: string;
};

// ─── Static books configuration ──────────────────────────────────────────────
//
// nameKey is the normalized (lowercase, diacritics stripped) form of the
// display name of the book as it appears in the link text on the OT/NT index
// pages of biblia-online.ro (e.g. "facerea", "matei"). It is used to match
// the runtime-discovered SiteBook entries to the canonical USFM codes.
//
// order values follow the helloao bookOrderMap:
//   canonical Protestant canon:  GEN=1 … REV=66
//   apocryphal/deuterocanonical: TOB=67, JDT=68, ESG=69, WIS=70, SIR=71,
//     BAR=72, LJE=73, S3Y=74, SUS=75, BEL=76, 1MA=77, 2MA=78, 3MA=79,
//     4MA=80, 1ES=81, 2ES=82, MAN=83, PS2=84 …

const booksConfig: BookConfig[] = [
  // ── Pentateuch ──────────────────────────────────────────────────────────
  { order: 1,  usfmCode: 'GEN', nameKey: 'facerea',                      nameAbbrev: 'Fac'    },
  { order: 2,  usfmCode: 'EXO', nameKey: 'iesirea',                      nameAbbrev: 'Ieș'    },
  { order: 3,  usfmCode: 'LEV', nameKey: 'leviticul',                    nameAbbrev: 'Lev'    },
  { order: 4,  usfmCode: 'NUM', nameKey: 'numerii',                      nameAbbrev: 'Num'    },
  { order: 5,  usfmCode: 'DEU', nameKey: 'deuteronomul',                 nameAbbrev: 'Deut'   },

  // ── Historical books ─────────────────────────────────────────────────────
  { order: 6,  usfmCode: 'JOS', nameKey: 'iosua',                        nameAbbrev: 'Ios'    },
  { order: 7,  usfmCode: 'JDG', nameKey: 'judecatorii',                  nameAbbrev: 'Jud'    },
  { order: 8,  usfmCode: 'RUT', nameKey: 'rut',                          nameAbbrev: 'Rut'    },
  { order: 9,  usfmCode: '1SA', nameKey: 'intaia regi',                  nameAbbrev: '1Reg'   },
  { order: 10, usfmCode: '2SA', nameKey: 'a doua regi',                  nameAbbrev: '2Reg'   },
  { order: 11, usfmCode: '1KI', nameKey: 'a treia regi',                 nameAbbrev: '3Reg'   },
  { order: 12, usfmCode: '2KI', nameKey: 'a patra regi',                 nameAbbrev: '4Reg'   },
  { order: 13, usfmCode: '1CH', nameKey: 'intaia paralipomena',          nameAbbrev: '1Par'   },
  { order: 14, usfmCode: '2CH', nameKey: 'a doua paralipomena',          nameAbbrev: '2Par'   },
  { order: 81, usfmCode: '1ES', nameKey: 'intaia ezra',                  nameAbbrev: '1Ezd'   },
  { order: 15, usfmCode: 'EZR', nameKey: 'a doua ezra',                  nameAbbrev: '2Ezd'   },
  { order: 16, usfmCode: 'NEH', nameKey: 'neemia',                       nameAbbrev: 'Neem'   },
  { order: 67, usfmCode: 'TOB', nameKey: 'tobit',                        nameAbbrev: 'Tob'    },
  { order: 68, usfmCode: 'JDT', nameKey: 'iudita',                       nameAbbrev: 'Iudt'   },
  { order: 17, usfmCode: 'EST', nameKey: 'estera',                       nameAbbrev: 'Est'    },
  { order: 77, usfmCode: '1MA', nameKey: 'intaia macabei',               nameAbbrev: '1Mac'   },
  { order: 78, usfmCode: '2MA', nameKey: 'a doua macabei',               nameAbbrev: '2Mac'   },
  { order: 79, usfmCode: '3MA', nameKey: 'a treia macabei',              nameAbbrev: '3Mac'   },

  // ── Poetic / Wisdom books ────────────────────────────────────────────────
  { order: 18, usfmCode: 'JOB', nameKey: 'iov',                          nameAbbrev: 'Iov'    },
  { order: 19, usfmCode: 'PSA', nameKey: 'psalmii',                      nameAbbrev: 'Ps'     },
  { order: 83, usfmCode: 'MAN', nameKey: 'rugaciunea lui manase',        nameAbbrev: 'RgMan'  },
  { order: 20, usfmCode: 'PRO', nameKey: 'pildele',                      nameAbbrev: 'Pild'   },
  { order: 21, usfmCode: 'ECC', nameKey: 'eclesiastul',                  nameAbbrev: 'Eccl'   },
  { order: 22, usfmCode: 'SNG', nameKey: 'cantarea cantarilor',          nameAbbrev: 'Cânt'   },
  { order: 70, usfmCode: 'WIS', nameKey: 'intelepciunea lui solomon',    nameAbbrev: 'ÎnțSol' },
  { order: 71, usfmCode: 'SIR', nameKey: 'intelepciunea lui isus sirah', nameAbbrev: 'Sir'    },

  // ── Major prophets ───────────────────────────────────────────────────────
  { order: 23, usfmCode: 'ISA', nameKey: 'isaia',                        nameAbbrev: 'Is'     },
  { order: 24, usfmCode: 'JER', nameKey: 'ieremia',                      nameAbbrev: 'Ier'    },
  { order: 25, usfmCode: 'LAM', nameKey: 'plangerile',                   nameAbbrev: 'Plâng'  },
  { order: 72, usfmCode: 'BAR', nameKey: 'baruh',                        nameAbbrev: 'Bar'    },
  { order: 73, usfmCode: 'LJE', nameKey: 'epistola lui ieremia',         nameAbbrev: 'EpIer'  },
  { order: 26, usfmCode: 'EZK', nameKey: 'iezechiel',                    nameAbbrev: 'Iez'    },
  { order: 27, usfmCode: 'DAN', nameKey: 'daniel',                       nameAbbrev: 'Dan'    },
  { order: 74, usfmCode: 'S3Y', nameKey: 'cantarea celor trei tineri',   nameAbbrev: 'S3Y'    },
  { order: 75, usfmCode: 'SUS', nameKey: 'suzana',                       nameAbbrev: 'Sus'    },
  { order: 76, usfmCode: 'BEL', nameKey: 'bel si balaurul',              nameAbbrev: 'Bel'    },

  // ── Minor prophets ───────────────────────────────────────────────────────
  { order: 28, usfmCode: 'HOS', nameKey: 'osea',                         nameAbbrev: 'Os'     },
  { order: 29, usfmCode: 'JOL', nameKey: 'ioil',                         nameAbbrev: 'Ioel'   },
  { order: 30, usfmCode: 'AMO', nameKey: 'amos',                         nameAbbrev: 'Amos'   },
  { order: 31, usfmCode: 'OBA', nameKey: 'obadia',                       nameAbbrev: 'Obad'   },
  { order: 32, usfmCode: 'JON', nameKey: 'iona',                         nameAbbrev: 'Ion'    },
  { order: 33, usfmCode: 'MIC', nameKey: 'miheia',                       nameAbbrev: 'Mica'   },
  { order: 34, usfmCode: 'NAM', nameKey: 'naum',                         nameAbbrev: 'Naum'   },
  { order: 35, usfmCode: 'HAB', nameKey: 'avacum',                       nameAbbrev: 'Hab'    },
  { order: 36, usfmCode: 'ZEP', nameKey: 'sofonie',                      nameAbbrev: 'Sof'    },
  { order: 37, usfmCode: 'HAG', nameKey: 'agheu',                        nameAbbrev: 'Ag'     },
  { order: 38, usfmCode: 'ZEC', nameKey: 'zaharia',                      nameAbbrev: 'Zah'    },
  { order: 39, usfmCode: 'MAL', nameKey: 'maleahi',                      nameAbbrev: 'Mal'    },

  // ── New Testament ────────────────────────────────────────────────────────
  { order: 40, usfmCode: 'MAT', nameKey: 'matei',                        nameAbbrev: 'Mat'    },
  { order: 41, usfmCode: 'MRK', nameKey: 'marcu',                        nameAbbrev: 'Mc'     },
  { order: 42, usfmCode: 'LUK', nameKey: 'luca',                         nameAbbrev: 'Lc'     },
  { order: 43, usfmCode: 'JHN', nameKey: 'ioan',                         nameAbbrev: 'In'     },
  { order: 44, usfmCode: 'ACT', nameKey: 'faptele apostolilor',          nameAbbrev: 'FA'     },
  { order: 45, usfmCode: 'ROM', nameKey: 'romani',                       nameAbbrev: 'Rom'    },
  { order: 46, usfmCode: '1CO', nameKey: 'intaia corinteni',             nameAbbrev: '1Cor'   },
  { order: 47, usfmCode: '2CO', nameKey: 'a doua corinteni',             nameAbbrev: '2Cor'   },
  { order: 48, usfmCode: 'GAL', nameKey: 'galateni',                     nameAbbrev: 'Gal'    },
  { order: 49, usfmCode: 'EPH', nameKey: 'efeseni',                      nameAbbrev: 'Ef'     },
  { order: 50, usfmCode: 'PHP', nameKey: 'filipeni',                     nameAbbrev: 'Flp'    },
  { order: 51, usfmCode: 'COL', nameKey: 'coloseni',                     nameAbbrev: 'Col'    },
  { order: 52, usfmCode: '1TH', nameKey: 'intaia tesaloniceni',          nameAbbrev: '1Tes'   },
  { order: 53, usfmCode: '2TH', nameKey: 'a doua tesaloniceni',          nameAbbrev: '2Tes'   },
  { order: 54, usfmCode: '1TI', nameKey: 'intaia timotei',               nameAbbrev: '1Tim'   },
  { order: 55, usfmCode: '2TI', nameKey: 'a doua timotei',               nameAbbrev: '2Tim'   },
  { order: 56, usfmCode: 'TIT', nameKey: 'tit',                          nameAbbrev: 'Tit'    },
  { order: 57, usfmCode: 'PHM', nameKey: 'filimon',                      nameAbbrev: 'Flm'    },
  { order: 58, usfmCode: 'HEB', nameKey: 'evrei',                        nameAbbrev: 'Evr'    },
  { order: 59, usfmCode: 'JAS', nameKey: 'iacov',                        nameAbbrev: 'Iac'    },
  { order: 60, usfmCode: '1PE', nameKey: 'intaia petru',                 nameAbbrev: '1Pet'   },
  { order: 61, usfmCode: '2PE', nameKey: 'a doua petru',                 nameAbbrev: '2Pet'   },
  { order: 62, usfmCode: '1JN', nameKey: 'intaia ioan',                  nameAbbrev: '1In'    },
  { order: 63, usfmCode: '2JN', nameKey: 'a doua ioan',                  nameAbbrev: '2In'    },
  { order: 64, usfmCode: '3JN', nameKey: 'a treia ioan',                 nameAbbrev: '3In'    },
  { order: 65, usfmCode: 'JUD', nameKey: 'iuda',                         nameAbbrev: 'Iud'    },
  { order: 66, usfmCode: 'REV', nameKey: 'apocalipsa',                   nameAbbrev: 'Apoc'   },
];

// English common names (for the commonName field in helloao JSON)
const ENGLISH_BOOK_NAMES: Record<string, string> = {
  GEN: 'Genesis',       EXO: 'Exodus',          LEV: 'Leviticus',       NUM: 'Numbers',
  DEU: 'Deuteronomy',   JOS: 'Joshua',          JDG: 'Judges',          RUT: 'Ruth',
  '1SA': '1 Samuel',   '2SA': '2 Samuel',       '1KI': '1 Kings',       '2KI': '2 Kings',
  '1CH': '1 Chronicles', '2CH': '2 Chronicles', '1ES': '1 Esdras',      EZR: 'Ezra',
  NEH: 'Nehemiah',      TOB: 'Tobit',            JDT: 'Judith',          EST: 'Esther',
  '1MA': '1 Maccabees', '2MA': '2 Maccabees',   '3MA': '3 Maccabees',  '4MA': '4 Maccabees',
  JOB: 'Job',           PSA: 'Psalms',           MAN: 'Prayer of Manasseh', PRO: 'Proverbs',
  ECC: 'Ecclesiastes',  SNG: 'Song of Songs',    WIS: 'Wisdom of Solomon', SIR: 'Sirach',
  ISA: 'Isaiah',        JER: 'Jeremiah',         LAM: 'Lamentations',    BAR: 'Baruch',
  LJE: 'Letter of Jeremiah',
  EZK: 'Ezekiel',       DAN: 'Daniel',           S3Y: 'Song of the Three Young Men',
  SUS: 'Susanna',       BEL: 'Bel and the Dragon',
  HOS: 'Hosea',         JOL: 'Joel',             AMO: 'Amos',            OBA: 'Obadiah',
  JON: 'Jonah',         MIC: 'Micah',            NAM: 'Nahum',           HAB: 'Habakkuk',
  ZEP: 'Zephaniah',     HAG: 'Haggai',           ZEC: 'Zechariah',       MAL: 'Malachi',
  PS2: 'Psalm 151',     MAT: 'Matthew',          MRK: 'Mark',            LUK: 'Luke',
  JHN: 'John',          ACT: 'Acts',             ROM: 'Romans',          '1CO': '1 Corinthians',
  '2CO': '2 Corinthians', GAL: 'Galatians',      EPH: 'Ephesians',       PHP: 'Philippians',
  COL: 'Colossians',   '1TH': '1 Thessalonians', '2TH': '2 Thessalonians', '1TI': '1 Timothy',
  '2TI': '2 Timothy',  TIT: 'Titus',             PHM: 'Philemon',         HEB: 'Hebrews',
  JAS: 'James',        '1PE': '1 Peter',          '2PE': '2 Peter',        '1JN': '1 John',
  '2JN': '2 John',     '3JN': '3 John',           JUD: 'Jude',             REV: 'Revelation',
};

// Books that are deuterocanonical / apocryphal in the helloao sense
const APOCRYPHAL_CODES = new Set([
  'TOB', 'JDT', '1MA', '2MA', '3MA', '4MA', 'WIS', 'SIR', 'BAR', 'LJE',
  '1ES', 'MAN', 'PS2', 'S3Y', 'SUS', 'BEL',
]);

// Startup validation: every usfmCode must have an English name entry
const missingEnglishNames = booksConfig
  .map((b) => b.usfmCode)
  .filter((code) => !(code in ENGLISH_BOOK_NAMES));
if (missingEnglishNames.length > 0) {
  throw new Error(`Missing ENGLISH_BOOK_NAMES entries for: ${missingEnglishNames.join(', ')}`);
}

// ─── Name normalization ───────────────────────────────────────────────────────

/**
 * Normalizes a Romanian book name for fuzzy matching:
 * lowercases, strips diacritics, collapses whitespace.
 */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

/** Fetches a page and returns its HTML text; throws on failure. */
async function fetchHtml(url: string): Promise<string> {
  const response = await axios.get<string>(url, {
    timeout: 15_000,
    headers: { 'User-Agent': 'BibliaScraper/1.0 (personal-use)' },
    responseType: 'text',
  });
  return response.data;
}

// ─── Book discovery ───────────────────────────────────────────────────────────

/**
 * Fetches one of the testament index pages (/vechiul-testament or /noul-testament)
 * and returns every book link found inside
 *   #root > div > div[class*="PageWrapper_wrapper"]
 *
 * Each <a> inside that wrapper whose href links to a book page is collected.
 * Accepted href patterns:
 *   /Biblie/Anania/<slug>          – book root
 *   /Biblie/Anania/<slug>/<digit>  – chapter link (we extract just the slug)
 */
async function discoverBooksFromIndex(indexUrl: string): Promise<SiteBook[]> {
  let html: string;
  try {
    html = await fetchHtml(indexUrl);
  } catch (err) {
    throw new Error(
      `Failed to fetch index page ${indexUrl}: ${(err as Error).message}`,
    );
  }

  const $ = cheerio.load(html);
  const books: SiteBook[] = [];
  const seenPaths = new Set<string>();

  // Target the PageWrapper div; fall back to full #root > div if selector misses.
  const $wrapper = $(BOOK_LIST_SELECTOR);
  const $scope = $wrapper.length > 0 ? $wrapper : $('#root > div');

  $scope.find('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';

    // Accept /Biblie/Anania/<slug> with no chapter, or with a chapter suffix
    const match = href.match(/^(\/Biblie\/Anania\/([^/]+?))\/?(\d+)?\/?$/);
    if (!match) return;

    const bookPath = match[1];   // e.g. /Biblie/Anania/Facerea
    if (seenPaths.has(bookPath)) return;

    const displayName = $(el).text().trim();
    if (!displayName) return;

    seenPaths.add(bookPath);
    books.push({ bookPath, displayName });
  });

  return books;
}

/**
 * Discovers all books from both testament index pages and merges the results.
 * Logs any site books whose normalized display name doesn't match a booksConfig
 * entry (informational).
 */
async function discoverAllBooks(): Promise<SiteBook[]> {
  const [otBooks, ntBooks] = await Promise.all([
    discoverBooksFromIndex(OT_INDEX_URL),
    discoverBooksFromIndex(NT_INDEX_URL),
  ]);

  // Merge, de-duplicating by bookPath
  const seen = new Set<string>();
  const all: SiteBook[] = [];
  for (const b of [...otBooks, ...ntBooks]) {
    if (!seen.has(b.bookPath)) {
      seen.add(b.bookPath);
      all.push(b);
    }
  }
  return all;
}

/**
 * Builds a lookup map: normalizedDisplayName → SiteBook.
 * Logs any site books not matched by a booksConfig entry (informational).
 */
function buildSiteLookup(
  siteBooks: SiteBook[],
  configKeys: Set<string>,
): Map<string, SiteBook> {
  const lookup = new Map<string, SiteBook>();
  const unmatched: string[] = [];

  for (const sb of siteBooks) {
    const key = normalizeName(sb.displayName);
    lookup.set(key, sb);
    if (!configKeys.has(key)) {
      unmatched.push(`"${sb.displayName}" (path: "${sb.bookPath}")`);
    }
  }

  if (unmatched.length > 0) {
    console.log(
      `  [INFO] ${unmatched.length} site book(s) not in booksConfig:\n` +
      unmatched.map((s) => `    ${s}`).join('\n'),
    );
  }

  return lookup;
}

// ─── Scraping helpers ─────────────────────────────────────────────────────────

/** Fetches the HTML of a chapter page; returns null on any error. */
async function fetchChapterHtml(bookPath: string, chapter: number): Promise<string | null> {
  const url = `${BASE_URL}${bookPath}/${chapter}`;
  try {
    const response = await axios.get<string>(url, {
      timeout: 10_000,
      headers: { 'User-Agent': 'BibliaScraper/1.0 (personal-use)' },
      responseType: 'text',
    });
    if (response.status !== 200) {
      console.warn(`  [HTTP ${response.status}] ${url}`);
      return null;
    }
    return response.data;
  } catch (err) {
    console.warn(`  [ERROR] fetching ${url}:`, (err as Error).message);
    return null;
  }
}

/**
 * Parses verse content from a chapter page HTML.
 *
 * The content root is `#root > div` as specified by the site structure.
 * Within that container, several parsing strategies are tried in order:
 *
 *  1. Elements with a `data-verse` attribute (e.g. <div data-verse="3">)
 *  2. Elements carrying common verse CSS class names (.verset, .vers, .verse)
 *  3. Text-based fallback: child paragraphs/divs starting with "N " or "N. "
 */
function parseChapterVerses(html: string): Verse[] {
  const $ = cheerio.load(html);

  // Scope parsing to #root > div (the main content container on chapter pages)
  const $root = $(CHAPTER_CONTENT_SELECTOR);
  const $content = $root.length > 0 ? $root : $('body');

  // ── Strategy 1: data-verse attribute ─────────────────────────────────────
  const byDataVerse: Verse[] = [];
  $content.find('[data-verse]').each((_i, el) => {
    const raw = $(el).attr('data-verse') ?? '';
    const vnum = parseInt(raw, 10);
    if (isNaN(vnum) || vnum < 1) return;

    const $el = $(el).clone();
    // Remove embedded verse-number spans so they don't pollute the text
    $el.find('.versnr, .verse-number, .nr, .vnum, .num').remove();
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (text) byDataVerse.push({ number: vnum, text });
  });
  if (byDataVerse.length > 0) return byDataVerse;

  // ── Strategy 2: common verse CSS class names ──────────────────────────────
  const verseSelectors = ['.verset', '.vers', '.verse', '[class*="verse"]', '[class*="Verse"]'];
  for (const selector of verseSelectors) {
    const byClass: Verse[] = [];
    $content.find(selector).each((_i, el) => {
      const $el = $(el);
      // Extract verse number from a dedicated child element
      const $numEl = $el
        .find('.versnr, .verse-number, .nr, .vnum, .num, span:first-child, b:first-child, strong:first-child')
        .first();
      const numText = $numEl.text().replace(/[.\s]/g, '').trim();
      const vnum = parseInt(numText, 10);
      if (isNaN(vnum) || vnum < 1) return;

      const $clone = $el.clone();
      $clone
        .find('.versnr, .verse-number, .nr, .vnum, .num, span:first-child, b:first-child, strong:first-child')
        .first()
        .remove();
      const text = $clone.text().replace(/\s+/g, ' ').trim();
      if (text) byClass.push({ number: vnum, text });
    });
    if (byClass.length > 0) return byClass;
  }

  // ── Strategy 3: text-based fallback ──────────────────────────────────────
  //
  // Scans immediate child paragraphs/divs/spans inside the content container
  // for lines that begin with a verse-number token like "1 ", "1. ", "1 - ".
  const byText: Verse[] = [];
  const verseLineRe = /^(\d{1,3})[\.\s\-\u00a0]\s*(.{3,})$/;

  $content.find('p, div, li, span').each((_i, el) => {
    // Skip containers that have further nested verse-like children to avoid
    // collecting both a parent and its children.
    if ($(el).find('p, div, li').length > 0) return;

    const line = $(el).text().replace(/\s+/g, ' ').trim();
    const m = line.match(verseLineRe);
    if (!m) return;

    const vnum = parseInt(m[1], 10);
    if (isNaN(vnum) || vnum < 1 || vnum > 200) return;

    byText.push({ number: vnum, text: m[2].trim() });
  });

  // De-duplicate: keep first occurrence of each verse number
  const seen = new Set<number>();
  return byText.filter((v) => {
    if (seen.has(v.number)) return false;
    seen.add(v.number);
    return true;
  });
}

/** Probes chapters 1..MAX_CHAPTER_PROBE until no verses are found; returns last valid chapter number. */
async function detectMaxChapters(bookPath: string): Promise<number> {
  let lastValid = 0;
  for (let cap = 1; cap <= MAX_CHAPTER_PROBE; cap++) {
    const html = await fetchChapterHtml(bookPath, cap);
    if (!html) break;

    const verses = parseChapterVerses(html);
    if (verses.length === 0) break;

    lastValid = cap;
    await sleep(CHAPTER_DETECTION_DELAY_MS);
  }
  return lastValid;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await fs.mkdir(BIBLES_DIR, { recursive: true });
  console.log('=== Biblia Anania Pipeline ===\n');

  // ── Step 1: discover book paths and display names from OT + NT index pages ──
  console.log('Discovering books from OT and NT index pages…');
  const siteBooks = await discoverAllBooks();
  console.log(`Found ${siteBooks.length} book link(s) across OT and NT index pages.\n`);

  const configKeys = new Set(booksConfig.map((b) => b.nameKey));
  const siteLookup = buildSiteLookup(siteBooks, configKeys);

  // ── Step 2: resolve site book for each BookConfig entry ───────────────────
  const sorted = [...booksConfig].sort((a, b) => a.order - b.order);
  let totalChapters = 0;
  let totalVerses = 0;
  const books = [];
  const unmatchedConfigs: string[] = [];

  for (const book of sorted) {
    const siteBook = siteLookup.get(book.nameKey);

    if (!siteBook) {
      unmatchedConfigs.push(`"${book.nameKey}" (${book.usfmCode})`);
      console.warn(`  [SKIP] Cannot find nameKey "${book.nameKey}" in site book list (${book.usfmCode})`);
      continue;
    }

    const { bookPath, displayName } = siteBook;
    console.log(`[${book.usfmCode}] path="${bookPath}" — ${displayName}`);

    // ── Step 3: scrape chapters for this book ────────────────────────────────
    const maxChapters = await detectMaxChapters(bookPath);
    if (maxChapters === 0) {
      console.warn(`  [SKIP] No chapters found for ${book.usfmCode} (path=${bookPath})`);
      continue;
    }

    const chapters = [];
    let bookVerses = 0;

    for (let cap = 1; cap <= maxChapters; cap++) {
      const html = await fetchChapterHtml(bookPath, cap);
      if (!html) break;

      const verses = parseChapterVerses(html);
      if (verses.length === 0) break;

      chapters.push({
        chapter: {
          number: cap,
          bookName: displayName,
          content: verses.map((v) => ({
            type: 'verse' as const,
            number: v.number,
            content: [v.text],
          })),
        },
      });

      bookVerses += verses.length;
      await sleep(CHAPTER_FETCH_DELAY_MS);
    }

    totalChapters += chapters.length;
    totalVerses += bookVerses;

    const commonName = ENGLISH_BOOK_NAMES[book.usfmCode];

    books.push({
      id: book.usfmCode,
      name: displayName,
      shortName: book.nameAbbrev,
      commonName,
      title: displayName,
      order: book.order,
      numberOfChapters: chapters.length,
      totalNumberOfVerses: bookVerses,
      isApocryphal: APOCRYPHAL_CODES.has(book.usfmCode),
      chapters,
    });

    console.log(`  ✓ ${chapters.length} chapters, ${bookVerses} verses`);
  }

  if (unmatchedConfigs.length > 0) {
    console.warn(
      `\n[WARN] ${unmatchedConfigs.length} book(s) in booksConfig had no match on the site:\n` +
      unmatchedConfigs.map((s) => `  ${s}`).join('\n') +
      '\nUpdate the nameKey values in booksConfig to match the site display names.',
    );
  }

  // ── Step 4: write output ───────────────────────────────────────────────────
  const output = {
    translation: {
      id: TRANSLATION_ID,
      name: 'Biblia Anania',
      englishName: 'Romanian Anania Bible',
      shortName: 'Anania',
      textDirection: 'ltr',
      language: 'ro',
      website: 'https://biblia-online.ro',
      licenseUrl: 'https://biblia-online.ro',
      numberOfBooks: books.length,
      totalNumberOfChapters: totalChapters,
      totalNumberOfVerses: totalVerses,
      availableFormats: ['json'],
    },
    books,
  };

  await fs.writeFile(FINAL_OUTPUT, JSON.stringify(output, null, 2), 'utf-8');

  console.log('\n✅ Pipeline complete.');
  console.log(`   Written: ${FINAL_OUTPUT}`);
  console.log(`   ${books.length} books, ${totalChapters} chapters, ${totalVerses} verses`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
