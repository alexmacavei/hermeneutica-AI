/**
 * biblia-pipeline.ts
 *
 * Complete pipeline:
 *  1) Scrape https://www.bibliaortodoxa.ro  → USFM files (one per book)
 *  2) Use @helloao/tools to parse USFM and generate API JSON → ./api-output/
 *  3) Aggregate generated JSON → data/bibles/ro_sinodala.json
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { generation } from '@helloao/tools';

const { dataset: datasetGen, api: apiGen } = generation;

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.bibliaortodoxa.ro';
const TRANSLATION_ID = 'ro_sinodala';
const USFM_OUTPUT_DIR = path.resolve(__dirname, '../usfm-output');
const API_OUTPUT_DIR = path.resolve(__dirname, '../api-output');
const BIBLES_DIR = path.resolve(__dirname, '../data/bibles');
const FINAL_OUTPUT = path.join(BIBLES_DIR, `${TRANSLATION_ID}.json`);

// ─── Types ───────────────────────────────────────────────────────────────────

type BookConfig = {
  /** Canonical order used by @helloao/tools (bookOrderMap values) */
  order: number;
  /** USFM book code, e.g. "GEN", "MAT" */
  usfmCode: string;
  /** Numeric book ID used by bibliaortodoxa.ro (?id=N) */
  siteId: number;
  /** Full Romanian name, used in \h / \toc1 */
  nameLong: string;
  /** Short Romanian name, used in \toc2 */
  nameShort: string;
  /** Abbreviation, used in \toc3 */
  nameAbbrev: string;
};

type Verse = { number: number; text: string };

// ─── Books configuration ─────────────────────────────────────────────────────
//
// siteId values for OT books are best-guess estimates based on the canonical
// Orthodox ordering and the known anchor point: Matthew = siteId 55.
// They will need verification against the live site before the first run.
//
// order values follow @helloao/tools bookOrderMap:
//   canonical Protestant canon:  GEN=1 … REV=66
//   apocryphal/deuterocanonical: TOB=67, JDT=68, ESG=69, WIS=70, SIR=71,
//     BAR=72, LJE=73, S3Y=74, SUS=75, BEL=76, 1MA=77, 2MA=78, 3MA=79,
//     4MA=80, 1ES=81, 2ES=82, MAN=83, PS2=84, ODA=85 …

