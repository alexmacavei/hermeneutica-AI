/** Named SQL queries for the verse_embeddings table. */

/**
 * Finds the N most similar verses to a given embedding within a translation,
 * ordered by cosine distance (closest first).
 *
 * Parameters: $1 = vector string, $2 = translationId, $3 = limit
 */
export const SEARCH_VERSES_BY_EMBEDDING = `
  SELECT translation_id, book_id, book_name,
         chapter_number, verse_number, verse_text,
         1 - (embedding <=> $1::vector) AS similarity
  FROM verse_embeddings
  WHERE translation_id = $2
  ORDER BY embedding <=> $1::vector
  LIMIT $3
`;

/**
 * Counts how many verses are already indexed for a given
 * translation + book + chapter combination.
 *
 * Parameters: $1 = translationId, $2 = bookId, $3 = chapterNumber
 */
export const COUNT_INDEXED_VERSES = `
  SELECT count(*)::int AS count
  FROM verse_embeddings
  WHERE translation_id = $1
    AND book_id        = $2
    AND chapter_number = $3
`;

/**
 * Inserts a single verse embedding, silently skipping duplicates.
 *
 * Parameters: $1 = translationId, $2 = bookId, $3 = bookName,
 *             $4 = chapterNumber, $5 = verseNumber,
 *             $6 = verseText, $7 = vector string
 */
export const UPSERT_VERSE_EMBEDDING = `
  INSERT INTO verse_embeddings
    (translation_id, book_id, book_name,
     chapter_number, verse_number, verse_text, embedding)
  VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
  ON CONFLICT (translation_id, book_id, chapter_number, verse_number)
  DO NOTHING
`;

/**
 * Looks up a specific verse by translation and coordinates.
 *
 * Parameters: $1 = translationId, $2 = bookId, $3 = chapterNumber, $4 = verseNumber
 */
export const LOOKUP_VERSE_BY_COORDINATES = `
  SELECT book_id, book_name, chapter_number, verse_number, verse_text
  FROM verse_embeddings
  WHERE translation_id  = $1
    AND book_id         = $2
    AND chapter_number  = $3
    AND verse_number    = $4
  LIMIT 1
`;
