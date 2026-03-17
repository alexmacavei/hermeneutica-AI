/** Named SQL queries for the patristic_chunks table. */

/**
 * Creates the patristic_chunks table if it does not already exist.
 * Requires the `vector` extension to be enabled first.
 */
export const CREATE_PATRISTIC_TABLE = `
  CREATE TABLE IF NOT EXISTS patristic_chunks (
    id           SERIAL PRIMARY KEY,
    author       TEXT          NOT NULL,
    work         TEXT          NOT NULL,
    chapter      TEXT,
    source_file  TEXT          NOT NULL,
    source_url   TEXT,
    chunk_index  INT           NOT NULL,
    chunk_text   TEXT          NOT NULL,
    embedding    vector(1536),
    created_at   TIMESTAMPTZ   DEFAULT now(),
    UNIQUE (source_file, chunk_index)
  )
`;

/**
 * Inserts a single patristic chunk with its embedding, silently skipping
 * duplicates (same source_file + chunk_index).
 *
 * Parameters:
 *   $1 = author, $2 = work, $3 = chapter, $4 = source_file,
 *   $5 = source_url, $6 = chunk_index, $7 = chunk_text, $8 = vector string
 */
export const UPSERT_PATRISTIC_CHUNK = `
  INSERT INTO patristic_chunks
    (author, work, chapter, source_file, source_url, chunk_index, chunk_text, embedding)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
  ON CONFLICT (source_file, chunk_index)
  DO NOTHING
`;

/**
 * Counts how many chunks have already been indexed for a given source file.
 * Used to skip re-indexing files that are already fully processed.
 *
 * Parameters: $1 = source_file
 */
export const COUNT_INDEXED_CHUNKS = `
  SELECT count(*)::int AS count
  FROM patristic_chunks
  WHERE source_file = $1
`;

/**
 * Finds the N most similar patristic chunks to a given embedding,
 * ordered by cosine distance (closest first).
 *
 * Parameters: $1 = vector string, $2 = limit
 */
export const SEARCH_PATRISTIC_BY_EMBEDDING = `
  SELECT id, author, work, chapter, source_file, source_url,
         chunk_index, chunk_text,
         1 - (embedding <=> $1::vector) AS similarity
  FROM patristic_chunks
  ORDER BY embedding <=> $1::vector
  LIMIT $2
`;
