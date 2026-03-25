import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  sendMessage(message: string, history: ChatMessage[] = []): Observable<ChatResponse> {
    const request: ChatRequest = { message, history };
    return this.http.post<ChatResponse>(`${this.apiUrl}/chat/message`, request);
  }
}
