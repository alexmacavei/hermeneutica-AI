import { Test, TestingModule } from '@nestjs/testing';
import {
  PhilosophyEnrichmentService,
  PHILOSOPHY_FALLBACK,
} from './philosophy-enrichment.service';
import { AiService } from '../ai/ai.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Small stub that simulates a successful fetch response. */
function mockFetchResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Stub that simulates a failed fetch (non-2xx). */
function mockFetchFailure(status = 500): Response {
  return {
    ok: false,
    status,
    statusText: 'Internal Server Error',
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PhilosophyEnrichmentService', () => {
  let service: PhilosophyEnrichmentService;

  const mockAiService = {
    generatePhilosophySummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhilosophyEnrichmentService,
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<PhilosophyEnrichmentService>(PhilosophyEnrichmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  describe('getFathersForVerse()', () => {
    it('returns fathers from BiblIndex when API is available', async () => {
      const biblIndexPayload = {
        results: [
          { author: 'Origen' },
          { author: 'John Chrysostom' },
          { author: 'Clement of Alexandria' },
        ],
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(biblIndexPayload));

      const fathers = await service.getFathersForVerse('Ioan 1:1');

      expect(fathers).toContain('Origen');
      expect(fathers).toContain('John Chrysostom');
      expect(fathers).toContain('Clement of Alexandria');
    });

    it('falls back to curated map when BiblIndex returns empty results', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse({ results: [] }));

      const fathers = await service.getFathersForVerse('Ioan 1:1');

      expect(Array.isArray(fathers)).toBe(true);
      expect(fathers.length).toBeGreaterThan(0);
      // "Ioan" is in the curated map
      expect(fathers).toContain('Origen');
    });

    it('falls back to curated map when BiblIndex API call fails', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const fathers = await service.getFathersForVerse('Ps 22:1');

      expect(Array.isArray(fathers)).toBe(true);
      expect(fathers.length).toBeGreaterThan(0);
      // "Ps" is in the curated map
      expect(fathers).toContain('Origen');
    });

    it('returns default fathers when book is not in the curated map', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const fathers = await service.getFathersForVerse('UnknownBook 3:5');

      expect(Array.isArray(fathers)).toBe(true);
      expect(fathers.length).toBeGreaterThan(0);
    });

    it('deduplicates authors returned by BiblIndex', async () => {
      const biblIndexPayload = {
        results: [
          { author: 'Origen' },
          { author: 'Origen' },
          { author: 'Origen' },
        ],
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(biblIndexPayload));

      const fathers = await service.getFathersForVerse('Ioan 3:16');

      expect(fathers.filter((f) => f === 'Origen').length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('getWikidataInfluences()', () => {
    it('returns philosophers from Wikidata when API is available', async () => {
      const wikidataPayload = {
        results: {
          bindings: [
            { philosopherLabel: { value: 'Plato' }, philosopherDesc: { value: 'ancient Greek philosopher' } },
            { philosopherLabel: { value: 'Aristotle' }, philosopherDesc: { value: 'ancient Greek philosopher' } },
            { philosopherLabel: { value: 'Plotinus' }, philosopherDesc: { value: 'Neoplatonist philosopher' } },
          ],
        },
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(wikidataPayload));

      const philosophers = await service.getWikidataInfluences();

      expect(philosophers.length).toBe(3);
      expect(philosophers.map((p) => p.label)).toContain('Plato');
      expect(philosophers.map((p) => p.label)).toContain('Aristotle');
      expect(philosophers.find((p) => p.label === 'Plotinus')?.description).toBe(
        'Neoplatonist philosopher',
      );
    });

    it('returns empty array when Wikidata is unreachable', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const philosophers = await service.getWikidataInfluences();

      expect(philosophers).toEqual([]);
    });

    it('returns empty array on HTTP error from Wikidata', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchFailure(503));

      const philosophers = await service.getWikidataInfluences();

      expect(philosophers).toEqual([]);
    });

    it('ignores bindings without a philosopherLabel', async () => {
      const wikidataPayload = {
        results: {
          bindings: [
            { philosopherLabel: { value: '' }, philosopherDesc: { value: 'some desc' } },
            { philosopherLabel: { value: 'Plato' } },
          ],
        },
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(wikidataPayload));

      const philosophers = await service.getWikidataInfluences();

      expect(philosophers.length).toBe(1);
      expect(philosophers[0].label).toBe('Plato');
    });
  });

  // -------------------------------------------------------------------------
  describe('searchPhilosophersApi()', () => {
    it('returns philosopher details when API is available', async () => {
      const apiPayload = [
        {
          name: 'Plato',
          school: 'Platonism',
          description: 'Ancient Greek philosopher, student of Socrates',
        },
      ];
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse(apiPayload));

      const result = await service.searchPhilosophersApi('Plato');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Plato');
      expect(result?.school).toBe('Platonism');
      expect(result?.description).toBe('Ancient Greek philosopher, student of Socrates');
    });

    it('returns null when API returns empty array', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse([]));

      const result = await service.searchPhilosophersApi('UnknownPhilosopher');

      expect(result).toBeNull();
    });

    it('returns null when API call fails', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Timeout'));

      const result = await service.searchPhilosophersApi('Plato');

      expect(result).toBeNull();
    });

    it('uses name as fallback when API result missing name field', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockFetchResponse([{ school: 'Platonism' }]));

      const result = await service.searchPhilosophersApi('Plato');

      expect(result?.name).toBe('Plato');
    });
  });

  // -------------------------------------------------------------------------
  describe('buildPhilosophySummary()', () => {
    const verse = 'La început era Cuvântul, și Cuvântul era la Dumnezeu, și Cuvântul era Dumnezeu.';
    const ref = 'Ioan 1:1';

    it('calls aiService.generatePhilosophySummary with enriched context', async () => {
      const wikidataPayload = {
        results: {
          bindings: [
            { philosopherLabel: { value: 'Plato' }, philosopherDesc: { value: 'ancient Greek philosopher' } },
          ],
        },
      };
      const philosophersApiPayload = [{ name: 'Plato', school: 'Platonism' }];

      // BiblIndex → returns fathers
      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(mockFetchResponse({ results: [{ author: 'Origen' }] })) // BiblIndex
        .mockResolvedValueOnce(mockFetchResponse(wikidataPayload))                      // Wikidata
        .mockResolvedValueOnce(mockFetchResponse(philosophersApiPayload));              // Philosophers API

      mockAiService.generatePhilosophySummary.mockResolvedValue(
        'Platonism: Logos ca rațiune universală (Cuvântul).',
      );

      const result = await service.buildPhilosophySummary(verse, ref);

      expect(mockAiService.generatePhilosophySummary).toHaveBeenCalledTimes(1);
      const [callRef, callVerse, callFathers, callPhilosophers] =
        mockAiService.generatePhilosophySummary.mock.calls[0];
      expect(callRef).toBe(ref);
      expect(callVerse).toBe(verse);
      expect(callFathers).toContain('Origen');
      expect(callPhilosophers).toContain('Plato');

      expect(result).toBe('Platonism: Logos ca rațiune universală (Cuvântul).');
    });

    it('includes curated philosopher details when Wikidata returns nothing', async () => {
      // BiblIndex → fallback (network error), Wikidata → empty, no Philosophers API calls
      jest.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('BiblIndex down'))     // BiblIndex
        .mockRejectedValueOnce(new Error('Wikidata down'));     // Wikidata

      mockAiService.generatePhilosophySummary.mockResolvedValue('fallback philosophy text');

      await service.buildPhilosophySummary(verse, ref);

      const [, , , callPhilosophers] = mockAiService.generatePhilosophySummary.mock.calls[0];
      // Curated fallback includes Plato
      expect(callPhilosophers).toContain('Plato');
    });

    it('returns PHILOSOPHY_FALLBACK when AI generates empty result', async () => {
      jest.spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('BiblIndex down'))
        .mockRejectedValueOnce(new Error('Wikidata down'));

      mockAiService.generatePhilosophySummary.mockResolvedValue('');

      const result = await service.buildPhilosophySummary(verse, ref);

      expect(result).toBe(PHILOSOPHY_FALLBACK);
    });

    it('returns enriched result even when all external APIs fail (uses curated fallback)', async () => {
      // All fetch calls fail → curated data fills in
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('All APIs down'));

      mockAiService.generatePhilosophySummary.mockResolvedValue('Curated philosophy analysis.');

      const result = await service.buildPhilosophySummary('Test verse', 'Matei 5:3');

      expect(result).toBe('Curated philosophy analysis.');
      expect(mockAiService.generatePhilosophySummary).toHaveBeenCalledTimes(1);
    });
  });
});
