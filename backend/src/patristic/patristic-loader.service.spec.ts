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
  });
});
