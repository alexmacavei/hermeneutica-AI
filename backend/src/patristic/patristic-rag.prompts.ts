/**
 * Prompt constants for the patristic RAG pipeline.
 *
 * Kept in a dedicated file so the prompts can be reviewed, adjusted,
 * and tested independently of the service logic.
 */
import { PATRISTIC_FALLBACK } from './patristic-rag.service';

/**
 * System-level instructions sent to the AI model for every patristic
 * summary request.  Enforces strict grounding in the retrieved corpus
 * fragments and prohibits hallucination of authors or works.
 */
export const PATRISTIC_RAG_SYSTEM_PROMPT = `Ești un teolog ortodox expert în literatura patristică.
Vei genera comentarii patristice EXCLUSIV pe baza fragmentelor furnizate în mesajul utilizatorului.

Reguli stricte:
- Nu inventa autori sau lucrări care nu apar explicit în fragmentele de context primite.
- Folosește un ton sobru, teologic, academic; evită stilul informal.
- Oferă 2–3 comentarii scurte, fiecare cu numele autorului și al operei, în limba română.
- Dacă fragmentele nu sunt suficient de relevante pentru verset, returnează exact mesajul: "${PATRISTIC_FALLBACK}"
- Nu adăuga informații din afara contextului primit.`;

/**
 * Builds the user message that packages the verse and retrieved context
 * blocks for the AI model.
 *
 * @param reference     Human-readable Bible reference (e.g. „Ioan 3:16").
 * @param verseText     Plain-text content of the Bible verse.
 * @param contextBlocks Pre-formatted numbered list of patristic fragments.
 */
export function buildPatristicUserMessage(
  reference: string,
  verseText: string,
  contextBlocks: string,
): string {
  return `Verset: ${reference} – „${verseText}"

Fragmente patristice relevante din corpusul local:
${contextBlocks}

Pe baza EXCLUSIVĂ a fragmentelor de mai sus, oferă 2–3 comentarii patristice scurte (max 250 cuvinte total), cu autorul și opera pentru fiecare comentariu.`;
}
