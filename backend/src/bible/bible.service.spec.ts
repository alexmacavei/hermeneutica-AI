import { Test, TestingModule } from '@nestjs/testing';
import { BibleService } from './bible.service';

// Mock the global fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock fs/promises to control file-system behaviour in tests
const mockAccess = jest.fn();
const mockReadFile = jest.fn();
jest.mock('fs/promises', () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockBooksResponse = (id: string) => ({
  translation: {
    id,
    name: `${id} Name`,
    englishName: `${id} English Name`,
    language: 'und',
    textDirection: 'ltr',
  },
  books: [
    { id: 'GEN', name: 'Genesis', numChapters: 50 },
  ],
});

describe('BibleService', () => {
  let service: BibleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BibleService],
    }).compile();

    service = module.get<BibleService>(BibleService);
    mockFetch.mockReset();
    mockAccess.mockReset();
    mockReadFile.mockReset();
  });

  describe('getTranslations()', () => {
    it("should return only the 4 upstream allowed translations when ro_sinodala file is absent", async () => {
      mockFetch.mockImplementation((url: string) => {
        const id = url.split("/").slice(-2, -1)[0];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockBooksResponse(id)),
        });
      });
      // Simulate missing ro_sinodala file
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const translations = await service.getTranslations();

      expect(translations).toHaveLength(4);
      const ids = translations.map((t) => t.id);
      expect(ids).toContain("hbo_wlc");
      expect(ids).toContain("grc_bre");
      expect(ids).toContain("grc_byz");
      expect(ids).toContain("eng_kja");
      expect(ids).not.toContain("ro_sinodala");
    });

    it("should include ro_sinodala as the 5th translation when ro_sinodala file is present", async () => {
      mockFetch.mockImplementation((url: string) => {
        const id = url.split("/").slice(-2, -1)[0];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockBooksResponse(id)),
        });
      });
      // Simulate present ro_sinodala file
      mockAccess.mockResolvedValue(undefined);

      const translations = await service.getTranslations();

      expect(translations).toHaveLength(5);
      const ids = translations.map((t) => t.id);
      expect(ids).toContain("ro_sinodala");
    });

    it("should return translations in the correct order: hbo_wlc, grc_bre, grc_byz, eng_kja, ro_sinodala", async () => {
      mockFetch.mockImplementation((url: string) => {
        const id = url.split("/").slice(-2, -1)[0];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockBooksResponse(id)),
        });
      });
      mockAccess.mockResolvedValue(undefined);

      const translations = await service.getTranslations();

      expect(translations[0].id).toBe("hbo_wlc");
      expect(translations[1].id).toBe("grc_bre");
      expect(translations[2].id).toBe("grc_byz");
      expect(translations[3].id).toBe("eng_kja");
      expect(translations[4].id).toBe("ro_sinodala");
    });

    it('should cache translations after the first request', async () => {
      mockFetch.mockImplementation((url: string) => {
        const id = url.split('/').slice(-2, -1)[0];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockBooksResponse(id)),
        });
      });
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      await service.getTranslations();
      await service.getTranslations();

      // Called 4 times for the 4 upstream translations once, then cached
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('getParallelVerses()', () => {
    const mockChapterContent = {
      chapter: {
        number: 1,
        content: [
          { type: 'verse', number: 1, content: ['In the beginning...'] },
          { type: 'verse', number: 2, content: ['And the earth was...'] },
          { type: 'verse', number: 3, content: ['And God said...'] },
        ],
      },
    };

    it('should return parallel verses for all available translations', async () => {
      // Set up translations cache using per-translation books.json endpoint
      mockFetch.mockImplementation((url: string) => {
        const id = url.split('/').slice(-2, -1)[0];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockBooksResponse(id)),
        });
      });
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      await service.getTranslations();

      // Mock chapter responses for each translation
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockChapterContent),
      });

      const result = await service.getParallelVerses('GEN', 1, 1, 2);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((t) => {
        expect(t).toHaveProperty('translationId');
        expect(t).toHaveProperty('translationName');
        expect(t).toHaveProperty('available');
        expect(t).toHaveProperty('verses');
      });
    });

    it('should mark a translation as unavailable when the book does not exist', async () => {
      // Set up translations cache (4 upstream translations, no ro_sinodala)
      mockFetch.mockImplementation((url: string) => {
        const id = url.split("/").slice(-2, -1)[0];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockBooksResponse(id)),
        });
      });
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      await service.getTranslations();

      // First two translations return 404 (book not available), rest succeed
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockChapterContent),
        });

      const result = await service.getParallelVerses("MAT", 5, 3, 3);

      const unavailable = result.filter((t) => !t.available);
      expect(unavailable.length).toBeGreaterThanOrEqual(2);
      unavailable.forEach((t) => {
        expect(t.verses).toHaveLength(0);
      });
    });

    it('should filter verses to the requested range', async () => {
      // Set up translations cache using per-translation books.json endpoint
      mockFetch.mockImplementation((url: string) => {
        const id = url.split('/').slice(-2, -1)[0];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockBooksResponse(id)),
        });
      });
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      await service.getTranslations();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockChapterContent),
      });

      const result = await service.getParallelVerses('GEN', 1, 2, 2);

      const available = result.filter((t) => t.available);
      available.forEach((t) => {
        expect(t.verses.every((v) => v.number === '2')).toBe(true);
      });
    });

    it('should exclude the specified translation from the results', async () => {
      // Set up translations cache (4 upstream translations, no ro_sinodala)
      mockFetch.mockImplementation((url: string) => {
        const id = url.split("/").slice(-2, -1)[0];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockBooksResponse(id)),
        });
      });
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      await service.getTranslations();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockChapterContent),
      });

      const result = await service.getParallelVerses("GEN", 1, 1, 1, "hbo_wlc");

      const ids = result.map((t) => t.translationId);
      expect(ids).not.toContain("hbo_wlc");
    });

    it('should throw BadRequestException for an invalid chapter number', async () => {
      await expect(
        service.getParallelVerses('GEN', 0, 1, 1),
      ).rejects.toThrow('chapter must be between 1 and 200');
    });

    it('should throw BadRequestException for an invalid verse range', async () => {
      await expect(
        service.getParallelVerses('GEN', 1, 5, 3),
      ).rejects.toThrow('Invalid verse range');
    });
  });
});
