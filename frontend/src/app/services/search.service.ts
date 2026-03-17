import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SearchResult {
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verseNumber: number;
  verseText: string;
  similarity: number;
  reference: string;
}

export interface SearchResponse {
  query: string;
  translationId: string;
  results: SearchResult[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/search`;

  /**
   * Performs semantic search for verses related to `query` within the
   * specified translation.
   */
  searchVerses(
    query: string,
    translationId: string,
    limit = 10,
  ): Observable<SearchResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('translationId', translationId)
      .set('limit', String(limit));

    return this.http
      .get<SearchResponse>(this.base, { params })
      .pipe(
        catchError(() => of({ query, translationId, results: [], total: 0 })),
      );
  }

  /**
   * Sends a fire-and-forget request to ingest embeddings for the given
   * chapter.  Errors are silently ignored so chapter loading is never blocked.
   */
  ingestChapter(
    translationId: string,
    bookId: string,
    bookName: string,
    chapter: number,
    verses: { number: string; text: string }[],
  ): void {
    const url = `${this.base}/ingest/${translationId}/${bookId}/${chapter}`;
    this.http
      .post(url, { bookName, verses })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }
}
