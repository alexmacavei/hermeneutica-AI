/**
 * anania-pipeline.ts
 *
 * Pipeline:
 *  1) Fetch the Old Testament index (https://biblia-online.ro/vechiul-testament)
 *     and the New Testament index (https://biblia-online.ro/noul-testament).
 *     Each page lists books as <a href="/<testament>/<slug>?capitol=1"> links.
 *  2) For each discovered book, determine the number of chapters by reading the
 *     pagination widget (CSS class Pagination_page__link) on the first chapter
 *     page.  Single-chapter books have no pagination and default to 1.
 *  3) Scrape every chapter page at:
 *       https://biblia-online.ro/<testament>/<slug>?capitol=<N>
 *     The site is a Next.js RSC app; verse data is embedded as single-escaped
 *     JSON inside <script> tags (JavaScript string with \" quoting).
 *     Each verse object has the shape:
 *       { \"verseNumber\": N, \"verseText\": \"...\" }
 *  4) Build a helloao-compatible JSON structure and write to
 *     data/bibles/ro_anania.json.
 *
 * Run:  npm run anania-pipeline
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

import {
  type Verse,
  type BaseBookConfig,
  sleep,
  validateEnglishNames,
  buildChapterEntry,
  buildBookEntry,
  writeOutput,
} from './shared';

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'https://biblia-online.ro';
const OT_INDEX_URL = `${BASE_URL}/vechiul-testament`;
const NT_INDEX_URL = `${BASE_URL}/noul-testament`;

const TRANSLATION_ID = 'ro_anania';

/** Delay (ms) between chapter fetches to be polite to the server. */
const CHAPTER_FETCH_DELAY_MS = 400;

// ─── Types ───────────────────────────────────────────────────────────────────

/** A book entry discovered from the OT/NT index pages. */
type SiteBook = {
  /**
   * URL path to the book, e.g. "/vechiul-testament/facerea".
   * Chapter URLs are: BASE_URL + bookPath + "?capitol=" + chapterNumber
   */
  bookPath: string;
  /** Display name from the link text, e.g. "Facerea", "Evanghelia după Matei". */
  displayName: string;
};

/** Anania-specific book config extends the shared base with the URL path matching key. */
type BookConfig = BaseBookConfig & {
  /**
   * Full URL path of the book on biblia-online.ro (without query string),
   * e.g. "/vechiul-testament/facerea", "/noul-testament/evanghelia-matei".
   * This is the primary matching key used to link config entries to site books.
   */
  bookPath: string;
};

// ─── Static books configuration ──────────────────────────────────────────────
//
// bookPath values are the actual URL paths observed on biblia-online.ro.
// They are verified against the live site book lists at startup.
//
// order values follow the helloao bookOrderMap:
//   canonical Protestant canon:  GEN=1 … REV=66
//   apocryphal/deuterocanonical: TOB=67, JDT=68, ESG=69, WIS=70, SIR=71,
//     BAR=72, LJE=73, S3Y=74, SUS=75, BEL=76, 1MA=77, 2MA=78, 3MA=79,
//     4MA=80, 1ES=81, 2ES=82, MAN=83, PS2=84 …

