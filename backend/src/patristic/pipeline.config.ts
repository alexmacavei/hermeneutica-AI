/**
 * Configuration constants for the patristic text ingestion pipeline.
 *
 * These values govern how local patristic files (HTML/TXT) are chunked
 * before embedding generation and storage in PostgreSQL (pgvector).
 */

/** Target size of a single text chunk, in characters. */
export const PATRISTIC_CHUNK_SIZE = 750;

/**
 * Number of characters by which consecutive chunks overlap so that
 * sentence-boundary context is preserved across chunk borders.
 */
export const PATRISTIC_CHUNK_OVERLAP = 100;

/**
 * Minimum cosine-similarity score (0–1) used when querying the
 * `patristic_chunks` table.  Results with a lower score are discarded.
 *
 * Set to 0.35 to accommodate cross-language matching: patristic source texts
 * (English, from NewAdvent) are queried with Romanian verse text, so cosine
 * similarity between semantically related content is typically in the 0.35–0.65
 * range rather than the 0.7+ range expected for same-language pairs.
 */
export const PATRISTIC_SIMILARITY_THRESHOLD = 0.35;

/**
 * Number of candidate chunks fetched from the database before the
 * similarity threshold filter is applied.  Using a larger pool than the
 * final `limit` ensures that low-scoring but highly relevant results are
 * not discarded simply because they fall outside the top-N returned by the
 * ORDER BY clause alone.
 */
export const PATRISTIC_SEARCH_CANDIDATES = 20;

/**
 * Name of the environment variable that holds the path to the local
 * directory containing patristic source files (HTML/TXT).
 *
 * Example: PATRISTIC_DATA_DIR=/home/user/new-advent
 */
export const PATRISTIC_DATA_DIR_ENV = 'PATRISTIC_DATA_DIR';

/**
 * File extensions that the loader will scan for inside PATRISTIC_DATA_DIR.
 * All matching files in any sub-directory are included recursively.
 */
export const PATRISTIC_SUPPORTED_EXTENSIONS = ['.html', '.htm', '.txt'];