const booksConfig: BookConfig[] = [
  // ── Pentateuch ──────────────────────────────────────────────────────────
  { order: 1,  usfmCode: 'GEN', siteId: 1,  nameLong: 'Facerea',           nameShort: 'Facerea',     nameAbbrev: 'Fac'    },
  { order: 2,  usfmCode: 'EXO', siteId: 2,  nameLong: 'Ieșirea',           nameShort: 'Ieșirea',     nameAbbrev: 'Ieș'    },
  { order: 3,  usfmCode: 'LEV', siteId: 3,  nameLong: 'Leviticul',         nameShort: 'Leviticul',   nameAbbrev: 'Lev'    },
  { order: 4,  usfmCode: 'NUM', siteId: 4,  nameLong: 'Numerele',          nameShort: 'Numerele',    nameAbbrev: 'Num'    },
  { order: 5,  usfmCode: 'DEU', siteId: 5,  nameLong: 'Deuteronomul',      nameShort: 'Deut.',       nameAbbrev: 'Deut'   },

  // ── Historical books ─────────────────────────────────────────────────────
  { order: 6,  usfmCode: 'JOS', siteId: 6,  nameLong: 'Iosua Navi',        nameShort: 'Iosua',       nameAbbrev: 'Ios'    },
  { order: 7,  usfmCode: 'JDG', siteId: 7,  nameLong: 'Judecători',        nameShort: 'Judecători',  nameAbbrev: 'Jud'    },
  { order: 8,  usfmCode: 'RUT', siteId: 8,  nameLong: 'Rut',               nameShort: 'Rut',         nameAbbrev: 'Rut'    },
  { order: 9,  usfmCode: '1SA', siteId: 9,  nameLong: 'I Regi',            nameShort: 'I Regi',      nameAbbrev: '1Reg'   },
  { order: 10, usfmCode: '2SA', siteId: 10, nameLong: 'II Regi',           nameShort: 'II Regi',     nameAbbrev: '2Reg'   },
  { order: 11, usfmCode: '1KI', siteId: 11, nameLong: 'III Regi',          nameShort: 'III Regi',    nameAbbrev: '3Reg'   },
  { order: 12, usfmCode: '2KI', siteId: 12, nameLong: 'IV Regi',           nameShort: 'IV Regi',     nameAbbrev: '4Reg'   },
  { order: 13, usfmCode: '1CH', siteId: 13, nameLong: 'I Paralipomene',    nameShort: 'I Paral.',    nameAbbrev: '1Par'   },
  { order: 14, usfmCode: '2CH', siteId: 14, nameLong: 'II Paralipomene',   nameShort: 'II Paral.',   nameAbbrev: '2Par'   },
  { order: 81, usfmCode: '1ES', siteId: 15, nameLong: 'I Ezdra',           nameShort: 'I Ezdra',     nameAbbrev: '1Ezd'   },
  { order: 15, usfmCode: 'EZR', siteId: 16, nameLong: 'II Ezdra',          nameShort: 'II Ezdra',    nameAbbrev: '2Ezd'   },
  { order: 16, usfmCode: 'NEH', siteId: 17, nameLong: 'Neemia',            nameShort: 'Neemia',      nameAbbrev: 'Neem'   },
  { order: 67, usfmCode: 'TOB', siteId: 18, nameLong: 'Tobit',             nameShort: 'Tobit',       nameAbbrev: 'Tob'    },
  { order: 68, usfmCode: 'JDT', siteId: 19, nameLong: 'Iudita',            nameShort: 'Iudita',      nameAbbrev: 'Iudt'   },
  { order: 17, usfmCode: 'EST', siteId: 20, nameLong: 'Estera',            nameShort: 'Estera',      nameAbbrev: 'Est'    },
  { order: 77, usfmCode: '1MA', siteId: 21, nameLong: 'I Macabei',         nameShort: 'I Macabei',   nameAbbrev: '1Mac'   },
  { order: 78, usfmCode: '2MA', siteId: 22, nameLong: 'II Macabei',        nameShort: 'II Macabei',  nameAbbrev: '2Mac'   },
  { order: 79, usfmCode: '3MA', siteId: 23, nameLong: 'III Macabei',       nameShort: 'III Macabei', nameAbbrev: '3Mac'   },

  // ── Poetic / Wisdom books ────────────────────────────────────────────────
  { order: 18, usfmCode: 'JOB', siteId: 24, nameLong: 'Iov',               nameShort: 'Iov',         nameAbbrev: 'Iov'    },
  { order: 19, usfmCode: 'PSA', siteId: 25, nameLong: 'Psalmii',           nameShort: 'Psalmii',     nameAbbrev: 'Ps'     },
  { order: 83, usfmCode: 'MAN', siteId: 26, nameLong: 'Rugăciunea lui Manase', nameShort: 'Rug. Manase', nameAbbrev: 'RgMan' },
  { order: 20, usfmCode: 'PRO', siteId: 27, nameLong: 'Pildele lui Solomon', nameShort: 'Pildele',   nameAbbrev: 'Pild'   },
  { order: 21, usfmCode: 'ECC', siteId: 28, nameLong: 'Eclesiastul',       nameShort: 'Eclesiastul', nameAbbrev: 'Eccl'   },
  { order: 22, usfmCode: 'SNG', siteId: 29, nameLong: 'Cântarea Cântărilor', nameShort: 'Cânt. Cânt.', nameAbbrev: 'Cânt' },
  { order: 70, usfmCode: 'WIS', siteId: 30, nameLong: 'Înțelepciunea lui Solomon', nameShort: 'Înț. Solomon', nameAbbrev: 'ÎnțSol' },
  { order: 71, usfmCode: 'SIR', siteId: 31, nameLong: 'Înțelepciunea lui Isus Sirah', nameShort: 'Sirah', nameAbbrev: 'Sir' },

  // ── Major prophets ───────────────────────────────────────────────────────
  { order: 23, usfmCode: 'ISA', siteId: 32, nameLong: 'Isaia',             nameShort: 'Isaia',       nameAbbrev: 'Is'     },
  { order: 24, usfmCode: 'JER', siteId: 33, nameLong: 'Ieremia',           nameShort: 'Ieremia',     nameAbbrev: 'Ier'    },
  { order: 25, usfmCode: 'LAM', siteId: 34, nameLong: 'Plângerile lui Ieremia', nameShort: 'Plângerile', nameAbbrev: 'Plâng' },
  { order: 72, usfmCode: 'BAR', siteId: 35, nameLong: 'Baruh',             nameShort: 'Baruh',       nameAbbrev: 'Bar'    },
  { order: 26, usfmCode: 'EZK', siteId: 36, nameLong: 'Iezechiel',         nameShort: 'Iezechiel',   nameAbbrev: 'Iez'    },
  { order: 27, usfmCode: 'DAN', siteId: 37, nameLong: 'Daniel',            nameShort: 'Daniel',      nameAbbrev: 'Dan'    },
  { order: 74, usfmCode: 'S3Y', siteId: 38, nameLong: 'Cântarea celor trei tineri', nameShort: 'Cânt. 3 tineri', nameAbbrev: 'S3Y' },
  { order: 75, usfmCode: 'SUS', siteId: 39, nameLong: 'Istoria Suzanei',   nameShort: 'Suzana',      nameAbbrev: 'Sus'    },
  { order: 76, usfmCode: 'BEL', siteId: 40, nameLong: 'Bel și Balaurul',   nameShort: 'Bel și Balaurul', nameAbbrev: 'Bel' },

  // ── Minor prophets ───────────────────────────────────────────────────────
  { order: 28, usfmCode: 'HOS', siteId: 41, nameLong: 'Osea',              nameShort: 'Osea',        nameAbbrev: 'Os'     },
  { order: 29, usfmCode: 'JOL', siteId: 42, nameLong: 'Ioil',              nameShort: 'Ioil',        nameAbbrev: 'Ioel'   },
  { order: 30, usfmCode: 'AMO', siteId: 43, nameLong: 'Amos',              nameShort: 'Amos',        nameAbbrev: 'Amos'   },
  { order: 31, usfmCode: 'OBA', siteId: 44, nameLong: 'Obadia',            nameShort: 'Obadia',      nameAbbrev: 'Obad'   },
  { order: 32, usfmCode: 'JON', siteId: 45, nameLong: 'Iona',              nameShort: 'Iona',        nameAbbrev: 'Ion'    },
  { order: 33, usfmCode: 'MIC', siteId: 46, nameLong: 'Mica',              nameShort: 'Mica',        nameAbbrev: 'Mica'   },
  { order: 34, usfmCode: 'NAM', siteId: 47, nameLong: 'Naum',              nameShort: 'Naum',        nameAbbrev: 'Naum'   },
  { order: 35, usfmCode: 'HAB', siteId: 48, nameLong: 'Habacuc',           nameShort: 'Habacuc',     nameAbbrev: 'Hab'    },
  { order: 36, usfmCode: 'ZEP', siteId: 49, nameLong: 'Sofonie',           nameShort: 'Sofonie',     nameAbbrev: 'Sof'    },
  { order: 37, usfmCode: 'HAG', siteId: 50, nameLong: 'Agheu',             nameShort: 'Agheu',       nameAbbrev: 'Ag'     },
  { order: 38, usfmCode: 'ZEC', siteId: 51, nameLong: 'Zaharia',           nameShort: 'Zaharia',     nameAbbrev: 'Zah'    },
  { order: 39, usfmCode: 'MAL', siteId: 52, nameLong: 'Maleahi',           nameShort: 'Maleahi',     nameAbbrev: 'Mal'    },
  { order: 84, usfmCode: 'PS2', siteId: 53, nameLong: 'Psalmul 151',       nameShort: 'Ps. 151',     nameAbbrev: 'Ps151'  },
  { order: 80, usfmCode: '4MA', siteId: 54, nameLong: 'IV Macabei',        nameShort: 'IV Macabei',  nameAbbrev: '4Mac'   },

  // ── New Testament ────────────────────────────────────────────────────────
  { order: 40, usfmCode: 'MAT', siteId: 55, nameLong: 'Matei',             nameShort: 'Matei',       nameAbbrev: 'Mat'    },
  { order: 41, usfmCode: 'MRK', siteId: 56, nameLong: 'Marcu',             nameShort: 'Marcu',       nameAbbrev: 'Mc'     },
  { order: 42, usfmCode: 'LUK', siteId: 57, nameLong: 'Luca',              nameShort: 'Luca',        nameAbbrev: 'Lc'     },
  { order: 43, usfmCode: 'JHN', siteId: 58, nameLong: 'Ioan',              nameShort: 'Ioan',        nameAbbrev: 'In'     },
  { order: 44, usfmCode: 'ACT', siteId: 59, nameLong: 'Faptele Apostolilor', nameShort: 'Faptele', nameAbbrev: 'FA'     },
  { order: 45, usfmCode: 'ROM', siteId: 60, nameLong: 'Romani',            nameShort: 'Romani',      nameAbbrev: 'Rom'    },
  { order: 46, usfmCode: '1CO', siteId: 61, nameLong: 'I Corinteni',       nameShort: 'I Cor.',      nameAbbrev: '1Cor'   },
  { order: 47, usfmCode: '2CO', siteId: 62, nameLong: 'II Corinteni',      nameShort: 'II Cor.',     nameAbbrev: '2Cor'   },
  { order: 48, usfmCode: 'GAL', siteId: 63, nameLong: 'Galateni',          nameShort: 'Galateni',    nameAbbrev: 'Gal'    },
  { order: 49, usfmCode: 'EPH', siteId: 64, nameLong: 'Efeseni',           nameShort: 'Efeseni',     nameAbbrev: 'Ef'     },
  { order: 50, usfmCode: 'PHP', siteId: 65, nameLong: 'Filipeni',          nameShort: 'Filipeni',    nameAbbrev: 'Flp'    },
  { order: 51, usfmCode: 'COL', siteId: 66, nameLong: 'Coloseni',          nameShort: 'Coloseni',    nameAbbrev: 'Col'    },
  { order: 52, usfmCode: '1TH', siteId: 67, nameLong: 'I Tesaloniceni',    nameShort: 'I Tes.',      nameAbbrev: '1Tes'   },
  { order: 53, usfmCode: '2TH', siteId: 68, nameLong: 'II Tesaloniceni',   nameShort: 'II Tes.',     nameAbbrev: '2Tes'   },
  { order: 54, usfmCode: '1TI', siteId: 69, nameLong: 'I Timotei',         nameShort: 'I Tim.',      nameAbbrev: '1Tim'   },
  { order: 55, usfmCode: '2TI', siteId: 70, nameLong: 'II Timotei',        nameShort: 'II Tim.',     nameAbbrev: '2Tim'   },
  { order: 56, usfmCode: 'TIT', siteId: 71, nameLong: 'Tit',               nameShort: 'Tit',         nameAbbrev: 'Tit'    },
  { order: 57, usfmCode: 'PHM', siteId: 72, nameLong: 'Filimon',           nameShort: 'Filimon',     nameAbbrev: 'Flm'    },
  { order: 58, usfmCode: 'HEB', siteId: 73, nameLong: 'Evrei',             nameShort: 'Evrei',       nameAbbrev: 'Evr'    },
  { order: 59, usfmCode: 'JAS', siteId: 74, nameLong: 'Iacov',             nameShort: 'Iacov',       nameAbbrev: 'Iac'    },
  { order: 60, usfmCode: '1PE', siteId: 75, nameLong: 'I Petru',           nameShort: 'I Pet.',      nameAbbrev: '1Pet'   },
  { order: 61, usfmCode: '2PE', siteId: 76, nameLong: 'II Petru',          nameShort: 'II Pet.',     nameAbbrev: '2Pet'   },
  { order: 62, usfmCode: '1JN', siteId: 77, nameLong: 'I Ioan',            nameShort: 'I In.',       nameAbbrev: '1In'    },
  { order: 63, usfmCode: '2JN', siteId: 78, nameLong: 'II Ioan',           nameShort: 'II In.',      nameAbbrev: '2In'    },
  { order: 64, usfmCode: '3JN', siteId: 79, nameLong: 'III Ioan',          nameShort: 'III In.',     nameAbbrev: '3In'    },
  { order: 65, usfmCode: 'JUD', siteId: 80, nameLong: 'Iuda',              nameShort: 'Iuda',        nameAbbrev: 'Iud'    },
  { order: 66, usfmCode: 'REV', siteId: 81, nameLong: 'Apocalipsa',        nameShort: 'Apocalipsa',  nameAbbrev: 'Apoc'   },
];

