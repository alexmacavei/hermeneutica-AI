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

interface HermeneuticaPromptConfig {
  system: string;
  user_template: string;
  cards: {
    hermeneutics: { title: string; prompt: string };
    philosophy: { title: string; prompt: string };
    patristics: { title: string; prompt: string };
    philology: { title: string; prompt: string };
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly prompts: HermeneuticaPromptConfig;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey') ?? '';
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
  }

  async generateFourCards(
    text: string,
    reference: string,
    language: string = 'Sinodală Română',
  ): Promise<HermeneuticaCards> {
    const userMessage = this.prompts.user_template
      .replace('{reference}', reference)
      .replace('{language}', language)
      .replace('{text}', text);

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.prompts.system },
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
