import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CurrentUser {
  email: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  private readonly _currentUser = signal<CurrentUser | null>(
    this.loadFromStorage(),
  );

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);

  register(email: string, password: string): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>(`${this.apiUrl}/auth/register`, {
        email,
        password,
      })
      .pipe(tap((res) => this.saveSession(email, res.token)));
  }

  login(email: string, password: string): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>(`${this.apiUrl}/auth/login`, {
        email,
        password,
      })
      .pipe(tap((res) => this.saveSession(email, res.token)));
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_email');
    this._currentUser.set(null);
  }

  private saveSession(email: string, token: string): void {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_email', email);
    this._currentUser.set({ email, token });
  }

  private loadFromStorage(): CurrentUser | null {
    const token = localStorage.getItem('auth_token');
    const email = localStorage.getItem('auth_email');
    if (token && email) {
      return { token, email };
    }
    return null;
  }
}
