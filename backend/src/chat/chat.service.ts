import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PatristicRagService } from '../patristic/patristic-rag.service';
import { ChatMessageDto } from './chat.dto';

const CHAT_SYSTEM_PROMPT = `Ești un asistent teologic ortodox specializat în hermeneutică biblică, 
patrologie și filozofie creștină. Ai acces la un corpus de texte patristice și biblice.

Răspunde în română, cu claritate și profunzime teologică. Când există fragmente patristice relevante 
furnizate în context, folosește-le pentru a-ți fundamenta răspunsul și citează autorul și lucrarea. 
Dacă nu există context patristic, răspunde pe baza cunoștințelor tale teologice generale.

Fii respectuos, academic și fidel Tradiției ortodoxe. Nu inventa citate sau referințe patristice.

Dacă utilizatorul adresează o întrebare care nu ține de domeniul teologiei, al Sfintei Scripturi, 
al Sfinților Părinți, al spiritualității ortodoxe, al hermeneuticii sau al filozofiei creștine, 
declină cu smerenie și redirecționează-l astfel:
„Îmi pare rău, dar nu pot răspunde la această întrebare. Sunt un asistent teologic dedicat 
studiului Sfintei Scripturi, comentariilor patristice și hermeneuticii ortodoxe. 
Vă invit să adresați o întrebare din aceste domenii — sunt aici să vă ajut!"`;

const CHAT_FALLBACK_RESPONSE =
  'Serviciul de chat nu este disponibil momentan. Vă rugăm configurați OPENAI_API_KEY.';

/**
 * Service that powers the chatbot feature.
 *
 * For each user message it:
 *  1. Searches the patristic corpus for relevant chunks via RAG.
 *  2. Injects those chunks as context into the system prompt.
 *  3. Sends the full conversation history + new message to the LLM.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly patristicRagService: PatristicRagService,
  ) {}

  async sendMessage(
    message: string,
    history: ChatMessageDto[] = [],
  ): Promise<string> {
    if (!this.aiService.hasApiKey) {
      return CHAT_FALLBACK_RESPONSE;
    }

    // Retrieve patristic context relevant to the user's question
    const contextBlocks = await this.patristicRagService.findRelevantChunksForVerse(
      message,
      '',
      5,
    );

    // Build an enriched system prompt with any retrieved patristic fragments
    let systemPrompt = CHAT_SYSTEM_PROMPT;
    if (contextBlocks.length > 0) {
      const contextText = contextBlocks
        .map(
          (c, i) =>
            `[${i + 1}] ${c.author} – ${c.work}${c.chapter ? `, ${c.chapter}` : ''}: «${c.chunkText}»`,
        )
        .join('\n\n');
      systemPrompt += `\n\n## Fragmente patristice relevante:\n${contextText}`;
    }

    // Build the messages array: system + conversation history + new user message
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    try {
      const reply = await this.aiService.chat(messages, {
        temperature: 0.7,
        max_tokens: 1500,
      });
      return reply || CHAT_FALLBACK_RESPONSE;
    } catch (error) {
      this.logger.error('Chat completion error', error);
      return CHAT_FALLBACK_RESPONSE;
    }
  }
}