const booksConfig: BookConfig[] = [
  // ── Pentateuch ──────────────────────────────────────────────────────────
  { order: 1,  usfmCode: 'GEN', bookPath: '/vechiul-testament/facerea',                              nameAbbrev: 'Fac'    },
  { order: 2,  usfmCode: 'EXO', bookPath: '/vechiul-testament/iesirea',                              nameAbbrev: 'Ieș'    },
  { order: 3,  usfmCode: 'LEV', bookPath: '/vechiul-testament/leviticul',                            nameAbbrev: 'Lev'    },
  { order: 4,  usfmCode: 'NUM', bookPath: '/vechiul-testament/numeri',                               nameAbbrev: 'Num'    },
  { order: 5,  usfmCode: 'DEU', bookPath: '/vechiul-testament/deuteronomul',                         nameAbbrev: 'Deut'   },

  // ── Historical books ─────────────────────────────────────────────────────
  { order: 6,  usfmCode: 'JOS', bookPath: '/vechiul-testament/iosua-navi',                           nameAbbrev: 'Ios'    },
  { order: 7,  usfmCode: 'JDG', bookPath: '/vechiul-testament/judecatori',                           nameAbbrev: 'Jud'    },
  { order: 8,  usfmCode: 'RUT', bookPath: '/vechiul-testament/rut',                                  nameAbbrev: 'Rut'    },
  { order: 9,  usfmCode: '1SA', bookPath: '/vechiul-testament/regi-1',                               nameAbbrev: '1Reg'   },
  { order: 10, usfmCode: '2SA', bookPath: '/vechiul-testament/regi-2',                               nameAbbrev: '2Reg'   },
  { order: 11, usfmCode: '1KI', bookPath: '/vechiul-testament/regi-3',                               nameAbbrev: '3Reg'   },
  { order: 12, usfmCode: '2KI', bookPath: '/vechiul-testament/regi-4',                               nameAbbrev: '4Reg'   },
  { order: 13, usfmCode: '1CH', bookPath: '/vechiul-testament/paralipomena-1',                       nameAbbrev: '1Par'   },
  { order: 14, usfmCode: '2CH', bookPath: '/vechiul-testament/paralipomena-2',                       nameAbbrev: '2Par'   },
  // ezdra-1 = canonical Ezra (called "III Ezdra" in sinodala numbering, "I Ezdra" here)
  { order: 15, usfmCode: 'EZR', bookPath: '/vechiul-testament/ezdra-1',                              nameAbbrev: '2Ezd'   },
  // ezdra-2 = Nehemiah ("Cartea lui Neemia / a doua a lui Ezdra")
  { order: 16, usfmCode: 'NEH', bookPath: '/vechiul-testament/ezdra-2',                              nameAbbrev: 'Neem'   },
  { order: 17, usfmCode: 'EST', bookPath: '/vechiul-testament/estera',                               nameAbbrev: 'Est'    },
  { order: 67, usfmCode: 'TOB', bookPath: '/vechiul-testament/tobit',                                nameAbbrev: 'Tob'    },
  { order: 68, usfmCode: 'JDT', bookPath: '/vechiul-testament/iudita',                               nameAbbrev: 'Iudt'   },
  { order: 77, usfmCode: '1MA', bookPath: '/vechiul-testament/macabei-1',                            nameAbbrev: '1Mac'   },
  { order: 78, usfmCode: '2MA', bookPath: '/vechiul-testament/macabei-2',                            nameAbbrev: '2Mac'   },
  { order: 79, usfmCode: '3MA', bookPath: '/vechiul-testament/macabei-3',                            nameAbbrev: '3Mac'   },

  // ── Poetic / Wisdom books ────────────────────────────────────────────────
  { order: 18, usfmCode: 'JOB', bookPath: '/vechiul-testament/iov',                                  nameAbbrev: 'Iov'    },
  { order: 19, usfmCode: 'PSA', bookPath: '/vechiul-testament/psalmi',                               nameAbbrev: 'Ps'     },
  { order: 83, usfmCode: 'MAN', bookPath: '/vechiul-testament/manase-rugaciune',                     nameAbbrev: 'RgMan'  },
  { order: 20, usfmCode: 'PRO', bookPath: '/vechiul-testament/solomon-pilde',                        nameAbbrev: 'Pild'   },
  { order: 21, usfmCode: 'ECC', bookPath: '/vechiul-testament/ecclesiastul',                         nameAbbrev: 'Eccl'   },
  { order: 22, usfmCode: 'SNG', bookPath: '/vechiul-testament/cantarea-cantarilor',                  nameAbbrev: 'Cânt'   },
  { order: 70, usfmCode: 'WIS', bookPath: '/vechiul-testament/solomon-intelepciunea',                nameAbbrev: 'ÎnțSol' },
  { order: 71, usfmCode: 'SIR', bookPath: '/vechiul-testament/intelepciunea-lui-isus-fiul-lui-sirah', nameAbbrev: 'Sir'   },
  // ezdra-3 = 1 Esdras (apocryphal; site places it among deuterocanonicals)
  { order: 81, usfmCode: '1ES', bookPath: '/vechiul-testament/ezdra-3',                              nameAbbrev: '1Ezd'   },

  // ── Major prophets ───────────────────────────────────────────────────────
  { order: 23, usfmCode: 'ISA', bookPath: '/vechiul-testament/isaia',                                nameAbbrev: 'Is'     },
  { order: 24, usfmCode: 'JER', bookPath: '/vechiul-testament/ieremia',                              nameAbbrev: 'Ier'    },
  { order: 25, usfmCode: 'LAM', bookPath: '/vechiul-testament/ieremia-plangeri',                     nameAbbrev: 'Plâng'  },
  { order: 72, usfmCode: 'BAR', bookPath: '/vechiul-testament/baruh',                                nameAbbrev: 'Bar'    },
  { order: 73, usfmCode: 'LJE', bookPath: '/vechiul-testament/ieremia-epistola',                     nameAbbrev: 'EpIer'  },
  { order: 26, usfmCode: 'EZK', bookPath: '/vechiul-testament/iezechiel',                            nameAbbrev: 'Iez'    },
  { order: 27, usfmCode: 'DAN', bookPath: '/vechiul-testament/daniel',                               nameAbbrev: 'Dan'    },
  { order: 74, usfmCode: 'S3Y', bookPath: '/vechiul-testament/cantarea-celor-trei-tineri',           nameAbbrev: 'S3Y'    },
  { order: 75, usfmCode: 'SUS', bookPath: '/vechiul-testament/susana',                               nameAbbrev: 'Sus'    },
  { order: 76, usfmCode: 'BEL', bookPath: '/vechiul-testament/bel-si-balaurul',                      nameAbbrev: 'Bel'    },

  // ── Minor prophets ───────────────────────────────────────────────────────
  { order: 28, usfmCode: 'HOS', bookPath: '/vechiul-testament/osea',                                 nameAbbrev: 'Os'     },
  { order: 29, usfmCode: 'JOL', bookPath: '/vechiul-testament/ioil',                                 nameAbbrev: 'Ioel'   },
  { order: 30, usfmCode: 'AMO', bookPath: '/vechiul-testament/amos',                                 nameAbbrev: 'Amos'   },
  { order: 31, usfmCode: 'OBA', bookPath: '/vechiul-testament/avdia',                                nameAbbrev: 'Obad'   },
  { order: 32, usfmCode: 'JON', bookPath: '/vechiul-testament/iona',                                 nameAbbrev: 'Ion'    },
  { order: 33, usfmCode: 'MIC', bookPath: '/vechiul-testament/miheia',                               nameAbbrev: 'Mica'   },
  { order: 34, usfmCode: 'NAM', bookPath: '/vechiul-testament/naum',                                 nameAbbrev: 'Naum'   },
  { order: 35, usfmCode: 'HAB', bookPath: '/vechiul-testament/avacum',                               nameAbbrev: 'Hab'    },
  { order: 36, usfmCode: 'ZEP', bookPath: '/vechiul-testament/sofonie',                              nameAbbrev: 'Sof'    },
  { order: 37, usfmCode: 'HAG', bookPath: '/vechiul-testament/agheu',                                nameAbbrev: 'Ag'     },
  { order: 38, usfmCode: 'ZEC', bookPath: '/vechiul-testament/zaharia',                              nameAbbrev: 'Zah'    },
  { order: 39, usfmCode: 'MAL', bookPath: '/vechiul-testament/maleahi',                              nameAbbrev: 'Mal'    },

  // ── New Testament ────────────────────────────────────────────────────────
  { order: 40, usfmCode: 'MAT', bookPath: '/noul-testament/evanghelia-matei',                        nameAbbrev: 'Mat'    },
  { order: 41, usfmCode: 'MRK', bookPath: '/noul-testament/evanghelia-marcu',                        nameAbbrev: 'Mc'     },
  { order: 42, usfmCode: 'LUK', bookPath: '/noul-testament/evanghelia-luca',                         nameAbbrev: 'Lc'     },
  { order: 43, usfmCode: 'JHN', bookPath: '/noul-testament/evanghelia-ioan',                         nameAbbrev: 'In'     },
  { order: 44, usfmCode: 'ACT', bookPath: '/noul-testament/faptele-apostolilor',                     nameAbbrev: 'FA'     },
  { order: 45, usfmCode: 'ROM', bookPath: '/noul-testament/epistola-romani',                         nameAbbrev: 'Rom'    },
  { order: 46, usfmCode: '1CO', bookPath: '/noul-testament/epistola-corinteni-1',                    nameAbbrev: '1Cor'   },
  { order: 47, usfmCode: '2CO', bookPath: '/noul-testament/epistola-corinteni-2',                    nameAbbrev: '2Cor'   },
  { order: 48, usfmCode: 'GAL', bookPath: '/noul-testament/epistola-galateni',                       nameAbbrev: 'Gal'    },
  { order: 49, usfmCode: 'EPH', bookPath: '/noul-testament/epistola-efeseni',                        nameAbbrev: 'Ef'     },
  { order: 50, usfmCode: 'PHP', bookPath: '/noul-testament/epistola-filipeni',                       nameAbbrev: 'Flp'    },
  { order: 51, usfmCode: 'COL', bookPath: '/noul-testament/epistola-coloseni',                       nameAbbrev: 'Col'    },
  { order: 52, usfmCode: '1TH', bookPath: '/noul-testament/epistola-tesaloniceni-1',                 nameAbbrev: '1Tes'   },
  { order: 53, usfmCode: '2TH', bookPath: '/noul-testament/epistola-tesaloniceni-2',                 nameAbbrev: '2Tes'   },
  { order: 54, usfmCode: '1TI', bookPath: '/noul-testament/epistola-timotei-1',                      nameAbbrev: '1Tim'   },
  { order: 55, usfmCode: '2TI', bookPath: '/noul-testament/epistola-timotei-2',                      nameAbbrev: '2Tim'   },
  { order: 56, usfmCode: 'TIT', bookPath: '/noul-testament/epistola-tit',                            nameAbbrev: 'Tit'    },
  { order: 57, usfmCode: 'PHM', bookPath: '/noul-testament/epistola-filimon',                        nameAbbrev: 'Flm'    },
  { order: 58, usfmCode: 'HEB', bookPath: '/noul-testament/epistola-evrei',                          nameAbbrev: 'Evr'    },
  { order: 59, usfmCode: 'JAS', bookPath: '/noul-testament/epistola-iacob',                          nameAbbrev: 'Iac'    },
  { order: 60, usfmCode: '1PE', bookPath: '/noul-testament/epistola-petru-1',                        nameAbbrev: '1Pet'   },
  { order: 61, usfmCode: '2PE', bookPath: '/noul-testament/epistola-petru-2',                        nameAbbrev: '2Pet'   },
  { order: 62, usfmCode: '1JN', bookPath: '/noul-testament/epistola-ioan-1',                         nameAbbrev: '1In'    },
  { order: 63, usfmCode: '2JN', bookPath: '/noul-testament/epistola-ioan-2',                         nameAbbrev: '2In'    },
  { order: 64, usfmCode: '3JN', bookPath: '/noul-testament/epistola-ioan-3',                         nameAbbrev: '3In'    },
  { order: 65, usfmCode: 'JUD', bookPath: '/noul-testament/epistola-iuda',                           nameAbbrev: 'Iud'    },
  { order: 66, usfmCode: 'REV', bookPath: '/noul-testament/apocalipsa',                              nameAbbrev: 'Apoc'   },
];

