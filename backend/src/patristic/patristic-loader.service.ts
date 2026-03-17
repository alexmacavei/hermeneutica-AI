import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  PATRISTIC_CHUNK_OVERLAP,
  PATRISTIC_CHUNK_SIZE,
  PATRISTIC_SUPPORTED_EXTENSIONS,
} from './pipeline.config';

/**
 * Entry derived from a NewAdvent-style `index.html` that maps a filename to
 * its author and work title.
 */
export interface IndexEntry {
  /** Church Father name as listed in the index. */
  author: string;
  /** Full title of the work as listed in the index. */
  work: string;
}

/** Metadata derived from a patristic source file. */
export interface PatristicMetadata {
  /** Church Father or author name, inferred from the directory name. */
  author: string;
  /** Name of the work/treatise, inferred from the parent directory name. */
  work: string;
  /** Chapter or section identifier (file name without extension). */
  chapter: string;
  /** Absolute path to the source file (used as a stable identifier). */
  sourceFile: string;
  /**
   * Optional URL hint embedded in the HTML `<link rel="canonical">` tag or
   * first `<a>` pointing to a known patristic site (e.g. newadvent.org).
   */
  sourceUrl?: string;
}

/** A single text chunk together with its source metadata. */
export interface PatristicChunk {
  metadata: PatristicMetadata;
  /** 0-based position of this chunk within its source file. */
  chunkIndex: number;
  /** The plain-text content of this chunk. */
  text: string;
}

