/**
 * biblia-pipeline.ts
 *
 * Pipeline:
 *  1) Fetch https://www.bibliaortodoxa.ro/ and discover all books with their
 *     real siteId values and names from <a title="..." href="/carte.php?id=N">.
 *  2) Scrape each discovered book chapter-by-chapter.
 *  3) Build a helloao-compatible JSON structure and write to
 *     data/bibles/ro_sinodala.json.
 *
 * Run:  npm run biblia-pipeline
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.bibliaortodoxa.ro';
const TRANSLATION_ID = 'ro_sinodala';
const BIBLES_DIR = path.resolve(__dirname, '../data/bibles');
const FINAL_OUTPUT = path.join(BIBLES_DIR, `${TRANSLATION_ID}.json`);

// ─── Types ───────────────────────────────────────────────────────────────────

/** Static per-book metadata used for helloao JSON fields. siteId is resolved
 *  dynamically at startup by matching nameLong against the site's book list. */
type BookConfig = {
  /** Canonical helloao order (1-based). */
  order: number;
  /** USFM book code, e.g. "GEN", "MAT". */
  usfmCode: string;
  /** Full Romanian name – used to match against the site's <a title="...">. */
  nameLong: string;
  /** Short Romanian name (for display). */
  nameShort: string;
  /** Romanian abbreviation. */
  nameAbbrev: string;
};

/** A book entry discovered from the site's homepage. */
type SiteBook = {
  /** Romanian name as shown in the <a title="..."> attribute. */
  name: string;
  /** Numeric id in ?id=N. */
  siteId: number;
};

type Verse = { number: number; text: string };

// ─── Static books configuration ──────────────────────────────────────────────
//
// nameLong values are used to match against the site's <a title="..."> text.
// If the site uses a different spelling, update nameLong to match.
//
// order values follow the helloao bookOrderMap:
//   canonical Protestant canon:  GEN=1 … REV=66
//   apocryphal/deuterocanonical: TOB=67, JDT=68, ESG=69, WIS=70, SIR=71,
//     BAR=72, LJE=73, S3Y=74, SUS=75, BEL=76, 1MA=77, 2MA=78, 3MA=79,
//     4MA=80, 1ES=81, 2ES=82, MAN=83, PS2=84 …