// ─── 1) Scraping helpers ──────────────────────────────────────────────────────

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

/** Probes chapters 1..maxTry until no verses are returned; returns the last valid chapter number. */
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

/** Generates a USFM file for a single book and writes it to outputDir. */
async function generateUsfmForBook(book: BookConfig, outputDir: string): Promise<void> {
  const filePath = path.join(outputDir, `${book.usfmCode}.usfm`);

  const header = [
    `\\id ${book.usfmCode}`,
    `\\usfm 3.0`,
    `\\h ${book.nameLong}`,
    `\\toc1 ${book.nameLong}`,
    `\\toc2 ${book.nameShort}`,
    `\\toc3 ${book.nameAbbrev}`,
    `\\mt1 ${book.nameLong}`,
    '',
  ].join('\n');

  const maxChapters = await detectMaxChapters(book.siteId);
  if (maxChapters === 0) {
    console.warn(`  [SKIP] No chapters found for ${book.usfmCode} (siteId=${book.siteId})`);
    return;
  }

  const chapterBlocks: string[] = [];
  for (let cap = 1; cap <= maxChapters; cap++) {
    const html = await fetchChapterHtml(book.siteId, cap);
    if (!html) break;

    const verses = parseChapterVerses(html);
    if (verses.length === 0) break;

    const lines: string[] = [`\\c ${cap}`, '\\p'];
    for (const v of verses) {
      lines.push(`\\v ${v.number} ${v.text}`);
    }
    chapterBlocks.push(lines.join('\n'));
    await sleep(300);
  }

  await fs.writeFile(filePath, header + chapterBlocks.join('\n\n'), 'utf-8');
  console.log(`  ✓ ${book.usfmCode} (${chapterBlocks.length} chapters)`);
}

