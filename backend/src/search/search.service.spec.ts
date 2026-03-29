import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';

describe('SearchService', () => {
  let service: SearchService;
  let mockPool: { query: jest.Mock; connect: jest.Mock };

  const mockAiService = {
    hasApiKey: true,
    generateEmbedding: jest.fn(),
    generateEmbeddings: jest.fn(),
  };

  const mockDatabaseService = {
    getPool: jest.fn(),
  };

  beforeEach(async () => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
    };

    mockDatabaseService.getPool.mockReturnValue(mockPool);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: AiService, useValue: mockAiService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchVerses()', () => {
    it('should return empty results when pool is null', async () => {
      mockDatabaseService.getPool.mockReturnValue(null);

      const result = await service.searchVerses('iubire', 'BSR');

      expect(result).toEqual({
        query: 'iubire',
        translationId: 'BSR',
        results: [],
        total: 0,
      });
    });

    it('should return empty results when API key is not set', async () => {
      const aiServiceWithoutKey = { ...mockAiService, hasApiKey: false };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SearchService,
          { provide: AiService, useValue: aiServiceWithoutKey },
          { provide: DatabaseService, useValue: mockDatabaseService },
        ],
      }).compile();

      const serviceWithoutKey = module.get<SearchService>(SearchService);
      const result = await serviceWithoutKey.searchVerses('iubire', 'BSR');

      expect(result).toEqual({
        query: 'iubire',
        translationId: 'BSR',
        results: [],
        total: 0,
      });
    });

    it('should return search results from database', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);

      mockPool.query.mockResolvedValue({
        rows: [
          {
            translation_id: 'BSR',
            book_id: 'JHN',
            book_name: 'Ioan',
            chapter_number: 3,
            verse_number: 16,
            verse_text: 'Căci Dumnezeu aşa a iubit lumea, că a dat pe singurul Său Fiu...',
            similarity: 0.85,
          },
        ],
      });

      const result = await service.searchVerses('iubirea lui Dumnezeu', 'BSR', 5);

      expect(result.query).toBe('iubirea lui Dumnezeu');
      expect(result.translationId).toBe('BSR');
      expect(result.total).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        translationId: 'BSR',
        bookId: 'JHN',
        bookName: 'Ioan',
        chapter: 3,
        verseNumber: 16,
        similarity: 0.85,
        reference: 'Ioan 3:16',
        consensusBoost: false,
      });
    });

    it('should return empty results on database error', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);

      mockPool.query.mockRejectedValue(new Error('DB connection failed'));

      const result = await service.searchVerses('mântuire', 'BSR');

      expect(result).toEqual({
        query: 'mântuire',
        translationId: 'BSR',
        results: [],
        total: 0,
      });
    });
  });

  describe('ingestChapter()', () => {
    it('should skip ingestion when pool is null', async () => {
      mockDatabaseService.getPool.mockReturnValue(null);

      await expect(
        service.ingestChapter('BSR', 'GEN', 'Facerea', 1, [
          { number: '1', text: 'La început a făcut Dumnezeu cerurile şi pământul.' },
        ]),
      ).resolves.toBeUndefined();

      expect(mockAiService.generateEmbeddings).not.toHaveBeenCalled();
    });

    it('should skip ingestion when chapter is already indexed', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: 31 }] });

      await service.ingestChapter('BSR', 'GEN', 'Facerea', 1, [
        { number: '1', text: 'La început a făcut Dumnezeu cerurile şi pământul.' },
      ]);

      expect(mockAiService.generateEmbeddings).not.toHaveBeenCalled();
    });

    it('should ingest verses when chapter is not yet indexed', async () => {
      const mockEmbedding = new Array(1536).fill(0.2);
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient);

      mockAiService.generateEmbeddings.mockResolvedValue([
        mockEmbedding,
        mockEmbedding,
      ]);

      await service.ingestChapter('BSR', 'GEN', 'Facerea', 1, [
        { number: '1', text: 'La început a făcut Dumnezeu cerurile şi pământul.' },
        { number: '2', text: 'Şi pământul era netocmit şi gol.' },
      ]);

      expect(mockAiService.generateEmbeddings).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should skip ingestion when verses array is empty', async () => {
      await service.ingestChapter('BSR', 'GEN', 'Facerea', 1, []);

      expect(mockPool.query).not.toHaveBeenCalled();
      expect(mockAiService.generateEmbeddings).not.toHaveBeenCalled();
    });
  });
});