const booksConfig: BookConfig[] = [
  // ── Pentateuch ──────────────────────────────────────────────────────────
  { order: 1,  usfmCode: 'GEN', nameLong: 'Facerea',                          nameShort: 'Facerea',        nameAbbrev: 'Fac'    },
  { order: 2,  usfmCode: 'EXO', nameLong: 'Ieșirea',                          nameShort: 'Ieșirea',        nameAbbrev: 'Ieș'    },
  { order: 3,  usfmCode: 'LEV', nameLong: 'Leviticul',                        nameShort: 'Leviticul',      nameAbbrev: 'Lev'    },
  { order: 4,  usfmCode: 'NUM', nameLong: 'Numerele',                         nameShort: 'Numerele',       nameAbbrev: 'Num'    },
  { order: 5,  usfmCode: 'DEU', nameLong: 'Deuteronomul',                     nameShort: 'Deut.',          nameAbbrev: 'Deut'   },

  // ── Historical books ─────────────────────────────────────────────────────
  { order: 6,  usfmCode: 'JOS', nameLong: 'Iosua Navi',                       nameShort: 'Iosua',          nameAbbrev: 'Ios'    },
  { order: 7,  usfmCode: 'JDG', nameLong: 'Judecători',                       nameShort: 'Judecători',     nameAbbrev: 'Jud'    },
  { order: 8,  usfmCode: 'RUT', nameLong: 'Rut',                              nameShort: 'Rut',            nameAbbrev: 'Rut'    },
  { order: 9,  usfmCode: '1SA', nameLong: 'I Regi',                           nameShort: 'I Regi',         nameAbbrev: '1Reg'   },
  { order: 10, usfmCode: '2SA', nameLong: 'II Regi',                          nameShort: 'II Regi',        nameAbbrev: '2Reg'   },
  { order: 11, usfmCode: '1KI', nameLong: 'III Regi',                         nameShort: 'III Regi',       nameAbbrev: '3Reg'   },
  { order: 12, usfmCode: '2KI', nameLong: 'IV Regi',                          nameShort: 'IV Regi',        nameAbbrev: '4Reg'   },
  { order: 13, usfmCode: '1CH', nameLong: 'I Paralipomene',                   nameShort: 'I Paral.',       nameAbbrev: '1Par'   },
  { order: 14, usfmCode: '2CH', nameLong: 'II Paralipomene',                  nameShort: 'II Paral.',      nameAbbrev: '2Par'   },
  { order: 81, usfmCode: '1ES', nameLong: 'I Ezdra',                          nameShort: 'I Ezdra',        nameAbbrev: '1Ezd'   },
  { order: 15, usfmCode: 'EZR', nameLong: 'II Ezdra',                         nameShort: 'II Ezdra',       nameAbbrev: '2Ezd'   },
  { order: 16, usfmCode: 'NEH', nameLong: 'Neemia',                           nameShort: 'Neemia',         nameAbbrev: 'Neem'   },
  { order: 67, usfmCode: 'TOB', nameLong: 'Tobit',                            nameShort: 'Tobit',          nameAbbrev: 'Tob'    },
  { order: 68, usfmCode: 'JDT', nameLong: 'Iudita',                           nameShort: 'Iudita',         nameAbbrev: 'Iudt'   },
  { order: 17, usfmCode: 'EST', nameLong: 'Estera',                           nameShort: 'Estera',         nameAbbrev: 'Est'    },
  { order: 77, usfmCode: '1MA', nameLong: 'I Macabei',                        nameShort: 'I Macabei',      nameAbbrev: '1Mac'   },
  { order: 78, usfmCode: '2MA', nameLong: 'II Macabei',                       nameShort: 'II Macabei',     nameAbbrev: '2Mac'   },
  { order: 79, usfmCode: '3MA', nameLong: 'III Macabei',                      nameShort: 'III Macabei',    nameAbbrev: '3Mac'   },

  // ── Poetic / Wisdom books ────────────────────────────────────────────────
  { order: 18, usfmCode: 'JOB', nameLong: 'Iov',                              nameShort: 'Iov',            nameAbbrev: 'Iov'    },
  { order: 19, usfmCode: 'PSA', nameLong: 'Psalmii',                          nameShort: 'Psalmii',        nameAbbrev: 'Ps'     },
  { order: 83, usfmCode: 'MAN', nameLong: 'Rugăciunea lui Manase',            nameShort: 'Rug. Manase',    nameAbbrev: 'RgMan'  },
  { order: 20, usfmCode: 'PRO', nameLong: 'Pildele lui Solomon',              nameShort: 'Pildele',        nameAbbrev: 'Pild'   },
  { order: 21, usfmCode: 'ECC', nameLong: 'Eclesiastul',                      nameShort: 'Eclesiastul',    nameAbbrev: 'Eccl'   },
  { order: 22, usfmCode: 'SNG', nameLong: 'Cântarea Cântărilor',              nameShort: 'Cânt. Cânt.',    nameAbbrev: 'Cânt'   },
  { order: 70, usfmCode: 'WIS', nameLong: 'Înțelepciunea lui Solomon',        nameShort: 'Înț. Solomon',   nameAbbrev: 'ÎnțSol' },
  { order: 71, usfmCode: 'SIR', nameLong: 'Înțelepciunea lui Isus Sirah',    nameShort: 'Sirah',          nameAbbrev: 'Sir'    },

  // ── Major prophets ───────────────────────────────────────────────────────
  { order: 23, usfmCode: 'ISA', nameLong: 'Isaia',                            nameShort: 'Isaia',          nameAbbrev: 'Is'     },
  { order: 24, usfmCode: 'JER', nameLong: 'Ieremia',                          nameShort: 'Ieremia',        nameAbbrev: 'Ier'    },
  { order: 25, usfmCode: 'LAM', nameLong: 'Plângerile lui Ieremia',           nameShort: 'Plângerile',     nameAbbrev: 'Plâng'  },
  { order: 72, usfmCode: 'BAR', nameLong: 'Baruh',                            nameShort: 'Baruh',          nameAbbrev: 'Bar'    },
  { order: 26, usfmCode: 'EZK', nameLong: 'Iezechiel',                        nameShort: 'Iezechiel',      nameAbbrev: 'Iez'    },
  { order: 27, usfmCode: 'DAN', nameLong: 'Daniel',                           nameShort: 'Daniel',         nameAbbrev: 'Dan'    },
  { order: 74, usfmCode: 'S3Y', nameLong: 'Cântarea celor trei tineri',       nameShort: 'Cânt. 3 tineri', nameAbbrev: 'S3Y'    },
  { order: 75, usfmCode: 'SUS', nameLong: 'Istoria Suzanei',                  nameShort: 'Suzana',         nameAbbrev: 'Sus'    },
  { order: 76, usfmCode: 'BEL', nameLong: 'Bel și Balaurul',                  nameShort: 'Bel și Balaurul', nameAbbrev: 'Bel'   },

  // ── Minor prophets ───────────────────────────────────────────────────────
  { order: 28, usfmCode: 'HOS', nameLong: 'Osea',                             nameShort: 'Osea',           nameAbbrev: 'Os'     },
  { order: 29, usfmCode: 'JOL', nameLong: 'Ioil',                             nameShort: 'Ioil',           nameAbbrev: 'Ioel'   },
  { order: 30, usfmCode: 'AMO', nameLong: 'Amos',                             nameShort: 'Amos',           nameAbbrev: 'Amos'   },
  { order: 31, usfmCode: 'OBA', nameLong: 'Obadia',                           nameShort: 'Obadia',         nameAbbrev: 'Obad'   },
  { order: 32, usfmCode: 'JON', nameLong: 'Iona',                             nameShort: 'Iona',           nameAbbrev: 'Ion'    },
  { order: 33, usfmCode: 'MIC', nameLong: 'Mica',                             nameShort: 'Mica',           nameAbbrev: 'Mica'   },
  { order: 34, usfmCode: 'NAM', nameLong: 'Naum',                             nameShort: 'Naum',           nameAbbrev: 'Naum'   },
  { order: 35, usfmCode: 'HAB', nameLong: 'Habacuc',                          nameShort: 'Habacuc',        nameAbbrev: 'Hab'    },
  { order: 36, usfmCode: 'ZEP', nameLong: 'Sofonie',                          nameShort: 'Sofonie',        nameAbbrev: 'Sof'    },
  { order: 37, usfmCode: 'HAG', nameLong: 'Agheu',                            nameShort: 'Agheu',          nameAbbrev: 'Ag'     },
  { order: 38, usfmCode: 'ZEC', nameLong: 'Zaharia',                          nameShort: 'Zaharia',        nameAbbrev: 'Zah'    },
  { order: 39, usfmCode: 'MAL', nameLong: 'Maleahi',                          nameShort: 'Maleahi',        nameAbbrev: 'Mal'    },
  { order: 84, usfmCode: 'PS2', nameLong: 'Psalmul 151',                      nameShort: 'Ps. 151',        nameAbbrev: 'Ps151'  },
  { order: 80, usfmCode: '4MA', nameLong: 'IV Macabei',                       nameShort: 'IV Macabei',     nameAbbrev: '4Mac'   },

  // ── New Testament ────────────────────────────────────────────────────────
  { order: 40, usfmCode: 'MAT', nameLong: 'Matei',                            nameShort: 'Matei',          nameAbbrev: 'Mat'    },
  { order: 41, usfmCode: 'MRK', nameLong: 'Marcu',                            nameShort: 'Marcu',          nameAbbrev: 'Mc'     },
  { order: 42, usfmCode: 'LUK', nameLong: 'Luca',                             nameShort: 'Luca',           nameAbbrev: 'Lc'     },
  { order: 43, usfmCode: 'JHN', nameLong: 'Ioan',                             nameShort: 'Ioan',           nameAbbrev: 'In'     },
  { order: 44, usfmCode: 'ACT', nameLong: 'Faptele Apostolilor',              nameShort: 'Faptele',        nameAbbrev: 'FA'     },
  { order: 45, usfmCode: 'ROM', nameLong: 'Romani',                           nameShort: 'Romani',         nameAbbrev: 'Rom'    },
  { order: 46, usfmCode: '1CO', nameLong: 'I Corinteni',                      nameShort: 'I Cor.',         nameAbbrev: '1Cor'   },
  { order: 47, usfmCode: '2CO', nameLong: 'II Corinteni',                     nameShort: 'II Cor.',        nameAbbrev: '2Cor'   },
  { order: 48, usfmCode: 'GAL', nameLong: 'Galateni',                         nameShort: 'Galateni',       nameAbbrev: 'Gal'    },
  { order: 49, usfmCode: 'EPH', nameLong: 'Efeseni',                          nameShort: 'Efeseni',        nameAbbrev: 'Ef'     },
  { order: 50, usfmCode: 'PHP', nameLong: 'Filipeni',                         nameShort: 'Filipeni',       nameAbbrev: 'Flp'    },
  { order: 51, usfmCode: 'COL', nameLong: 'Coloseni',                         nameShort: 'Coloseni',       nameAbbrev: 'Col'    },
  { order: 52, usfmCode: '1TH', nameLong: 'I Tesaloniceni',                   nameShort: 'I Tes.',         nameAbbrev: '1Tes'   },
  { order: 53, usfmCode: '2TH', nameLong: 'II Tesaloniceni',                  nameShort: 'II Tes.',        nameAbbrev: '2Tes'   },
  { order: 54, usfmCode: '1TI', nameLong: 'I Timotei',                        nameShort: 'I Tim.',         nameAbbrev: '1Tim'   },
  { order: 55, usfmCode: '2TI', nameLong: 'II Timotei',                       nameShort: 'II Tim.',        nameAbbrev: '2Tim'   },
  { order: 56, usfmCode: 'TIT', nameLong: 'Tit',                              nameShort: 'Tit',            nameAbbrev: 'Tit'    },
  { order: 57, usfmCode: 'PHM', nameLong: 'Filimon',                          nameShort: 'Filimon',        nameAbbrev: 'Flm'    },
  { order: 58, usfmCode: 'HEB', nameLong: 'Evrei',                            nameShort: 'Evrei',          nameAbbrev: 'Evr'    },
  { order: 59, usfmCode: 'JAS', nameLong: 'Iacov',                            nameShort: 'Iacov',          nameAbbrev: 'Iac'    },
  { order: 60, usfmCode: '1PE', nameLong: 'I Petru',                          nameShort: 'I Pet.',         nameAbbrev: '1Pet'   },
  { order: 61, usfmCode: '2PE', nameLong: 'II Petru',                         nameShort: 'II Pet.',        nameAbbrev: '2Pet'   },
  { order: 62, usfmCode: '1JN', nameLong: 'I Ioan',                           nameShort: 'I In.',          nameAbbrev: '1In'    },
  { order: 63, usfmCode: '2JN', nameLong: 'II Ioan',                          nameShort: 'II In.',         nameAbbrev: '2In'    },
  { order: 64, usfmCode: '3JN', nameLong: 'III Ioan',                         nameShort: 'III In.',        nameAbbrev: '3In'    },
  { order: 65, usfmCode: 'JUD', nameLong: 'Iuda',                             nameShort: 'Iuda',           nameAbbrev: 'Iud'    },
  { order: 66, usfmCode: 'REV', nameLong: 'Apocalipsa',                       nameShort: 'Apocalipsa',     nameAbbrev: 'Apoc'   },
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
  'TOB', 'JDT', '1MA', '2MA', '3MA', '4MA', 'WIS', 'SIR', 'BAR',
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

// ─── Site discovery ───────────────────────────────────────────────────────────

/**
 * Fetches the site homepage and parses every
 *   <a title="BOOK_NAME" href="/carte.php?id=N">
 * link into a SiteBook array.  Duplicate siteIds are deduplicated (first seen wins).
 */
async function discoverBooksFromSite(): Promise<SiteBook[]> {
  let html: string;
  try {
    const response = await axios.get<string>(BASE_URL, {
      timeout: 15_000,
      headers: { 'User-Agent': 'BibliaScraper/1.0 (personal-use)' },
      responseType: 'text',
    });
    html = response.data;
  } catch (err) {
    throw new Error(
      `Failed to fetch site homepage for book discovery: ${(err as Error).message}`,
    );
  }

  const $ = cheerio.load(html);
  const books: SiteBook[] = [];
  const seenIds = new Set<number>();

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const idMatch = href.match(/[?&]id=(\d+)/);
    if (!idMatch) return;

    const siteId = parseInt(idMatch[1], 10);
    if (seenIds.has(siteId)) return;

    const titleAttr = $(el).attr('title')?.trim() ?? '';
    const linkText = $(el).text().trim();
    const name = titleAttr || linkText;

    if (!name) return;

    if (!titleAttr && linkText) {
      console.warn(`  [WARN] No title attr for id=${siteId}, using link text "${linkText}"`);
    }

    seenIds.add(siteId);
    books.push({ name, siteId });
  });

  return books;
}