/** Phase 1: scrape the site and write USFM files. */
async function runScrapingPhase(): Promise<void> {
  await fs.mkdir(USFM_OUTPUT_DIR, { recursive: true });
  console.log('\n=== Phase 1: Scraping → USFM ===');

  const sorted = [...booksConfig].sort((a, b) => a.siteId - b.siteId);
  for (const book of sorted) {
    console.log(`\n[${book.usfmCode}] siteId=${book.siteId} — ${book.nameLong}`);
    await generateUsfmForBook(book, USFM_OUTPUT_DIR);
  }
}

// ─── 2) USFM → JSON  (via @helloao/tools) ───────────────────────────────────
//
// NOTE: This replaces a call to `npx helloao generate-translation-files`.
// If you prefer the CLI approach, install @helloao/tools globally and run:
//   npx ts-node -e "require('child_process').execSync(
//     'npx helloao generate-translation-files ./usfm-output ./api-output',
//     { stdio: 'inherit' }
//   )"

/** Minimal DOMParser stub – only needed for non-USFM formats; unused here. */
class StubDOMParser {
  parseFromString(_content: string, _mimeType: string): Document {
    throw new Error('DOMParser is not implemented in this pipeline. Only USFM format is supported. Ensure all input files are in USFM format.');
  }
}

