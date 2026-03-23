import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { fetchJson } from '../common/http.utils';

/** Message returned when no relevant philosophical context is found. */
export const PHILOSOPHY_FALLBACK =
  'Nu s-au găsit influențe filozofice relevante pentru acest verset.';

/** Maximum number of Church Father results to take from BiblIndex per verse. */
const MAX_BIBLINDEX_RESULTS = 8;

/** Maximum number of top Wikidata philosophers to enrich via Philosophers API. */
const MAX_ENRICHED_PHILOSOPHERS = 5;

/** Maximum number of philosopher entries included in the AI context. */
const MAX_PHILOSOPHERS_IN_CONTEXT = 12;

// ---------------------------------------------------------------------------
// Wikidata entity IDs for representative Church Fathers and influential
// medieval theologians (Aquinas) used in the P737 "influenced by" SPARQL query.
// ---------------------------------------------------------------------------
const THEOLOGICAL_THINKER_WIKIDATA_IDS = [
  'wd:Q5895',   // Origen
  'wd:Q40958',  // Clement din Alexandria
  'wd:Q8017',   // Ioan Gură de Aur
  'wd:Q8018',   // Augustin de Hipona
  'wd:Q189018', // Grigorie de Nyssa
  'wd:Q261523', // Vasile cel Mare
  'wd:Q215018', // Dionisie Areopagitul (Pseudo-)
  'wd:Q309570', // Maxim Mărturisitorul
  'wd:Q9438',   // Toma d'Aquino
];

// ---------------------------------------------------------------------------
// Curated fallbacks – used when external APIs are unreachable
// ---------------------------------------------------------------------------

/** Philosopher name → concise philosophical description (Romanian context). */
const PHILOSOPHER_DETAILS_FALLBACK: Record<string, string> = {
  'Plato': 'Teoria Formelor (eidos), dualismul suflet/corp, ascensiunea contemplativă (theoria), participarea la Bine (methexis); sursa platonismului creștin.',
  'Aristotle': 'Logica formală, teleologia (scopul final / telos), virtutea ca cale de mijloc (mesotēs); preluat de Toma d\'Aquino în scolastică.',
  'Plotinus': 'Triada Unul – Nous – Suflet; emanarea (proodos) și reîntoarcerea (epistrophē); influențează mistica creștină și apofatismul.',
  'Philo of Alexandria': 'Logos ca intermediar divin, alegoria scripturistică, sinteza iudeo-platonică; precursor al hermeneuticii alexandrine.',
  'Socrates': 'Maieutica, cunoașterea de sine (gnōthi seauton), definiția virtuții; fundament moral al eticii creștine timpurii.',
  'Stoics': 'Logos spermatikos (rațiunea seminală universală), apatheia, providența divină, legea naturală; asimilat în etica patristică.',
  'Porphyry': 'Hermeneutica neoplatonică, Isagoge (introducere la categoriile lui Aristotel); influențează scolastica medievală.',
  'Iamblichus': 'Teurgia neoplatonică, ierarhia divină; influențează Dionisie Areopagitul.',
};

/**
 * Book-name keyword (RO or EN) → most relevant Church Fathers for that book.
 * Used when BiblIndex API is unavailable.
 */
const BOOK_TO_FATHERS: Record<string, string[]> = {
  // New Testament
  Ioan: ['Origen', 'Cyril of Alexandria', 'John Chrysostom', 'Clement of Alexandria'],
  John: ['Origen', 'Cyril of Alexandria', 'John Chrysostom', 'Clement of Alexandria'],
  Matei: ['Origen', 'John Chrysostom', 'Hilary of Poitiers'],
  Matthew: ['Origen', 'John Chrysostom', 'Hilary of Poitiers'],
  Luca: ['Origen', 'Ambrose', 'Cyril of Alexandria'],
  Luke: ['Origen', 'Ambrose', 'Cyril of Alexandria'],
  Marcu: ['Origen', 'Victor of Antioch'],
  Mark: ['Origen', 'Victor of Antioch'],
  Romani: ['Origen', 'John Chrysostom', 'Augustine', 'Theodoret'],
  Romans: ['Origen', 'John Chrysostom', 'Augustine', 'Theodoret'],
  Efeseni: ['John Chrysostom', 'Jerome', 'Theodoret'],
  Ephesians: ['John Chrysostom', 'Jerome', 'Theodoret'],
  Coloseni: ['John Chrysostom', 'Theodore of Mopsuestia'],
  Colossians: ['John Chrysostom', 'Theodore of Mopsuestia'],
  // Old Testament
  Ps: ['Origen', 'Athanasius', 'Basil of Caesarea', 'Gregory of Nyssa'],
  Psalmi: ['Origen', 'Athanasius', 'Basil of Caesarea', 'Gregory of Nyssa'],
  Psalm: ['Origen', 'Athanasius', 'Basil of Caesarea', 'Gregory of Nyssa'],
  Geneza: ['Origen', 'Basil of Caesarea', 'John Chrysostom', 'Ambrose'],
  Genesis: ['Origen', 'Basil of Caesarea', 'John Chrysostom', 'Ambrose'],
  Isaia: ['Origen', 'John Chrysostom', 'Jerome', 'Cyril of Alexandria'],
  Isaiah: ['Origen', 'John Chrysostom', 'Jerome', 'Cyril of Alexandria'],
  Iov: ['John Chrysostom', 'Gregory the Great', 'Julian of Eclanum'],
  Job: ['John Chrysostom', 'Gregory the Great', 'Julian of Eclanum'],
};

