import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HermeneuticaCards {
  hermeneutics: string;
  philosophy: string;
  patristics: string;
  philology: string;
}

export interface AnalysisResult {
  reference: string;
  language: string;
  text: string;
  cards: HermeneuticaCards;
  timestamp: string;
}

export interface AnalyzeRequest {
  text: string;
  range: string;
  language?: string;
}

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  analyze(request: AnalyzeRequest): Observable<AnalysisResult> {
    return this.http.post<AnalysisResult>(
      `${this.apiUrl}/analyze`,
      request,
    );
  }
}
