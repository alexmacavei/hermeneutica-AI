import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeService } from './analyze.service';
import { AiService } from '../ai/ai.service';
import { AnalyzeDto } from './dto/analyze.dto';

describe('AnalyzeService', () => {
  let service: AnalyzeService;
  let aiService: AiService;

  const mockAiService = {
    generateFourCards: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeService,
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<AnalyzeService>(AnalyzeService);
    aiService = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyze()', () => {
    it('should return analysis result with 4 cards', async () => {
      const mockCards = {
        hermeneutics: 'Interpretare în 4 sensuri: literal, tropologic, alegoric, anagogic',
        philosophy: 'Platonism creștin: scala ființei, theosis',
        patristics: 'Ioan Gură de Aur: Omilii la Matei',
        philology: 'πτωχοί (ptōchoi): cerșetor total, Strong\'s G4434',
      };

      mockAiService.generateFourCards.mockResolvedValue(mockCards);

      const dto: AnalyzeDto = {
        text: 'Fericiți cei săraci cu duhul, că a lor este Împărăția cerurilor.',
        range: 'Matei 5:3',
        language: 'Sinodală Română',
      };

      const result = await service.analyze(dto);

      expect(result.reference).toBe('Matei 5:3');
      expect(result.language).toBe('Sinodală Română');
      expect(result.text).toBe(dto.text);
      expect(result.cards).toEqual(mockCards);
      expect(result.timestamp).toBeDefined();
    });

    it('should use default language when not provided', async () => {
      mockAiService.generateFourCards.mockResolvedValue({
        hermeneutics: 'test',
        philosophy: 'test',
        patristics: 'test',
        philology: 'test',
      });

      const dto: AnalyzeDto = {
        text: 'Fericiți cei săraci cu duhul',
        range: 'Matei 5:3',
      };

      const result = await service.analyze(dto);
      expect(result.language).toBe('Sinodală Română');
    });

    it('should call aiService.generateFourCards with correct params', async () => {
      mockAiService.generateFourCards.mockResolvedValue({
        hermeneutics: '',
        philosophy: '',
        patristics: '',
        philology: '',
      });

      const dto: AnalyzeDto = {
        text: 'La început era Cuvântul',
        range: 'Ioan 1:1',
        language: 'Greacă',
      };

      await service.analyze(dto);

      expect(aiService.generateFourCards).toHaveBeenCalledWith(
        'La început era Cuvântul',
        'Ioan 1:1',
        'Greacă',
      );
    });

    it('should return timestamp in ISO format', async () => {
      mockAiService.generateFourCards.mockResolvedValue({
        hermeneutics: '',
        philosophy: '',
        patristics: '',
        philology: '',
      });

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
