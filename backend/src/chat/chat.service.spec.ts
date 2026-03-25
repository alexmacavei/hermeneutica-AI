import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';
import { PatristicRagService } from '../patristic/patristic-rag.service';
import { ChatMessageDto } from './chat.dto';

describe('ChatService', () => {
  let service: ChatService;

  const mockAiService = {
    hasApiKey: true,
    chat: jest.fn(),
  };

  const mockPatristicRagService = {
    findRelevantChunksForVerse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: AiService, useValue: mockAiService },
        { provide: PatristicRagService, useValue: mockPatristicRagService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage()', () => {
    it('should return fallback when API key is missing', async () => {
      mockAiService.hasApiKey = false;
      const reply = await service.sendMessage('Ce înseamnă Ioan 3:16?', []);
      expect(reply).toContain('OPENAI_API_KEY');
      mockAiService.hasApiKey = true;
    });

    it('should return AI reply when no patristic context found', async () => {
      mockPatristicRagService.findRelevantChunksForVerse.mockResolvedValue([]);
      mockAiService.chat.mockResolvedValue('Acesta este versetul cel mai cunoscut.');

      const reply = await service.sendMessage('Ce înseamnă Ioan 3:16?', []);

      expect(reply).toBe('Acesta este versetul cel mai cunoscut.');
      expect(mockAiService.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'Ce înseamnă Ioan 3:16?' }),
        ]),
        expect.any(Object),
      );
    });

    it('should include patristic context in system prompt when chunks are found', async () => {
      mockPatristicRagService.findRelevantChunksForVerse.mockResolvedValue([
        {
          author: 'Ioan Gură de Aur',
          work: 'Omilii la Ioan',
          chapter: 'Omilia 28',
          chunkText: 'Dumnezeu a iubit lumea…',
          similarity: 0.85,
        },
      ]);
      mockAiService.chat.mockResolvedValue('Răspuns cu context patristic.');

      const reply = await service.sendMessage('Explică Ioan 3:16', []);

      expect(reply).toBe('Răspuns cu context patristic.');
      const chatCall = mockAiService.chat.mock.calls[0][0] as Array<{
        role: string;
        content: string;
      }>;
      const systemMsg = chatCall.find((m) => m.role === 'system');
      expect(systemMsg?.content).toContain('Ioan Gură de Aur');
      expect(systemMsg?.content).toContain('Omilii la Ioan');
    });

    it('should include conversation history in the messages sent to AI', async () => {
      mockPatristicRagService.findRelevantChunksForVerse.mockResolvedValue([]);
      mockAiService.chat.mockResolvedValue('Răspuns.');

      const history: ChatMessageDto[] = [
        { role: 'user', content: 'Salut!' },
        { role: 'assistant', content: 'Bună ziua!' },
      ];

      await service.sendMessage('Ce este Sfânta Treime?', history);

      const chatCall = mockAiService.chat.mock.calls[0][0] as Array<{
        role: string;
        content: string;
      }>;
      expect(chatCall).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'Salut!' }),
          expect.objectContaining({ role: 'assistant', content: 'Bună ziua!' }),
          expect.objectContaining({ role: 'user', content: 'Ce este Sfânta Treime?' }),
        ]),
      );
    });

    it('should return fallback when AI chat throws an error', async () => {
      mockPatristicRagService.findRelevantChunksForVerse.mockResolvedValue([]);
      mockAiService.chat.mockRejectedValue(new Error('API error'));

      const reply = await service.sendMessage('Întrebare test', []);
      expect(reply).toContain('disponibil');
    });

    it('should search patristic corpus with the user message', async () => {
      mockPatristicRagService.findRelevantChunksForVerse.mockResolvedValue([]);
      mockAiService.chat.mockResolvedValue('Răspuns.');

      await service.sendMessage('Vorbește despre rugăciune', []);

      expect(mockPatristicRagService.findRelevantChunksForVerse).toHaveBeenCalledWith(
        'Vorbește despre rugăciune',
        '',
        5,
      );
    });
  });
});
