import { Injectable, Logger } from '@nestjs/common';
import { AiService, HermeneuticaCards } from '../ai/ai.service';
import { PatristicRagService } from '../patristic/patristic-rag.service';
import { PhilosophyEnrichmentService } from '../philosophy/philosophy-enrichment.service';
import { ConcordanceService } from '../concordance/concordance.service';
import { AnalyzeDto } from './dto/analyze.dto';

export interface AnalysisResult {
  reference: string;
  language: string;
  text: string;
  cards: HermeneuticaCards;
  timestamp: string;
}

/**
 * Parses chapter and verse numbers from a range string like "Ioan 3:16".
 * Returns null values when the format is not recognized.
 */
function parseChapterVerse(range: string): { chapter: number | null; verse: number | null } {
  const match = range.match(/(\d+):(\d+)/);
  if (!match) return { chapter: null, verse: null };
  return { chapter: parseInt(match[1], 10), verse: parseInt(match[2], 10) };
}

@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly patristicRagService: PatristicRagService,
    private readonly philosophyEnrichmentService: PhilosophyEnrichmentService,
    private readonly concordanceService: ConcordanceService,
  ) {}

  async analyze(dto: AnalyzeDto): Promise<AnalysisResult> {
    const language = dto.language ?? 'Sinodală Română';

    // Fetch Strong's concordance data for the selected verse when bookId is available.
    // Runs in parallel with the other enrichment tasks; failures are swallowed inside
    // ConcordanceService so this never blocks the overall analysis.
    let concordanceContext: string | undefined;
    if (dto.bookId) {
      const { chapter, verse } = parseChapterVerse(dto.range);
      if (chapter !== null && verse !== null) {
        const entries = await this.concordanceService.getVerseConcordance(
          dto.bookId,
          chapter,
          verse,
        );
        concordanceContext = this.concordanceService.formatConcordanceContext(entries) || undefined;
        if (concordanceContext) {
          this.logger.debug(
            `Concordance context fetched for ${dto.bookId} ${chapter}:${verse} (${entries.length} entries)`,
          );
        }
      }
    }

    const [twoCards, patristics, philosophy] = await Promise.all([
      this.aiService.generateTwoCards(dto.text, dto.range, language, concordanceContext),
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