/**
 * Builds a lookup map: normalizedName → SiteBook.
 * Logs any site books that don't match a booksConfig entry (informational).
 */
function buildSiteLookup(
  siteBooks: SiteBook[],
  configNames: Set<string>,
): Map<string, SiteBook> {
  const lookup = new Map<string, SiteBook>();
  const unmatched: string[] = [];

  for (const sb of siteBooks) {
    const key = normalizeName(sb.name);
    lookup.set(key, sb);
    if (!configNames.has(key)) {
      unmatched.push(`"${sb.name}" (id=${sb.siteId})`);
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
async function fetchChapterHtml(bookSiteId: number, chapter: number): Promise<string | null> {
  const url = `${BASE_URL}/carte.php?id=${bookSiteId}&cap=${chapter}`;
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

/** Parses verse rows from chapter HTML. */
function parseChapterVerses(html: string): Verse[] {
  const $ = cheerio.load(html);
  const verses: Verse[] = [];

  $('tr').each((_i, row) => {
    const cols = $(row).find('td');
    if (cols.length !== 2) return;

    const numCell = $(cols[0]).text().trim();
    if (!numCell.endsWith('.')) return;

    const vnum = parseInt(numCell.slice(0, -1), 10);
    if (isNaN(vnum)) return;

    const text = $(cols[1])
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    verses.push({ number: vnum, text });
  });

  return verses;
}

/** Probes chapters 1..maxTry until no verses are found; returns last valid chapter number. */
async function detectMaxChapters(bookSiteId: number, maxTry = 200): Promise<number> {
  let lastValid = 0;
  for (let cap = 1; cap <= maxTry; cap++) {
    const html = await fetchChapterHtml(bookSiteId, cap);
    if (!html) break;

    const verses = parseChapterVerses(html);
    if (verses.length === 0) break;

    lastValid = cap;
    await sleep(500);
  }
  return lastValid;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await fs.mkdir(BIBLES_DIR, { recursive: true });
  console.log('=== Biblia Sinodală Pipeline ===\n');

  // ── Step 1: discover siteIds and names from the live homepage ──────────────
  console.log('Discovering books from site homepage…');
  const siteBooks = await discoverBooksFromSite();
  console.log(`Found ${siteBooks.length} book link(s) on the homepage.\n`);

  const configNormalizedNames = new Set(booksConfig.map((b) => normalizeName(b.nameLong)));
  const siteLookup = buildSiteLookup(siteBooks, configNormalizedNames);

  // ── Step 2: resolve siteId for each BookConfig entry ──────────────────────
  const sorted = [...booksConfig].sort((a, b) => a.order - b.order);
  let totalChapters = 0;
  let totalVerses = 0;
  const books = [];
  const unmatchedConfigs: string[] = [];

  for (const book of sorted) {
    const key = normalizeName(book.nameLong);
    const siteBook = siteLookup.get(key);

    if (!siteBook) {
      unmatchedConfigs.push(`"${book.nameLong}" (${book.usfmCode})`);
      console.warn(`  [SKIP] Cannot find "${book.nameLong}" in site book list (${book.usfmCode})`);
      continue;
    }

    const { siteId, name: siteName } = siteBook;
    console.log(`[${book.usfmCode}] id=${siteId} — ${siteName}`);

    // ── Step 3: scrape chapters for this book ────────────────────────────────
    const maxChapters = await detectMaxChapters(siteId);
    if (maxChapters === 0) {
      console.warn(`  [SKIP] No chapters found for ${book.usfmCode} (siteId=${siteId})`);
      continue;
    }

    const chapters = [];
    let bookVerses = 0;

    for (let cap = 1; cap <= maxChapters; cap++) {
      const html = await fetchChapterHtml(siteId, cap);
      if (!html) break;

      const verses = parseChapterVerses(html);
      if (verses.length === 0) break;

      chapters.push({
        chapter: {
          number: cap,
          bookName: siteName,
          content: verses.map((v) => ({
            type: 'verse' as const,
            number: v.number,
            content: [v.text],
          })),
        },
      });

      bookVerses += verses.length;
      await sleep(300);
    }

    totalChapters += chapters.length;
    totalVerses += bookVerses;

    const commonName = ENGLISH_BOOK_NAMES[book.usfmCode];

    books.push({
      id: book.usfmCode,
      name: siteName,
      commonName,
      title: siteName,
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
      '\nUpdate the nameLong values in booksConfig to match the site <a title="..."> text.',
    );
  }

  // ── Step 4: write output ───────────────────────────────────────────────────
  const output = {
    translation: {
      id: TRANSLATION_ID,
      name: 'Biblia Sinodală',
      englishName: 'Romanian Synodal Bible',
      shortName: 'Sinodală',
      textDirection: 'ltr',
      language: 'ro',
      website: 'https://www.bibliaortodoxa.ro',
      licenseUrl: 'https://www.bibliaortodoxa.ro',
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
