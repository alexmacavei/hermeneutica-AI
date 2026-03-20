import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserNote {
  id: number;
  user_id: number;
  verse_reference: string;
  note_title: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  getNotesForVerse(verseReference: string): Observable<UserNote[]> {
    return this.http.get<UserNote[]>(`${this.apiUrl}/notes`, {
      params: { verse_reference: verseReference },
    });
  }

  createNote(
    verseReference: string,
    noteTitle: string,
    noteText: string,
  ): Observable<UserNote> {
    return this.http.post<UserNote>(`${this.apiUrl}/notes`, {
      verse_reference: verseReference,
      note_title: noteTitle,
      note_text: noteText,
    });
  }

  updateNote(
    id: number,
    noteTitle: string,
    noteText: string,
  ): Observable<UserNote> {
    return this.http.put<UserNote>(`${this.apiUrl}/notes/${id}`, {
      note_title: noteTitle,
      note_text: noteText,
    });
  }

  deleteNote(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/notes/${id}`);
  }
}
