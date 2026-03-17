import { Injectable, Logger } from '@nestjs/common';
import { AiService, HermeneuticaCards } from '../ai/ai.service';
import { PatristicRagService } from '../patristic/patristic-rag.service';
import { AnalyzeDto } from './dto/analyze.dto';

export interface AnalysisResult {
  reference: string;
  language: string;
  text: string;
  cards: HermeneuticaCards;
  timestamp: string;
}

@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly patristicRagService: PatristicRagService,
  ) {}

  async analyze(dto: AnalyzeDto): Promise<AnalysisResult> {
    const language = dto.language ?? 'Sinodală Română';

    const [cards, patristics] = await Promise.all([
      this.aiService.generateFourCards(dto.text, dto.range, language),
      this.patristicRagService.buildPatristicSummary(dto.text, dto.range),
    ]);

    this.logger.debug(
      `Replacing LLM patristics with RAG result for "${dto.range}"`,
    );

    return {
      reference: dto.range,
      language,
      text: dto.text,
      cards: { ...cards, patristics },
      timestamp: new Date().toISOString(),
    };
  }
}