/** Default Church Fathers used when the book is not in BOOK_TO_FATHERS. */
const DEFAULT_FATHERS = [
  'Origen',
  'John Chrysostom',
  'Augustine',
  'Gregory of Nyssa',
  'Clement of Alexandria',
];

// ---------------------------------------------------------------------------
// Internal result types
// ---------------------------------------------------------------------------

interface WikidataPhilosopher {
  label: string;
  description: string;
}

interface PhilosophersApiResult {
  name: string;
  school?: string;
  description?: string;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// External API endpoints
// ---------------------------------------------------------------------------

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const PHILOSOPHERS_API_URL = 'https://philosophersapi.com/api/philosophers';
const BIBLINDEX_API_URL = 'https://www.biblindex.org/api';

/**
 * Enrichment service for the "Influențe Filozofice" card.
 *
 * Queries three external sources to build a rich philosophical context:
 *   1. **BiblIndex** – identifies Church Fathers who commented on the verse.
 *   2. **Wikidata SPARQL** – retrieves P737 ("influenced by") chains for those Fathers.
 *   3. **Philosophers API** – provides school/detail data for each philosopher found.
 *
 * Graceful degradation: every external call has a timeout and falls back to
 * curated static data so the card always renders something meaningful.
 */
@Injectable()
export class PhilosophyEnrichmentService {
  private readonly logger = new Logger(PhilosophyEnrichmentService.name);

  constructor(private readonly aiService: AiService) {}

  // --------------------------------------------------------------------------
  // Source 1: BiblIndex
  // --------------------------------------------------------------------------

  /**
   * Returns the list of Church Fathers who commented on the given verse
   * reference. Tries the BiblIndex API first; falls back to a curated
   * book-level mapping.
   */
  async getFathersForVerse(reference: string): Promise<string[]> {
    try {
      const url = `${BIBLINDEX_API_URL}/quotations?ref=${encodeURIComponent(reference)}&format=json`;
      const data = await fetchJson(url) as Record<string, unknown>;
      const fathers: string[] = [];
      const results = data?.['results'];
      if (Array.isArray(results)) {
        for (const item of (results as Record<string, unknown>[]).slice(0, MAX_BIBLINDEX_RESULTS)) {
          if (item['author']) fathers.push(String(item['author']));
        }
      }
      if (fathers.length > 0) {
        this.logger.debug(`BiblIndex returned ${fathers.length} fathers for "${reference}"`);
        return [...new Set(fathers)];
      }
    } catch {
      this.logger.debug(`BiblIndex unavailable for "${reference}", using curated fallback`);
    }

    // Fallback: match first word of reference against the book map
    const bookKey = reference.split(/[\s:,]/)[0];
    return BOOK_TO_FATHERS[bookKey] ?? DEFAULT_FATHERS;
  }

  // --------------------------------------------------------------------------
  // Source 2: Wikidata SPARQL
  // --------------------------------------------------------------------------