/** Phase 2: convert USFM files to helloao API JSON in ./api-output/. */
async function runHelloAoCli(): Promise<void> {
  console.log('\n=== Phase 2: USFM → JSON (via @helloao/tools) ===');
  await fs.mkdir(API_OUTPUT_DIR, { recursive: true });

  // Read USFM files generated in phase 1
  const usfmFiles = (await fs.readdir(USFM_OUTPUT_DIR)).filter((f) => f.endsWith('.usfm'));
  if (usfmFiles.length === 0) {
    throw new Error(`No .usfm files found in ${USFM_OUTPUT_DIR}. Ensure the scraping phase completed successfully and generated files.`);
  }

  const translationMetadata = {
    id: TRANSLATION_ID,
    name: 'Biblia Sinodală',
    englishName: 'Romanian Synodal Bible',
    shortName: 'Sinodală',
    website: 'https://www.bibliaortodoxa.ro',
    licenseUrl: 'https://www.bibliaortodoxa.ro',
    language: 'ro',
    direction: 'ltr' as const,
  };

  const inputFiles = await Promise.all(
    usfmFiles.map(async (filename) => ({
      fileType: 'usfm' as const,
      name: filename,
      content: await fs.readFile(path.join(USFM_OUTPUT_DIR, filename), 'utf-8'),
      metadata: translationMetadata,
    })),
  );

  const dataset = datasetGen.generateDataset(inputFiles, new StubDOMParser() as unknown as DOMParser);
  const apiOutput = apiGen.generateApiForDataset(dataset, {
    generateCompleteTranslationFiles: true,
  });
  const outputFiles = apiGen.generateFilesForApi(apiOutput);

  for (const file of outputFiles) {
    const dest = path.join(API_OUTPUT_DIR, file.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });

    const rawContent =
      typeof file.content === 'function' ? await file.content() : file.content;
    await fs.writeFile(dest, JSON.stringify(rawContent, null, 2), 'utf-8');
  }

  console.log(`  ✓ ${outputFiles.length} files written to ${API_OUTPUT_DIR}`);
}

