import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface HermeneuticaCards {
  hermeneutics: string;
  philosophy: string;
  patristics: string;
  philology: string;
}

interface CardPrompt {
  title: string;
  prompt: string;
}

interface HermeneuticaPromptConfig {
  system: string;
  user_template: string;
  cards: {
    hermeneutics: CardPrompt;
    philosophy: CardPrompt;
    patristics: CardPrompt;
    philology: CardPrompt;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly prompts: HermeneuticaPromptConfig;
  private readonly model: string;
  readonly hasApiKey: boolean;
  private readonly systemMessage: string;
  private readonly embeddingModel = 'text-embedding-3-small';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey') ?? '';
    this.hasApiKey = apiKey.length > 0;
    this.model =
      this.configService.get<string>('openai.model') ?? 'gpt-4o';

    this.openai = new OpenAI({ apiKey });

    const promptFile = path.join(
      __dirname,
      'prompts',
      'hermeneutica.yaml',
    );
    const raw = fs.readFileSync(promptFile, 'utf-8');
    this.prompts = yaml.load(raw) as HermeneuticaPromptConfig;

    // Pre-build system message with all per-card instructions (cached for lifetime of service)
    const cardInstructions = Object.entries(this.prompts.cards)
      .map(([key, card]) => `### ${card.title} (field: "${key}")\n${card.prompt}`)
      .join('\n\n');
    this.systemMessage = `${this.prompts.system}\n\n## Instrucțiuni per card:\n${cardInstructions}`;
  }

  async generateFourCards(
    text: string,
    reference: string,
    language: string = 'Sinodală Română',
  ): Promise<HermeneuticaCards> {
    if (!this.hasApiKey) {
      return this.getFallbackCards(reference, text);
    }

    const userMessage = this.prompts.user_template
      .replace('{reference}', reference)
      .replace('{language}', language)
      .replace('{text}', text);

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemMessage },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content ?? '{}';
      return JSON.parse(content) as HermeneuticaCards;
    } catch (error) {
      this.logger.error('OpenAI API error', error);
      return this.getFallbackCards(reference, text);
    }
  }

  /**
   * Generates a single embedding vector for the given text.
   * Throws if the API returns an empty response.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('OpenAI returned no embedding for the given text.');
    }
    return embedding;
  }

  /**
   * Generates embedding vectors for a batch of texts in a single API call.
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }

  private getFallbackCards(
    reference: string,
    text: string,
  ): HermeneuticaCards {
    return {
      hermeneutics: `Analiză hermeneutică pentru ${reference}: ${text.slice(0, 50)}... [Serviciul AI temporar indisponibil. Vă rugăm configurați OPENAI_API_KEY.]`,
      philosophy: `Analiză filozofică pentru ${reference}: [Serviciul AI temporar indisponibil.]`,
      patristics: `Comentarii patristice pentru ${reference}: [Serviciul AI temporar indisponibil.]`,
      philology: `Analiză filologică pentru ${reference}: [Serviciul AI temporar indisponibil.]`,
    };
  }
}
