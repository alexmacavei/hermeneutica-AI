import { Injectable, Logger } from '@nestjs/common';
import { AiService, HermeneuticaCards } from '../ai/ai.service';
import { PatristicRagService } from '../patristic/patristic-rag.service';
import { PhilosophyEnrichmentService } from '../philosophy/philosophy-enrichment.service';
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
    private readonly philosophyEnrichmentService: PhilosophyEnrichmentService,
  ) {}

  async analyze(dto: AnalyzeDto): Promise<AnalysisResult> {
    const language = dto.language ?? 'Sinodală Română';

    const [twoCards, patristics, philosophy] = await Promise.all([
      this.aiService.generateTwoCards(dto.text, dto.range, language),
      this.patristicRagService.buildPatristicSummary(dto.text, dto.range, dto.translationId),
      this.philosophyEnrichmentService.buildPhilosophySummary(dto.text, dto.range),
    ]);

    this.logger.debug(
      `Assembled patristics via RAG and philosophy via enrichment for "${dto.range}"`,
    );

    return {
      reference: dto.range,
      language,
      text: dto.text,
      cards: { ...twoCards, patristics, philosophy },
      timestamp: new Date().toISOString(),
    };
  }
}