@Injectable()
export class PatristicLoaderService {
  private readonly logger = new Logger(PatristicLoaderService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Scans `PATRISTIC_DATA_DIR` recursively and returns all text chunks for
   * every supported file (.html, .htm, .txt) found inside it.
   *
   * Returns an empty array when the directory is not configured or does not
   * exist, so the pipeline degrades gracefully.
   */
  async loadAll(): Promise<PatristicChunk[]> {
    const dataDir = this.configService.get<string>('patristicDataDir');
    if (!dataDir) {
      this.logger.warn(
        'PATRISTIC_DATA_DIR is not set; skipping patristic ingestion.',
      );
      return [];
    }

    if (!fs.existsSync(dataDir)) {
      this.logger.warn(
        `PATRISTIC_DATA_DIR "${dataDir}" does not exist; skipping patristic ingestion.`,
      );
      return [];
    }

    const files = this.collectFiles(dataDir);
    this.logger.log(`Found ${files.length} patristic source file(s).`);

    const indexMaps = this.buildDirectoryIndexMaps(dataDir);

    const allChunks: PatristicChunk[] = [];
    for (const filePath of files) {
      try {
        const dir = path.dirname(filePath);
        const fileName = path.basename(filePath).toLowerCase();
        const indexEntry = indexMaps.get(dir)?.get(fileName);
        const chunks = await this.processFile(filePath, dataDir, indexEntry);
        allChunks.push(...chunks);
      } catch (error) {
        this.logger.error(`Failed to process file "${filePath}"`, error);
      }
    }

    this.logger.log(`Loaded ${allChunks.length} chunk(s) from patristic files.`);
    return allChunks;
  }

  /**
   * Processes a single file: reads, cleans HTML/text, extracts metadata, and
   * splits the content into fixed-size chunks with overlap.
   *
   * When `indexEntry` is provided (from a parsed NewAdvent-style `index.html`)
   * its author/work values override the directory-based inference.
   */
  async processFile(
    filePath: string,
    baseDir: string,
    indexEntry?: IndexEntry,
  ): Promise<PatristicChunk[]> {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    const sourceUrl = ext === '.html' || ext === '.htm'
      ? this.extractCanonicalUrl(raw)
      : undefined;

    const plainText = ext === '.html' || ext === '.htm'
      ? this.cleanHtml(raw)
      : raw;

    const metadata = this.extractMetadata(filePath, baseDir, sourceUrl, indexEntry);
    const chunks = this.splitIntoChunks(plainText, metadata);
    return chunks;
  }

  // ─── HTML Cleaning ───────────────────────────────────────────────────────────

  /**
   * Strips HTML markup from a raw HTML string, returning plain text.
   *
   * Handles:
   * - `<script>` / `<style>` blocks (removed entirely with their content)
   * - HTML comments
   * - Footnote/endnote references (e.g. `<sup>`, `<a>` with numeric text)
   * - All remaining tags
   * - Excess whitespace
   */
  cleanHtml(html: string): string {
    let text = html;

    // Remove <script> and <style> blocks entirely
    text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script[^>]*>/gi, ' ');
    text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style[^>]*>/gi, ' ');

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, ' ');

    // Remove <sup> tags (footnote markers like ¹ ² or [1])
    text = text.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, ' ');

    // Remove all remaining tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities (&amp; last to avoid double-unescaping)
    text = text
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&mdash;/gi, '\u2014')
      .replace(/&ndash;/gi, '\u2013')
      .replace(/&ldquo;/gi, '\u201C')
      .replace(/&rdquo;/gi, '\u201D')
      .replace(/&lsquo;/gi, '\u2018')
      .replace(/&rsquo;/gi, '\u2019')
      .replace(/&#x[0-9a-fA-F]+;/g, ' ')
      .replace(/&#\d+;/g, ' ')
      // &amp; is decoded last so that e.g. &amp;lt; becomes &lt; (not <)
      .replace(/&amp;/gi, '&');

    // Collapse whitespace
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  }

  /**
   * Tries to extract a canonical URL from `<link rel="canonical" href="...">`.
   * Falls back to `undefined` if none is found.
   */
  extractCanonicalUrl(html: string): string | undefined {
    const match = html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    );
    return match?.[1];
  }

  // ─── Metadata Extraction ─────────────────────────────────────────────────────

  /**
   * Derives author / work / chapter from the file's path relative to the
   * base patristic data directory.
   *
   * Expected directory conventions (flexible – extras are tolerated):
   *   <baseDir>/<author>/<work>/<chapter>.html   → 3-level
   *   <baseDir>/<author>/<chapter>.html           → 2-level (work = author)
   *   <baseDir>/<chapter>.html                    → 1-level (author = work = 'unknown')
   *
   * When `indexEntry` is provided its `author` and `work` values take
   * precedence over the directory-based inference (used for NewAdvent files
   * where the `index.html` carries authoritative author/title information).
   */
  extractMetadata(
    filePath: string,
    baseDir: string,
    sourceUrl?: string,
    indexEntry?: IndexEntry,
  ): PatristicMetadata {
    const relative = path.relative(baseDir, filePath);
    const parts = relative.split(path.sep);
    const fileName = parts[parts.length - 1] ?? '';
    const chapter = path.basename(fileName, path.extname(fileName));

    let author = 'unknown';
    let work = 'unknown';

    if (parts.length >= 3) {
      author = parts[0] ?? 'unknown';
      work = parts[parts.length - 2] ?? 'unknown';
    } else if (parts.length === 2) {
      author = parts[0] ?? 'unknown';
      work = author;
    }

    if (indexEntry) {
      author = indexEntry.author;
      work = indexEntry.work;
    }

    return { author, work, chapter, sourceFile: filePath, sourceUrl };
  }

  // ─── Chunking ────────────────────────────────────────────────────────────────

  /**
   * Splits `text` into overlapping chunks of approximately `PATRISTIC_CHUNK_SIZE`
   * characters, trying to break at sentence boundaries (`.`, `!`, `?`) when
   * possible so that chunks remain semantically coherent.
   */
  splitIntoChunks(
    text: string,
    metadata: PatristicMetadata,
  ): PatristicChunk[] {
    const chunks: PatristicChunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      let end = Math.min(start + PATRISTIC_CHUNK_SIZE, text.length);

      // Try to break at a sentence boundary within the last 20% of the window
      if (end < text.length) {
        const searchFrom = Math.floor(start + PATRISTIC_CHUNK_SIZE * 0.8);
        const slice = text.slice(searchFrom, end);
        const boundary = Math.max(
          slice.lastIndexOf('. '),
          slice.lastIndexOf('! '),
          slice.lastIndexOf('? '),
          slice.lastIndexOf('\n'),
        );
        if (boundary !== -1) {
          end = searchFrom + boundary + 1;
        }
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({ metadata, chunkIndex, text: chunkText });
        chunkIndex++;
      }

      // Once we have consumed all text, stop.
      if (end >= text.length) break;

      // Advance start with overlap so context carries over
      start = Math.max(end - PATRISTIC_CHUNK_OVERLAP, start + 1);
    }

    return chunks;
  }

  // ─── File Discovery ──────────────────────────────────────────────────────────

  /**
   * Recursively collects all files under `dir` whose extension is in
   * `PATRISTIC_SUPPORTED_EXTENSIONS`.
   *
   * Files named `index.html` or `index.htm` are intentionally excluded: they
   * are site-navigation pages (as in the NewAdvent mirror), not primary
   * content files.
   */
  collectFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.collectFiles(fullPath));
      } else if (entry.isFile()) {
        const nameLower = entry.name.toLowerCase();
        if (nameLower === 'index.html' || nameLower === 'index.htm') {
          continue; // skip navigation pages
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (PATRISTIC_SUPPORTED_EXTENSIONS.includes(ext)) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }

  // ─── NewAdvent Index Parsing ─────────────────────────────────────────────────

  /**
   * Parses a NewAdvent-style `index.html` that lists patristic works per
   * author, e.g.:
   *
   * ```html
   * <a><strong>Athanasius</strong></a>
   * <a href="../fathers/2801.htm">Against the Heathen</a>
   * <a href="../fathers/2802.htm">On the Incarnation of the Word</a>
   * ```
   *
   * Walks the HTML sequentially so that each work link is associated with the
   * most recently seen author heading.
   *
   * Returns a map from **lowercase filename** (e.g. `"2801.htm"`) to its
   * `{ author, work }` entry.  Non-numeric filenames are ignored so that
   * unrelated navigation links are not collected.
   */
  parseNewAdventIndex(html: string): Map<string, IndexEntry> {
    const map = new Map<string, IndexEntry>();
    let currentAuthor = 'unknown';

    /**
     * A single combined regex is used deliberately so the two patterns are
     * matched in document order, which lets us associate each work link with
     * the most recently seen author heading.
     *
     * The regex alternates between two forms:
     *
     *   Form (1) – author heading  <a [no-href]><strong>Name</strong></a>
     *     m[1] captures the content inside <strong> (may contain inner tags).
     *     m[2] and m[3] are undefined.
     *
     *   Form (2) – work link  <a href="...path/NNNN.htm[l]">Title</a>
     *     m[1] is undefined.
     *     m[2] captures the raw href value.
     *     m[3] captures the visible link text (work title).
     */
    const re =
      /<a(?:\s[^>]*)?>[\s\r\n]*<strong[^>]*>([\s\S]*?)<\/strong>[\s\r\n]*<\/a>|<a\s[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;

    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (m[1] !== undefined) {
        // Author heading: reuse cleanHtml() to correctly strip any inner tags
        // (e.g. <em>) before normalising whitespace.
        currentAuthor = this.normalizeWhitespace(this.cleanHtml(m[1]));
      } else if (m[2] !== undefined && m[3] !== undefined) {
        // Work link – keep only numbered .htm / .html filenames.
        const fileName = this.extractFilename(m[2]);
        if (fileName && /^\d+\.html?$/.test(fileName)) {
          map.set(fileName, {
            author: currentAuthor,
            work: this.normalizeWhitespace(m[3]),
          });
        }
      }
    }

    return map;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Extracts the lowercase filename from an href, stripping any query string
   * and fragment (e.g. `"../fathers/2801.htm?v=2#top"` → `"2801.htm"`).
   */
  private extractFilename(href: string): string {
    return path.basename(href).split('?')[0].split('#')[0].toLowerCase();
  }

  /**
   * Collapses runs of whitespace into a single space and trims the result.
   * Used to normalise author names and work titles extracted from HTML.
   */
  private normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Walks `baseDir` recursively, finds every `index.html` / `index.htm`, and
   * attempts to parse it as a NewAdvent-style work listing.
   *
   * Returns a map keyed by **absolute directory path** to per-filename index
   * map (as returned by `parseNewAdventIndex`).  Only directories that
   * produced at least one entry are included.
   */
  buildDirectoryIndexMaps(
    baseDir: string,
  ): Map<string, Map<string, IndexEntry>> {
    const result = new Map<string, Map<string, IndexEntry>>();

    const scan = (dir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.isDirectory()) {
          scan(path.join(dir, entry.name));
        } else if (
          entry.isFile() &&
          (entry.name.toLowerCase() === 'index.html' ||
            entry.name.toLowerCase() === 'index.htm')
        ) {
          try {
            const html = fs.readFileSync(
              path.join(dir, entry.name),
              'utf-8',
            );
            const indexMap = this.parseNewAdventIndex(html);
            if (indexMap.size > 0) {
              result.set(dir, indexMap);
              this.logger.log(
                `Parsed index "${entry.name}" in "${dir}": ${indexMap.size} entry(ies).`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Could not parse index file "${path.join(dir, entry.name)}": ${error}`,
            );
          }
        }
      }
    };

    scan(baseDir);
    return result;
  }
}
