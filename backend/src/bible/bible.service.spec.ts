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

const mockTranslationsResponse = {
  translations: [
    { id: 'WLC', name: 'Hebrew Bible', englishName: 'Hebrew Masoretic Text', language: 'hbo', textDirection: 'rtl' },
    { id: 'LXX', name: 'Septuaginta', englishName: 'Septuagint', language: 'grc', textDirection: 'ltr' },
    { id: 'UGNT', name: 'Greek NT', englishName: 'Unlocked Greek New Testament', language: 'grc', textDirection: 'ltr' },
    { id: 'KJVA', name: 'King James Version with Apocrypha', englishName: 'King James Version with Apocrypha', language: 'eng', textDirection: 'ltr' },
    { id: 'BSB', name: 'Berean Standard Bible', englishName: 'Berean Standard Bible', language: 'eng', textDirection: 'ltr' },
    { id: 'NET', name: 'New English Translation', englishName: 'New English Translation', language: 'eng', textDirection: 'ltr' },
  ],
};

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
    it('should return only the 4 upstream allowed translations when BSR file is absent', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
      });
      // Simulate missing BSR.json
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const translations = await service.getTranslations();

      expect(translations).toHaveLength(4);
      const ids = translations.map((t) => t.id);
      expect(ids).toContain('WLC');
      expect(ids).toContain('LXX');
      expect(ids).toContain('UGNT');
      expect(ids).toContain('KJVA');
      expect(ids).not.toContain('BSR');
      expect(ids).not.toContain('BSB');
      expect(ids).not.toContain('NET');
    });

    it('should include BSR as the 5th translation when BSR file is present', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
      });
      // Simulate present BSR.json
      mockAccess.mockResolvedValue(undefined);

      const translations = await service.getTranslations();

      expect(translations).toHaveLength(5);
      const ids = translations.map((t) => t.id);
      expect(ids).toContain('BSR');
      expect(ids).not.toContain('BSB');
      expect(ids).not.toContain('NET');
    });

    it('should return translations in the correct order: WLC, LXX, UGNT, KJVA, BSR', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
      });
      mockAccess.mockResolvedValue(undefined);

      const translations = await service.getTranslations();

      expect(translations[0].id).toBe('WLC');
      expect(translations[1].id).toBe('LXX');
      expect(translations[2].id).toBe('UGNT');
      expect(translations[3].id).toBe('KJVA');
      expect(translations[4].id).toBe('BSR');
    });

    it('should cache translations after the first request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
      });
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      await service.getTranslations();
      await service.getTranslations();

      expect(mockFetch).toHaveBeenCalledTimes(1);
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
      // Set up translations cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
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
      // Set up translations cache (4 translations, no BSR)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
      });
      mockAccess.mockRejectedValue(new Error('ENOENT'));
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

      const result = await service.getParallelVerses('MAT', 5, 3, 3);

      const unavailable = result.filter((t) => !t.available);
      expect(unavailable.length).toBeGreaterThanOrEqual(2);
      unavailable.forEach((t) => {
        expect(t.verses).toHaveLength(0);
      });
    });

    it('should filter verses to the requested range', async () => {
      // Set up translations cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
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