  /**
   * Runs a Wikidata SPARQL query to collect all philosophers (P737 "influenced
   * by") linked to the canonical set of Church Fathers and medieval theologians.
   * Returns a list of philosopher labels and English descriptions.
   */
  async getWikidataInfluences(): Promise<WikidataPhilosopher[]> {
    const sparql = `
SELECT DISTINCT ?philosopher ?philosopherLabel (SAMPLE(?desc) AS ?philosopherDesc) WHERE {
  VALUES ?father {
    ${THEOLOGICAL_THINKER_WIKIDATA_IDS.join('\n    ')}
  }
  ?father wdt:P737 ?philosopher.
  OPTIONAL {
    ?philosopher schema:description ?desc.
    FILTER(LANG(?desc) = "en")
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?philosopher ?philosopherLabel
LIMIT 25`.trim();

    try {
      const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(sparql)}&format=json`;
      const data = await fetchJson(url) as Record<string, unknown>;
      const results: WikidataPhilosopher[] = [];
      const bindings = (data?.['results'] as Record<string, unknown>)?.['bindings'];
      if (Array.isArray(bindings)) {
        for (const binding of bindings as Record<string, Record<string, string>>[]) {
          const label: string = binding['philosopherLabel']?.['value'] ?? '';
          const description: string = binding['philosopherDesc']?.['value'] ?? '';
          if (label) results.push({ label, description });
        }
      }
      this.logger.debug(`Wikidata returned ${results.length} philosophers`);
      return results;
    } catch {
      this.logger.debug('Wikidata SPARQL unavailable, using curated fallback');
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // Source 3: Philosophers API
  // --------------------------------------------------------------------------

  /**
   * Searches the Philosophers API for details on a given philosopher name.
   * Returns null if the API is unreachable or returns no results.
   */
  async searchPhilosophersApi(name: string): Promise<PhilosophersApiResult | null> {
    try {
      const url = `${PHILOSOPHERS_API_URL}/search?keyword=${encodeURIComponent(name)}`;
      const data = await fetchJson(url);
      if (Array.isArray(data) && data.length > 0) {
        const item = (data as Record<string, unknown>[])[0];
        return {
          name: String(item['name'] ?? name),
          school: item['school'] ? String(item['school']) : undefined,
          description: (item['description'] ?? item['bio'])
            ? String(item['description'] ?? item['bio'])
            : undefined,
        };
      }
    } catch {
      this.logger.debug(`Philosophers API unavailable for "${name}"`);
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Main entry point
  // --------------------------------------------------------------------------

  /**
   * Collects philosophical influence data from all three sources and generates
   * an AI-powered summary for the "Influențe Filozofice" card.
   *
   * Falls back to `PHILOSOPHY_FALLBACK` when the AI service is unavailable.
   */
  async buildPhilosophySummary(verseText: string, reference: string): Promise<string> {
    // Query BiblIndex and Wikidata in parallel
    const [fathers, wikidataPhilosophers] = await Promise.all([
      this.getFathersForVerse(reference),
      this.getWikidataInfluences(),
    ]);

    // Build philosopher detail map: Wikidata results first, enriched by API
    const philosopherMap = new Map<string, string>();

    for (const p of wikidataPhilosophers) {
      philosopherMap.set(p.label, p.description);
    }

    // Enrich the first MAX_ENRICHED_PHILOSOPHERS Wikidata philosophers with Philosophers API details
    const topPhilosophers = wikidataPhilosophers.slice(0, MAX_ENRICHED_PHILOSOPHERS).map((p) => p.label);
    const apiResults = await Promise.all(
      topPhilosophers.map((name) => this.searchPhilosophersApi(name)),
    );
    for (let i = 0; i < topPhilosophers.length; i++) {
      const apiResult = apiResults[i];
      if (apiResult) {
        const extras = [apiResult.school, apiResult.description].filter(Boolean).join('; ');
        const existing = philosopherMap.get(topPhilosophers[i]) ?? '';
        philosopherMap.set(topPhilosophers[i], [existing, extras].filter(Boolean).join(' — '));
      }
    }

    // Fill gaps with curated fallback descriptions
    for (const [name, details] of Object.entries(PHILOSOPHER_DETAILS_FALLBACK)) {
      if (!philosopherMap.has(name)) {
        philosopherMap.set(name, details);
      }
    }

    // Build context strings for the AI prompt
    const fathersContext = fathers.join(', ');
    const philosophersContext = [...philosopherMap.entries()]
      .slice(0, MAX_PHILOSOPHERS_IN_CONTEXT)
      .map(([name, desc]) => `• ${name}${desc ? ': ' + desc : ''}`)
      .join('\n');

    return this.aiService.generatePhilosophySummary(
      reference,
      verseText,
      fathersContext,
      philosophersContext,
    ).then((result) => result || PHILOSOPHY_FALLBACK);
  }
}
