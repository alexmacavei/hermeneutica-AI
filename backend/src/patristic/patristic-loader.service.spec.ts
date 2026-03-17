import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PatristicLoaderService } from './patristic-loader.service';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('PatristicLoaderService', () => {
  let service: PatristicLoaderService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatristicLoaderService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PatristicLoaderService>(PatristicLoaderService);
  });

  // ─── loadAll() ──────────────────────────────────────────────────────────────

  describe('loadAll()', () => {
    it('should return empty array when PATRISTIC_DATA_DIR is not set', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.loadAll();

      expect(result).toEqual([]);
    });

    it('should return empty array when PATRISTIC_DATA_DIR does not exist', async () => {
      mockConfigService.get.mockReturnValue('/nonexistent/dir');
      mockFs.existsSync.mockReturnValue(false);

      const result = await service.loadAll();

      expect(result).toEqual([]);
    });
  });

  // ─── cleanHtml() ────────────────────────────────────────────────────────────

  describe('cleanHtml()', () => {
    it('should strip basic HTML tags', () => {
      const html = '<p>Hello <b>world</b>!</p>';
      expect(service.cleanHtml(html)).toBe('Hello world !');
    });

    it('should remove <script> blocks entirely', () => {
      const html = '<p>Text</p><script>alert("xss")</script><p>After</p>';
      const result = service.cleanHtml(html);
      expect(result).not.toContain('alert');
      expect(result).toContain('Text');
      expect(result).toContain('After');
    });

    it('should remove <style> blocks entirely', () => {
      const html = '<style>.foo { color: red; }</style><p>Content</p>';
      const result = service.cleanHtml(html);
      expect(result).not.toContain('color');
      expect(result).toContain('Content');
    });

    it('should remove <sup> footnote markers', () => {
      const html = '<p>Text<sup>1</sup> continues.</p>';
      const result = service.cleanHtml(html);
      expect(result).not.toContain('<sup>');
      expect(result).toContain('Text');
      expect(result).toContain('continues.');
    });

    it('should remove HTML comments', () => {
      const html = '<p>Visible<!-- hidden comment -->text</p>';
      const result = service.cleanHtml(html);
      expect(result).not.toContain('hidden comment');
      expect(result).toContain('Visible');
      expect(result).toContain('text');
    });

    it('should decode common HTML entities', () => {
      const html = '<p>A &amp; B &lt;C&gt; &quot;D&quot; &nbsp;E</p>';
      const result = service.cleanHtml(html);
      expect(result).toContain('A & B');
      expect(result).toContain('<C>');
      expect(result).toContain('"D"');
    });

    it('should collapse excess whitespace', () => {
      const html = '<p>  Too   many   spaces  </p>';
      const result = service.cleanHtml(html);
      expect(result).toBe('Too many spaces');
    });
  });

  // ─── extractCanonicalUrl() ──────────────────────────────────────────────────

  describe('extractCanonicalUrl()', () => {
    it('should extract canonical URL from link tag', () => {
      const html =
        '<link rel="canonical" href="https://www.newadvent.org/fathers/1301.htm">';
      expect(service.extractCanonicalUrl(html)).toBe(
        'https://www.newadvent.org/fathers/1301.htm',
      );
    });

    it('should return undefined when no canonical link is present', () => {
      const html = '<p>No canonical link here</p>';
      expect(service.extractCanonicalUrl(html)).toBeUndefined();
    });
  });

  // ─── extractMetadata() ──────────────────────────────────────────────────────

  describe('extractMetadata()', () => {
    it('should extract author, work, chapter from 3-level path', () => {
      const baseDir = '/data/patristic';
      const filePath = path.join(baseDir, 'chrysostom', 'homilies-matthew', 'homily1.html');
      const meta = service.extractMetadata(filePath, baseDir);

      expect(meta.author).toBe('chrysostom');
      expect(meta.work).toBe('homilies-matthew');
      expect(meta.chapter).toBe('homily1');
      expect(meta.sourceFile).toBe(filePath);
    });

    it('should handle 2-level path (no explicit work directory)', () => {
      const baseDir = '/data/patristic';
      const filePath = path.join(baseDir, 'chrysostom', 'homily1.html');
      const meta = service.extractMetadata(filePath, baseDir);

      expect(meta.author).toBe('chrysostom');
      expect(meta.work).toBe('chrysostom');
      expect(meta.chapter).toBe('homily1');
    });

    it('should handle 1-level path (file directly in baseDir)', () => {
      const baseDir = '/data/patristic';
      const filePath = path.join(baseDir, 'text.html');
      const meta = service.extractMetadata(filePath, baseDir);

      expect(meta.author).toBe('unknown');
      expect(meta.work).toBe('unknown');
      expect(meta.chapter).toBe('text');
    });

    it('should attach the provided sourceUrl', () => {
      const baseDir = '/data/patristic';
      const filePath = path.join(baseDir, 'author', 'work', 'ch1.html');
      const url = 'https://www.newadvent.org/fathers/0101.htm';
      const meta = service.extractMetadata(filePath, baseDir, url);

      expect(meta.sourceUrl).toBe(url);
    });

    it('should override author and work from indexEntry when provided', () => {
      const baseDir = '/data/patristic';
      const filePath = path.join(baseDir, 'fathers', '2801.htm');
      const meta = service.extractMetadata(filePath, baseDir, undefined, {
        author: 'Athanasius',
        work: 'Against the Heathen',
      });

      expect(meta.author).toBe('Athanasius');
      expect(meta.work).toBe('Against the Heathen');
      expect(meta.chapter).toBe('2801');
    });
  });

  // ─── splitIntoChunks() ──────────────────────────────────────────────────────

  describe('splitIntoChunks()', () => {
    const dummyMetadata = {
      author: 'author',
      work: 'work',
      chapter: 'ch1',
      sourceFile: '/data/patristic/author/work/ch1.html',
    };

    it('should return a single chunk when text is short', () => {
      const text = 'Short text.';
      const chunks = service.splitIntoChunks(text, dummyMetadata);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.text).toBe('Short text.');
      expect(chunks[0]?.chunkIndex).toBe(0);
    });

    it('should produce multiple chunks for long text', () => {
      const text = 'A'.repeat(2000);
      const chunks = service.splitIntoChunks(text, dummyMetadata);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should assign sequential chunkIndex values', () => {
      const text = 'Word '.repeat(300); // ~1500 chars
      const chunks = service.splitIntoChunks(text, dummyMetadata);

      chunks.forEach((chunk, i) => {
        expect(chunk.chunkIndex).toBe(i);
      });
    });

    it('should attach metadata to every chunk', () => {
      const text = 'B'.repeat(1600);
      const chunks = service.splitIntoChunks(text, dummyMetadata);

      for (const chunk of chunks) {
        expect(chunk.metadata).toBe(dummyMetadata);
      }
    });

    it('should return empty array for empty text', () => {
      const chunks = service.splitIntoChunks('', dummyMetadata);
      expect(chunks).toEqual([]);
    });
  });

  // ─── collectFiles() ─────────────────────────────────────────────────────────

  describe('collectFiles()', () => {
    it('should collect .html and .txt files recursively', () => {
      const fakeEntries = [
        { name: 'chrysostom', isDirectory: () => true, isFile: () => false },
        { name: 'notes.txt', isDirectory: () => false, isFile: () => true },
        { name: 'ignore.pdf', isDirectory: () => false, isFile: () => true },
      ] as unknown as fs.Dirent[];

      const fakeSub = [
        { name: 'homily1.html', isDirectory: () => false, isFile: () => true },
      ] as unknown as fs.Dirent[];

      (mockFs.readdirSync as jest.Mock)
        .mockReturnValueOnce(fakeEntries)
        .mockReturnValueOnce(fakeSub);

      const files = service.collectFiles('/data/patristic');

      expect(files).toContain(path.join('/data/patristic', 'notes.txt'));
      expect(files).toContain(
        path.join('/data/patristic', 'chrysostom', 'homily1.html'),
      );
      expect(files).not.toContain(
        path.join('/data/patristic', 'ignore.pdf'),
      );
    });

    it('should exclude index.html navigation files', () => {
      const fakeEntries = [
        { name: 'index.html', isDirectory: () => false, isFile: () => true },
        { name: 'INDEX.HTM', isDirectory: () => false, isFile: () => true },
        { name: '2801.htm', isDirectory: () => false, isFile: () => true },
      ] as unknown as fs.Dirent[];

      (mockFs.readdirSync as jest.Mock).mockReturnValueOnce(fakeEntries);

      const files = service.collectFiles('/data/patristic/fathers');

      expect(files).not.toContain(
        path.join('/data/patristic/fathers', 'index.html'),
      );
      expect(files).not.toContain(
        path.join('/data/patristic/fathers', 'INDEX.HTM'),
      );
      expect(files).toContain(
        path.join('/data/patristic/fathers', '2801.htm'),
      );
    });
  });

  // ─── parseNewAdventIndex() ──────────────────────────────────────────────────

  describe('parseNewAdventIndex()', () => {
    it('should parse author headings and associate works correctly', () => {
      const html = `
        <p><a><strong>Athanasius</strong></a>
        <font color="#EC9800">[DOCTOR]</font>
        <br>&nbsp;&nbsp;-&nbsp;<a href="../fathers/2801.htm">Against the Heathen</a>
        <br>&nbsp;&nbsp;-&nbsp;<a href="../fathers/2802.htm">On the Incarnation of the Word</a>
        </p>`;

      const map = service.parseNewAdventIndex(html);

      expect(map.get('2801.htm')).toEqual({
        author: 'Athanasius',
        work: 'Against the Heathen',
      });
      expect(map.get('2802.htm')).toEqual({
        author: 'Athanasius',
        work: 'On the Incarnation of the Word',
      });
    });

    it('should associate each work with the most recently seen author', () => {
      const html = `
        <a><strong>Athanasius</strong></a>
        <a href="../fathers/2801.htm">Against the Heathen</a>
        <a><strong>Basil</strong></a>
        <a href="../fathers/3001.htm">Letters of St. Basil</a>`;

      const map = service.parseNewAdventIndex(html);

      expect(map.get('2801.htm')?.author).toBe('Athanasius');
      expect(map.get('3001.htm')?.author).toBe('Basil');
    });

    it('should ignore non-numeric hrefs (navigation links)', () => {
      const html = `
        <a><strong>Tertullian</strong></a>
        <a href="../fathers/0301.htm">Apology</a>
        <a href="mailto:webmaster@newadvent.org">Contact</a>
        <a href="about.html">About</a>`;

      const map = service.parseNewAdventIndex(html);

      expect(map.size).toBe(1);
      expect(map.has('0301.htm')).toBe(true);
    });

    it('should return an empty map for HTML with no recognisable entries', () => {
      const html = '<p>No links here at all.</p>';
      const map = service.parseNewAdventIndex(html);
      expect(map.size).toBe(0);
    });

    it('should normalise filenames to lowercase', () => {
      const html = `
        <a><strong>Origen</strong></a>
        <a href="../fathers/0900.HTM">De Principiis</a>`;

      const map = service.parseNewAdventIndex(html);

      expect(map.has('0900.htm')).toBe(true);
      expect(map.get('0900.htm')?.author).toBe('Origen');
    });

    it('should strip extra tags from the author name', () => {
      const html = `
        <a><strong>Clement <em>of Alexandria</em></strong></a>
        <a href="../fathers/0210.htm">Exhortation to the Heathen</a>`;

      const map = service.parseNewAdventIndex(html);

      expect(map.get('0210.htm')?.author).toBe('Clement of Alexandria');
    });
  });

  // ─── buildDirectoryIndexMaps() ──────────────────────────────────────────────

  describe('buildDirectoryIndexMaps()', () => {
    it('should find and parse an index.html in a subdirectory', () => {
      const baseDir = '/data/patristic';
      const fathersDir = path.join(baseDir, 'fathers');
      const indexHtml = `
        <a><strong>Athanasius</strong></a>
        <a href="../fathers/2801.htm">Against the Heathen</a>`;

      // readdirSync for baseDir → one subdirectory "fathers"
      (mockFs.readdirSync as jest.Mock)
        .mockReturnValueOnce([
          { name: 'fathers', isDirectory: () => true, isFile: () => false },
        ] as unknown as fs.Dirent[])
        // readdirSync for fathers/ → index.html
        .mockReturnValueOnce([
          { name: 'index.html', isDirectory: () => false, isFile: () => true },
        ] as unknown as fs.Dirent[]);

      // readFileSync: first call for index.html, then existsSync+readFileSync
      // for the sub-link expansion of 2801.htm (file does not exist).
      (mockFs.readFileSync as jest.Mock).mockReturnValue(indexHtml);
      (mockFs.existsSync as jest.Mock).mockReturnValue(false);

      const maps = service.buildDirectoryIndexMaps(baseDir);

      expect(maps.has(fathersDir)).toBe(true);
      expect(maps.get(fathersDir)?.get('2801.htm')).toEqual({
        author: 'Athanasius',
        work: 'Against the Heathen',
      });
    });

    it('should not add a directory entry when no entries are parsed', () => {
      const baseDir = '/data/patristic';

      (mockFs.readdirSync as jest.Mock)
        .mockReturnValueOnce([
          { name: 'index.html', isDirectory: () => false, isFile: () => true },
        ] as unknown as fs.Dirent[]);

      // index.html has no recognisable entries
      (mockFs.readFileSync as jest.Mock).mockReturnValue('<p>Empty</p>');

      const maps = service.buildDirectoryIndexMaps(baseDir);

      expect(maps.size).toBe(0);
    });

    it('should expand book-level files from an intermediate work page', () => {
      const baseDir = '/data/patristic';
      const fathersDir = path.join(baseDir, 'fathers');

      // fathers/index.html maps 3404.htm → Ambrose / "On the Christian Faith"
      const indexHtml = `
        <a><strong>Ambrose (340-397)</strong></a>
        <a href="../fathers/3404.htm">On the Christian Faith (De fide)</a>`;

      // 3404.htm links to book sub-pages
      const workHtml = `
        <p><a href="../fathers/34041.htm">Book I</a>
        <br><a href="../fathers/34042.htm">Book II</a>
        <br><a href="../fathers/34043.htm">Book III</a>
        </p>`;

      (mockFs.readdirSync as jest.Mock)
        .mockReturnValueOnce([
          { name: 'fathers', isDirectory: () => true, isFile: () => false },
        ] as unknown as fs.Dirent[])
        .mockReturnValueOnce([
          { name: 'index.html', isDirectory: () => false, isFile: () => true },
        ] as unknown as fs.Dirent[]);

      // readFileSync: first for index.html, then for 3404.htm
      (mockFs.readFileSync as jest.Mock)
        .mockReturnValueOnce(indexHtml)
        .mockReturnValueOnce(workHtml);

      // existsSync returns true for the work file 3404.htm
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const maps = service.buildDirectoryIndexMaps(baseDir);
      const dirMap = maps.get(fathersDir);

      // Original entry is preserved
      expect(dirMap?.get('3404.htm')).toEqual({
        author: 'Ambrose (340-397)',
        work: 'On the Christian Faith (De fide)',
      });

      // Book-level files inherit the parent author and work
      expect(dirMap?.get('34041.htm')).toEqual({
        author: 'Ambrose (340-397)',
        work: 'On the Christian Faith (De fide)',
      });
      expect(dirMap?.get('34042.htm')).toEqual({
        author: 'Ambrose (340-397)',
        work: 'On the Christian Faith (De fide)',
      });
      expect(dirMap?.get('34043.htm')).toEqual({
        author: 'Ambrose (340-397)',
        work: 'On the Christian Faith (De fide)',
      });
    });

    it('should preserve author/work for a single-level content file with no sub-books', () => {
      const baseDir = '/data/patristic';
      const fathersDir = path.join(baseDir, 'fathers');

      // fathers/index.html maps 2903.htm → Gregory of Nyssa
      // (a single-page work with no book sub-links)
      const indexHtml = `
        <a><strong>Gregory of Nyssa</strong></a>
        <a href="../fathers/2903.htm">On the Holy Spirit, Against the Macedonians</a>`;

      // 2903.htm contains actual patristic content directly.
      // It has only encyclopedia cross-reference links (non-numeric hrefs)
      // and no numbered patristic sub-links.
      const contentHtml = `
        <div id="springfield2">
          <h1>On the Holy Spirit, Against the Macedonians</h1>
          <p>Forasmuch as the <a href="../cathen/06950c.htm">Holy Spirit</a>
          is of one substance with the Father and the Son...</p>
        </div>`;

      (mockFs.readdirSync as jest.Mock)
        .mockReturnValueOnce([
          { name: 'fathers', isDirectory: () => true, isFile: () => false },
        ] as unknown as fs.Dirent[])
        .mockReturnValueOnce([
          { name: 'index.html', isDirectory: () => false, isFile: () => true },
        ] as unknown as fs.Dirent[]);

      // readFileSync: first for index.html, then for 2903.htm
      (mockFs.readFileSync as jest.Mock)
        .mockReturnValueOnce(indexHtml)
        .mockReturnValueOnce(contentHtml);

      // existsSync returns true so the content file is read
      (mockFs.existsSync as jest.Mock).mockReturnValue(true);

      const maps = service.buildDirectoryIndexMaps(baseDir);
      const dirMap = maps.get(fathersDir);

      // 2903.htm retains its author/work from the index
      expect(dirMap?.get('2903.htm')).toEqual({
        author: 'Gregory of Nyssa',
        work: 'On the Holy Spirit, Against the Macedonians',
      });

      // No spurious entries from the cathen cross-reference links
      expect(dirMap?.size).toBe(1);
    });
  });

  // ─── extractDivById() ───────────────────────────────────────────────────────

  describe('extractDivById()', () => {
    it('should extract inner content of the named div', () => {
      const html = '<div id="springfield2"><p>Patristic text.</p></div>';
      const result = service.extractDivById(html, 'springfield2');
      expect(result).toBe('<p>Patristic text.</p>');
    });

    it('should handle nested divs correctly', () => {
      const html =
        '<div id="springfield2"><div class="inner"><p>Content</p></div></div>';
      const result = service.extractDivById(html, 'springfield2');
      expect(result).toBe('<div class="inner"><p>Content</p></div>');
    });

    it('should return undefined when the id is not present', () => {
      const html = '<div id="other"><p>Other content</p></div>';
      expect(service.extractDivById(html, 'springfield2')).toBeUndefined();
    });

    it('should be case-insensitive for the opening tag', () => {
      const html = '<DIV ID="springfield2"><p>Text</p></DIV>';
      const result = service.extractDivById(html, 'springfield2');
      expect(result).toBe('<p>Text</p>');
    });
  });

  // ─── cleanHtml() – pub div and springfield2 ─────────────────────────────────

  describe('cleanHtml() – NewAdvent-specific cleaning', () => {
    it('should remove the <div class="pub"> "About this page" block', () => {
      const html = `<div id="springfield2"><p>Patristic content.</p></div>
        <div class="pub"><h2>About this page</h2><p id="src"><strong>Source.</strong> Translated by Roberts.</p></div>`;
      const result = service.cleanHtml(html);
      expect(result).not.toContain('About this page');
      expect(result).not.toContain('Source.');
      expect(result).toContain('Patristic content.');
    });

    it('should restrict content to div#springfield2 when present', () => {
      const html = `
        <html>
          <body>
            <div id="nav"><a href="/">Home</a></div>
            <div id="springfield2">
              <h1>On the Christian Faith</h1>
              <p>Book text here.</p>
            </div>
            <div id="footer">Footer content</div>
          </body>
        </html>`;
      const result = service.cleanHtml(html);
      expect(result).toContain('On the Christian Faith');
      expect(result).toContain('Book text here.');
      expect(result).not.toContain('Footer content');
      expect(result).not.toContain('Home');
    });

    it('should process entire page when div#springfield2 is absent', () => {
      const html = '<p>All content visible.</p><p>More here.</p>';
      const result = service.cleanHtml(html);
      expect(result).toContain('All content visible.');
      expect(result).toContain('More here.');
    });
  });
});
