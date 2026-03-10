import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Translation {
  id: string;
  name: string;
  englishName: string;
  language: string;
  textDirection: string;
}

export interface Book {
  id: string;
  name: string;
  numChapters: number;
}

export interface BibleVerse {
  number: string;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class BibleApiService {
  private readonly base = `${environment.apiUrl}/bible`;

  // Simple per-request share cache so repeated subscribers don't double-fire
  private readonly translationsCache$: Observable<Translation[]>;

  constructor(private readonly http: HttpClient) {
    this.translationsCache$ = this.http
      .get<Translation[]>(`${this.base}/translations`)
      .pipe(shareReplay(1));
  }

  /** Fetch all available translations (cached for the lifetime of the service). */
  getTranslations(): Observable<Translation[]> {
    return this.translationsCache$;
  }

  /** Fetch the list of books for a given translation. */
  getBooks(translationId: string): Observable<Book[]> {
    return this.http.get<Book[]>(`${this.base}/${translationId}/books`);
  }

  /** Fetch all verses for a chapter. */
  getChapter(
    translationId: string,
    bookId: string,
    chapter: number,
  ): Observable<BibleVerse[]> {
    return this.http.get<BibleVerse[]>(
      `${this.base}/${translationId}/${bookId}/${chapter}`,
    );
  }
}