// Startup validation: every usfmCode must have an English name entry
validateEnglishNames(booksConfig);

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
 * Fetches one testament index page (/vechiul-testament or /noul-testament)
 * and returns all book links as SiteBook entries.
 *
 * Book links on the index pages follow the pattern:
 *   href="/<testament>/<slug>?capitol=1"
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

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    // Match /<testament>/<slug>?capitol=1 (the first chapter link for each book)
    const match = href.match(/^(\/(vechiul|noul)-testament\/[^?/]+)\?capitol=1$/);
    if (!match) return;

    const bookPath = match[1];
    if (seenPaths.has(bookPath)) return;

    const displayName = $(el).text().trim();
    if (!displayName) return;

    seenPaths.add(bookPath);
    books.push({ bookPath, displayName });
  });

  return books;
}

/**
 * Discovers all books from both testament index pages.
 * Deduplicates by bookPath (first occurrence wins).
 */
async function discoverAllBooks(): Promise<SiteBook[]> {
  const [otBooks, ntBooks] = await Promise.all([
    discoverBooksFromIndex(OT_INDEX_URL),
    discoverBooksFromIndex(NT_INDEX_URL),
  ]);

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

// ─── Chapter-count detection ─────────────────────────────────────────────────

/**
 * Reads the pagination widget on a chapter page to determine the total number
 * of chapters.  The site renders pagination links with the CSS class
 * "Pagination_page__link" and hrefs like "?capitol=N".
 *
 * For single-chapter books the pagination widget is absent; returns 1 in
 * that case.
 */
function extractMaxChapter(html: string): number {
  const $ = cheerio.load(html);
  let max = 1;

  $('a[class*="Pagination_page__link"]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/capitol=(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });

  return max;
}

// ─── Verse extraction ─────────────────────────────────────────────────────────

/**
 * Parses verse content from a chapter page served by the Next.js RSC app.
 *
 * The site embeds verse data as JSON-escaped strings inside <script> tags
 * (Next.js server component flight payload).  Inside those JavaScript strings
 * all quote characters are escaped with a backslash, producing:
 *
 *   \"verseNumber\":1,\"verseText\":\"La început a făcut Dumnezeu...\"
 *
 * Strategy:
 *  1. Use Cheerio to iterate over all <script> elements and find the one
 *     containing the "Book_verses" / "verseNumber" marker.
 *  2. Unescape the \" sequences to " (replace /\\"/g → ").
 *  3. Extract all { verseNumber, verseText } pairs with a regex.
 */
function parseChapterVerses(html: string): Verse[] {
  const $ = cheerio.load(html);

  let verses: Verse[] = [];

  $('script').each((_i, el) => {
    if (verses.length > 0) return; // already found

    const scriptContent = $(el).html() ?? '';

    // Only process the script that carries verse data
    if (!scriptContent.includes('Book_verses') && !scriptContent.includes('verseNumber')) {
      return;
    }

    // Unescape the backslash-escaped JSON string (\" → ")
    const unescaped = scriptContent.replace(/\\"/g, '"');

    // Extract verse pairs.
    // The text pattern captures plain characters or backslash-escape sequences
    // to handle any remaining escapes within the verse text.
    const versePattern = /"verseNumber":(\d+),"verseText":"([^"\\]*(?:\\.[^"\\]*)*)"(?=[,}])/g;
    let vm: RegExpExecArray | null;

    while ((vm = versePattern.exec(unescaped)) !== null) {
      const vnum = parseInt(vm[1], 10);
      const text = vm[2].trim();
      if (!isNaN(vnum) && vnum >= 1 && text.length > 0) {
        verses.push({ number: vnum, text });
      }
    }
  });

  return verses;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Biblia Anania Pipeline ===\n');

  // ── Step 1: discover book paths and display names from OT + NT index pages ──
  console.log('Discovering books from OT and NT index pages…');
  const siteBooks = await discoverAllBooks();
  console.log(`Found ${siteBooks.length} book link(s) across OT and NT index pages.\n`);

  // Build lookup: bookPath → SiteBook
  const siteLookup = new Map<string, SiteBook>(
    siteBooks.map((sb) => [sb.bookPath, sb]),
  );

  // Log any site books that are not mapped in booksConfig (informational)
  const configPaths = new Set(booksConfig.map((b) => b.bookPath));
  const unmappedSite = siteBooks.filter((sb) => !configPaths.has(sb.bookPath));
  if (unmappedSite.length > 0) {
    console.log(
      `  [INFO] ${unmappedSite.length} site book(s) not in booksConfig:\n` +
      unmappedSite.map((sb) => `    "${sb.bookPath}" — ${sb.displayName}`).join('\n'),
    );
  }

  // ── Step 2: process each configured book in canonical order ───────────────
  const sorted = [...booksConfig].sort((a, b) => a.order - b.order);
  let totalChapters = 0;
  let totalVerses = 0;
  const books = [];
  const unmatchedConfigs: string[] = [];

  for (const book of sorted) {
    const siteBook = siteLookup.get(book.bookPath);

    if (!siteBook) {
      unmatchedConfigs.push(`"${book.bookPath}" (${book.usfmCode})`);
      console.warn(`  [SKIP] bookPath "${book.bookPath}" not found on site (${book.usfmCode})`);
      continue;
    }

    const { bookPath, displayName } = siteBook;
    console.log(`[${book.usfmCode}] ${bookPath} — ${displayName}`);

    // ── Step 3: fetch chapter 1 to read total chapter count ──────────────────
    const ch1Url = `${BASE_URL}${bookPath}?capitol=1`;
    let ch1Html: string;
    try {
      ch1Html = await fetchHtml(ch1Url);
    } catch (err) {
      console.warn(`  [SKIP] Cannot fetch chapter 1 for ${book.usfmCode}: ${(err as Error).message}`);
      continue;
    }

    const maxChapters = extractMaxChapter(ch1Html);
    console.log(`  Chapters: ${maxChapters}`);

    const chapters = [];
    let bookVerses = 0;

    // Parse chapter 1 from the already-fetched HTML
    for (let cap = 1; cap <= maxChapters; cap++) {
      let html: string;

      if (cap === 1) {
        html = ch1Html;
      } else {
        await sleep(CHAPTER_FETCH_DELAY_MS);
        try {
          html = await fetchHtml(`${BASE_URL}${bookPath}?capitol=${cap}`);
        } catch (err) {
          console.warn(`  [WARN] Failed to fetch chapter ${cap}: ${(err as Error).message}`);
          break;
        }
      }

      const verses = parseChapterVerses(html);
      if (verses.length === 0) {
        console.warn(`  [WARN] No verses parsed for ${book.usfmCode} chapter ${cap}`);
        continue;
      }

      chapters.push(buildChapterEntry(cap, displayName, verses));
      bookVerses += verses.length;
    }

    if (chapters.length === 0) {
      console.warn(`  [SKIP] No chapters scraped for ${book.usfmCode}`);
      continue;
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

  if (unmatchedConfigs.length > 0) {
    console.warn(
      `\n[WARN] ${unmatchedConfigs.length} book(s) in booksConfig had no match on the site:\n` +
      unmatchedConfigs.map((s) => `  ${s}`).join('\n') +
      '\nUpdate the bookPath values in booksConfig to match the live site URLs.',
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
    website: 'https://biblia-online.ro',
    licenseUrl: 'https://biblia-online.ro',
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
