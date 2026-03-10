import { Injectable } from '@nestjs/common';
import { AiService, HermeneuticaCards } from '../ai/ai.service';
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
  constructor(private readonly aiService: AiService) {}

  async analyze(dto: AnalyzeDto): Promise<AnalysisResult> {
    const language = dto.language ?? 'Sinodală Română';

    const cards = await this.aiService.generateFourCards(
      dto.text,
      dto.range,
      language,
    );

    return {
      reference: dto.range,
      language,
      text: dto.text,
      cards,
      timestamp: new Date().toISOString(),
    };
  }
}
