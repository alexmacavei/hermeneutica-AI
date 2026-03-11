import { Test, TestingModule } from '@nestjs/testing';
import { BibleService } from './bible.service';

// Mock the global fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockTranslationsResponse = {
  translations: [
    { id: 'WLC', name: 'כתבי הקודש', englishName: 'Hebrew Masoretic Text', language: 'hbo', textDirection: 'rtl' },
    { id: 'LXX', name: 'μετάφραση των εβδομήκοντα', englishName: 'Septuagint', language: 'grc', textDirection: 'ltr' },
    { id: 'UGNT', name: 'Η Καινή Διαθήκη', englishName: 'Unlocked Greek New Testament', language: 'grc', textDirection: 'ltr' },
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
  });

  describe('getTranslations()', () => {
    it('should return only the 4 allowed translations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
      });

      const translations = await service.getTranslations();

      expect(translations).toHaveLength(4);
      const ids = translations.map((t) => t.id);
      expect(ids).toContain('WLC');
      expect(ids).toContain('LXX');
      expect(ids).toContain('UGNT');
      expect(ids).toContain('KJVA');
      expect(ids).not.toContain('BSB');
      expect(ids).not.toContain('NET');
    });

    it('should return translations in the correct order: WLC, LXX, UGNT, KJVA', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
      });

      const translations = await service.getTranslations();

      expect(translations[0].id).toBe('WLC');
      expect(translations[1].id).toBe('LXX');
      expect(translations[2].id).toBe('UGNT');
      expect(translations[3].id).toBe('KJVA');
    });

    it('should cache translations after the first request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockTranslationsResponse),
      });

      await service.getTranslations();
      await service.getTranslations();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