// ─── 3) Aggregate into data/bibles/ro_sinodala.json ──────────────────────────

/** Phase 3: read API output files and pack them into a single JSON file. */
async function packBibleJson(): Promise<void> {
  console.log('\n=== Phase 3: Aggregating → ro_sinodala.json ===');

  // Auto-detect translationId (first sub-directory of api-output)
  const entries = await fs.readdir(API_OUTPUT_DIR, { withFileTypes: true });
  const translationId =
    entries.find((e) => e.isDirectory())?.name ?? TRANSLATION_ID;

  const translationDir = path.join(API_OUTPUT_DIR, translationId);

  // Read translation metadata from available_translations.json
  const translationsFile = path.join(API_OUTPUT_DIR, 'available_translations.json');
  const translationsJson = JSON.parse(await fs.readFile(translationsFile, 'utf-8')) as {
    translations: Array<Record<string, unknown>>;
  };
  const metadata =
    translationsJson.translations.find((t) => t['id'] === translationId) ??
    translationsJson.translations[0];

  // Read books list
  const booksFile = path.join(translationDir, 'books.json');
  const booksJson = JSON.parse(await fs.readFile(booksFile, 'utf-8')) as {
    books: Array<{ id: string; name: string; numChapters?: number; numberOfChapters?: number }>;
  };

  // For each book, read all chapter files
  const books = await Promise.all(
    booksJson.books.map(async (book) => {
      const numChapters = book.numChapters ?? book.numberOfChapters ?? 0;
      const chapters = [];

      for (let chNum = 1; chNum <= numChapters; chNum++) {
        const chapterFile = path.join(translationDir, book.id, `${chNum}.json`);
        try {
          const chapterJson = JSON.parse(await fs.readFile(chapterFile, 'utf-8'));
          chapters.push(chapterJson);
        } catch {
          // Missing chapter file – skip silently
        }
      }

      return { ...book, chapters };
    }),
  );

  const finalOutput = { metadata, books };

  await fs.mkdir(BIBLES_DIR, { recursive: true });
  await fs.writeFile(FINAL_OUTPUT, JSON.stringify(finalOutput, null, 2), 'utf-8');

  console.log(`  ✓ Written: ${FINAL_OUTPUT}`);
  console.log(`    ${books.length} books, ${books.reduce((s, b) => s + b.chapters.length, 0)} chapters`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await runScrapingPhase();
  await runHelloAoCli();
  await packBibleJson();
  console.log('\n✅ Pipeline complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
