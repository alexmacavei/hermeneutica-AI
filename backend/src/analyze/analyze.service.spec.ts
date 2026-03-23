import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeService } from './analyze.service';
import { AiService } from '../ai/ai.service';
import { PatristicRagService } from '../patristic/patristic-rag.service';
import { PhilosophyEnrichmentService } from '../philosophy/philosophy-enrichment.service';
import { AnalyzeDto } from './dto/analyze.dto';

describe('AnalyzeService', () => {
  let service: AnalyzeService;
  let aiService: AiService;

  const mockAiService = {
    generateTwoCards: jest.fn(),
  };

  const mockPatristicRagService = {
    buildPatristicSummary: jest.fn(),
  };

  const mockPhilosophyEnrichmentService = {
    buildPhilosophySummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeService,
        { provide: AiService, useValue: mockAiService },
        { provide: PatristicRagService, useValue: mockPatristicRagService },
        { provide: PhilosophyEnrichmentService, useValue: mockPhilosophyEnrichmentService },
      ],
    }).compile();

    service = module.get<AnalyzeService>(AnalyzeService);
    aiService = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyze()', () => {
    it('should return analysis result with patristics from RAG and philosophy from enrichment', async () => {
      const mockTwoCards = {
        hermeneutics: 'Interpretare în 4 sensuri: literal, tropologic, alegoric, anagogic',
        philology: 'πτωχοί (ptōchoi): cerșetor total, Strong\'s G4434',
      };
      const ragPatristics = 'Ioan Gură de Aur – Omilii la Ioan: Comentariu patristic RAG.';
      const enrichedPhilosophy =
        'Platonism: teoria formelor influențează hermeneutica alegorică.\n\nNeoplatonism: Plotin și conceptul de Unul.';

      mockAiService.generateTwoCards.mockResolvedValue(mockTwoCards);
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue(ragPatristics);
      mockPhilosophyEnrichmentService.buildPhilosophySummary.mockResolvedValue(enrichedPhilosophy);

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
      // The philosophy field must come from the enrichment service
      expect(result.cards.philosophy).toBe(enrichedPhilosophy);
      expect(result.cards.hermeneutics).toBe(mockTwoCards.hermeneutics);
      expect(result.cards.philology).toBe(mockTwoCards.philology);
      expect(result.timestamp).toBeDefined();
    });

    it('should use default language when not provided', async () => {
      mockAiService.generateTwoCards.mockResolvedValue({
        hermeneutics: 'test',
        philology: 'test',
      });
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue('rag patristics');
      mockPhilosophyEnrichmentService.buildPhilosophySummary.mockResolvedValue('enriched philosophy');

      const dto: AnalyzeDto = {
        text: 'Fericiți cei săraci cu duhul',
        range: 'Matei 5:3',
      };

      const result = await service.analyze(dto);
      expect(result.language).toBe('Sinodală Română');
    });

    it('should call aiService.generateTwoCards with correct params', async () => {
      mockAiService.generateTwoCards.mockResolvedValue({
        hermeneutics: '',
        philology: '',
      });
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue('');
      mockPhilosophyEnrichmentService.buildPhilosophySummary.mockResolvedValue('');

      const dto: AnalyzeDto = {
        text: 'La început era Cuvântul',
        range: 'Ioan 1:1',
        language: 'Greacă',
      };

      await service.analyze(dto);

      expect(aiService.generateTwoCards).toHaveBeenCalledWith(
        'La început era Cuvântul',
        'Ioan 1:1',
        'Greacă',
      );
    });

    it('should call patristicRagService.buildPatristicSummary with text, range and translationId', async () => {
      mockAiService.generateTwoCards.mockResolvedValue({
        hermeneutics: '',
        philology: '',
      });
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue('patristic result');
      mockPhilosophyEnrichmentService.buildPhilosophySummary.mockResolvedValue('');

      const dto: AnalyzeDto = {
        text: 'Căci atât de mult a iubit Dumnezeu lumea',
        range: 'Ioan 3:16',
        language: 'Sinodală Română',
        translationId: 'ro_sinodala',
      };

      await service.analyze(dto);

      expect(mockPatristicRagService.buildPatristicSummary).toHaveBeenCalledWith(
        'Căci atât de mult a iubit Dumnezeu lumea',
        'Ioan 3:16',
        'ro_sinodala',
      );
    });

    it('should call philosophyEnrichmentService.buildPhilosophySummary with text and range', async () => {
      mockAiService.generateTwoCards.mockResolvedValue({
        hermeneutics: '',
        philology: '',
      });
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue('');
      mockPhilosophyEnrichmentService.buildPhilosophySummary.mockResolvedValue('enriched');

      const dto: AnalyzeDto = {
        text: 'La început era Cuvântul',
        range: 'Ioan 1:1',
        language: 'Sinodală Română',
      };

      await service.analyze(dto);

      expect(mockPhilosophyEnrichmentService.buildPhilosophySummary).toHaveBeenCalledWith(
        'La început era Cuvântul',
        'Ioan 1:1',
      );
    });

    it('should return timestamp in ISO format', async () => {
      mockAiService.generateTwoCards.mockResolvedValue({
        hermeneutics: '',
        philology: '',
      });
      mockPatristicRagService.buildPatristicSummary.mockResolvedValue('');
      mockPhilosophyEnrichmentService.buildPhilosophySummary.mockResolvedValue('');

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
