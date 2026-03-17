import { Test, TestingModule } from '@nestjs/testing';
import {
  PatristicRagService,
  PatristicChunkResult,
  PATRISTIC_FALLBACK,
} from './patristic-rag.service';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';

describe('PatristicRagService', () => {
  let service: PatristicRagService;

  const mockEmbedding = Array.from({ length: 1536 }, () => 0.1);

  const mockChunks: PatristicChunkResult[] = [
    {
      author: 'Ioan Gură de Aur',
      work: 'Omilii la Ioan',
      chapter: 'Omilia 28',
      chunkText: 'Căci atât de mult a iubit Dumnezeu lumea...',
      similarity: 0.85,
    },
    {
      author: 'Chiril al Alexandriei',
      work: 'Comentariu la Ioan',
      chapter: null,
      chunkText: 'Prin Fiul Său Unul-Născut Dumnezeu arată iubirea Sa...',
      similarity: 0.78,
    },
  ];

  const mockPool = {
    query: jest.fn(),
  };

  const mockAiService = {
    hasApiKey: true,
    generateEmbedding: jest.fn(),
    chat: jest.fn(),
  };

  const mockDatabaseService = {
    getPool: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatristicRagService,
        { provide: AiService, useValue: mockAiService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<PatristicRagService>(PatristicRagService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findRelevantChunksForVerse()', () => {
    it('should return empty array when no database pool available', async () => {
      mockDatabaseService.getPool.mockReturnValue(null);

      const result = await service.findRelevantChunksForVerse(
        'Căci atât de mult a iubit Dumnezeu lumea',
        'Ioan 3:16',
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when no API key', async () => {
      mockDatabaseService.getPool.mockReturnValue(mockPool);
      mockAiService.hasApiKey = false;

      const result = await service.findRelevantChunksForVerse(
        'Căci atât de mult a iubit Dumnezeu lumea',
        'Ioan 3:16',
      );

      expect(result).toEqual([]);
      mockAiService.hasApiKey = true;
    });

    it('should return mapped chunks above similarity threshold', async () => {
      mockDatabaseService.getPool.mockReturnValue(mockPool);
      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockPool.query.mockResolvedValue({
        rows: [
          {
            author: 'Ioan Gură de Aur',
            work: 'Omilii la Ioan',
            chapter: 'Omilia 28',
            chunk_text: 'Căci atât de mult a iubit Dumnezeu lumea...',
            similarity: 0.85,
          },
          {
            author: 'Autor Necunoscut',
            work: 'Opere',
            chapter: null,
            chunk_text: 'Fragment cu similaritate mică',
            similarity: 0.5,
          },
        ],
      });

      const result = await service.findRelevantChunksForVerse(
        'Căci atât de mult a iubit Dumnezeu lumea',
        'Ioan 3:16',
      );

      // Only the chunk above PATRISTIC_SIMILARITY_THRESHOLD (0.7) should be returned
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        author: 'Ioan Gură de Aur',
        work: 'Omilii la Ioan',
        chapter: 'Omilia 28',
        chunkText: 'Căci atât de mult a iubit Dumnezeu lumea...',
        similarity: 0.85,
      });
    });

    it('should call generateEmbedding with combined reference and verse text', async () => {
      mockDatabaseService.getPool.mockReturnValue(mockPool);
      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.findRelevantChunksForVerse(
        'La început era Cuvântul',
        'Ioan 1:1',
      );

      expect(mockAiService.generateEmbedding).toHaveBeenCalledWith(
        'Ioan 1:1 La început era Cuvântul',
      );
    });

    it('should return empty array and log error when query fails', async () => {
      mockDatabaseService.getPool.mockReturnValue(mockPool);
      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const result = await service.findRelevantChunksForVerse(
        'Test text',
        'Test 1:1',
      );

      expect(result).toEqual([]);
    });
  });

  describe('buildPatristicSummary()', () => {
    it('should return fallback message when no relevant chunks found', async () => {
      mockDatabaseService.getPool.mockReturnValue(mockPool);
      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.buildPatristicSummary(
        'Căci atât de mult a iubit Dumnezeu lumea',
        'Ioan 3:16',
      );

      expect(result).toBe(PATRISTIC_FALLBACK);
      expect(mockAiService.chat).not.toHaveBeenCalled();
    });

    it('should return fallback when no pool available', async () => {
      mockDatabaseService.getPool.mockReturnValue(null);

      const result = await service.buildPatristicSummary(
        'Test text',
        'Test 1:1',
      );

      expect(result).toBe(PATRISTIC_FALLBACK);
    });

    it('should call AI chat with relevant chunks as context', async () => {
      mockDatabaseService.getPool.mockReturnValue(mockPool);
      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockPool.query.mockResolvedValue({
        rows: [
          {
            author: mockChunks[0].author,
            work: mockChunks[0].work,
            chapter: mockChunks[0].chapter,
            chunk_text: mockChunks[0].chunkText,
            similarity: mockChunks[0].similarity,
          },
        ],
      });
      const expectedSummary =
        'Ioan Gură de Aur – Omilii la Ioan, Omilia 28: Comentariu relevant.';
      mockAiService.chat.mockResolvedValue(expectedSummary);

      const result = await service.buildPatristicSummary(
        'Căci atât de mult a iubit Dumnezeu lumea',
        'Ioan 3:16',
      );

      expect(result).toBe(expectedSummary);
      expect(mockAiService.chat).toHaveBeenCalledTimes(1);
      const [messages, options] = mockAiService.chat.mock.calls[0];
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toContain('Ioan 3:16');
      expect(messages[1].content).toContain('Ioan Gură de Aur');
      expect(options).toMatchObject({ temperature: 0.3, max_tokens: 600 });
    });

    it('should return fallback when AI chat returns empty string', async () => {
      mockDatabaseService.getPool.mockReturnValue(mockPool);
      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockPool.query.mockResolvedValue({
        rows: [
          {
            author: 'Ioan Gură de Aur',
            work: 'Omilii la Ioan',
            chapter: null,
            chunk_text: 'Fragment patristic...',
            similarity: 0.9,
          },
        ],
      });
      mockAiService.chat.mockResolvedValue('');

      const result = await service.buildPatristicSummary(
        'Test verset',
        'Test 1:1',
      );

      expect(result).toBe(PATRISTIC_FALLBACK);
    });

    it('should include work chapter in context when present', async () => {
      mockDatabaseService.getPool.mockReturnValue(mockPool);
      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockPool.query.mockResolvedValue({
        rows: [
          {
            author: 'Vasile cel Mare',
            work: 'Omilii la Hexaemeron',
            chapter: 'Omilia 1',
            chunk_text: 'Fragment...',
            similarity: 0.8,
          },
        ],
      });
      mockAiService.chat.mockResolvedValue('Vasile cel Mare: Comentariu.');

      await service.buildPatristicSummary('La început', 'Facere 1:1');

      const userMessage = mockAiService.chat.mock.calls[0][0][1].content;
      expect(userMessage).toContain('Omilia 1');
    });
  });
});
