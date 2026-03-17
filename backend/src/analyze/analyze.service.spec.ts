import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeService } from './analyze.service';
import { AiService } from '../ai/ai.service';
import { PatristicRagService } from '../patristic/patristic-rag.service';
import { AnalyzeDto } from './dto/analyze.dto';

describe('AnalyzeService', () => {
  let service: AnalyzeService;
  let aiService: AiService;

  const mockAiService = {
    generateThreeCards: jest.fn(),
  };

  const mockPatristicRagService = {
    buildPatristicSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeService,
        { provide: AiService, useValue: mockAiService },
        { provide: PatristicRagService, useValue: mockPatristicRagService },
      ],
    }).compile();

    service = module.get<AnalyzeService>(AnalyzeService);
    aiService = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyze()', () => {
    it('should return analysis result with patristics field from RAG service', async () => {
      const mockThreeCards = {
        hermeneutics: 'Interpretare în 4 sensuri: literal, tropologic, alegoric, anagogic',
        philosophy: 'Platonism creștin: scala ființei, theosis',
        philology: 'πτωχοί (ptōchoi): cerșetor total, Strong\'s G4434',
      };
      const ragPatristics = 'Ioan Gură de Aur – Omilii la Ioan: Comentariu patristic RAG.';

      mockAiService.generateThreeCards.mockResolvedValue(mockThreeCards);
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue(ragPatristics);

      const dto: AnalyzeDto = {
        text: 'Fericiți cei săraci cu duhul, că a lor este Împărăția cerurilor.',
        range: 'Matei 5:3',
        language: 'Sinodală Română',
      };

      const result = await service.analyze(dto);

      expect(result.reference).toBe('Matei 5:3');
      expect(result.language).toBe('Sinodală Română');
      expect(result.text).toBe(dto.text);
      // The patristics field must come exclusively from the RAG service
      expect(result.cards.patristics).toBe(ragPatristics);
      expect(result.cards.hermeneutics).toBe(mockThreeCards.hermeneutics);
      expect(result.cards.philosophy).toBe(mockThreeCards.philosophy);
      expect(result.cards.philology).toBe(mockThreeCards.philology);
      expect(result.timestamp).toBeDefined();
    });

    it('should use default language when not provided', async () => {
      mockAiService.generateThreeCards.mockResolvedValue({
        hermeneutics: 'test',
        philosophy: 'test',
        philology: 'test',
      });
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue('rag patristics');

      const dto: AnalyzeDto = {
        text: 'Fericiți cei săraci cu duhul',
        range: 'Matei 5:3',
      };

      const result = await service.analyze(dto);
      expect(result.language).toBe('Sinodală Română');
    });

    it('should call aiService.generateThreeCards with correct params', async () => {
      mockAiService.generateThreeCards.mockResolvedValue({
        hermeneutics: '',
        philosophy: '',
        philology: '',
      });
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue('');

      const dto: AnalyzeDto = {
        text: 'La început era Cuvântul',
        range: 'Ioan 1:1',
        language: 'Greacă',
      };

      await service.analyze(dto);

      expect(aiService.generateThreeCards).toHaveBeenCalledWith(
        'La început era Cuvântul',
        'Ioan 1:1',
        'Greacă',
      );
    });

    it('should call patristicRagService.buildPatristicSummary with text and range', async () => {
      mockAiService.generateThreeCards.mockResolvedValue({
        hermeneutics: '',
        philosophy: '',
        philology: '',
      });
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue('patristic result');

      const dto: AnalyzeDto = {
        text: 'Căci atât de mult a iubit Dumnezeu lumea',
        range: 'Ioan 3:16',
        language: 'Sinodală Română',
      };

      await service.analyze(dto);

      expect(mockPatristicRagService.buildPatristicSummary).toHaveBeenCalledWith(
        'Căci atât de mult a iubit Dumnezeu lumea',
        'Ioan 3:16',
      );
    });

    it('should return timestamp in ISO format', async () => {
      mockAiService.generateThreeCards.mockResolvedValue({
        hermeneutics: '',
        philosophy: '',
        philology: '',
      });
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue('');

      const dto: AnalyzeDto = {
        text: 'Test text',
        range: 'Test 1:1',
      };

      const result = await service.analyze(dto);
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });
});
