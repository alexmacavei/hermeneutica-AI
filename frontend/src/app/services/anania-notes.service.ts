import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AnaniaAdnotare {
  id: number;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number | null;
  note_number: number;
  note_text: string;
  metadata: {
    page?: number;
    original_marker?: string;
    attached_to_word?: string;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class AnaniaNotesService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  findByVerse(book: string, chapter: number, verse: number): Observable<AnaniaAdnotare[]> {
    return this.http
      .get<AnaniaAdnotare[]>(
        `${this.apiUrl}/anania-notes`,
        { params: { book, chapter: chapter.toString(), verse: verse.toString() } },
      )
      .pipe(catchError(() => of([])));
  }
}
