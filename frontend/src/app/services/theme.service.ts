import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'hermeneutica-theme';

  /** Current theme – defaults to saved preference, falls back to 'dark'. */
  readonly theme = signal<Theme>(this._loadTheme());

  constructor() {
    effect(() => {
      this._applyTheme(this.theme());
    });
  }

  toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private _loadTheme(): Theme {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY) as Theme;
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  private _applyTheme(theme: Theme): void {
    const html = document.documentElement;
    if (theme === 'dark') {
      // The `.dark` class is consumed by PrimeNG's `darkModeSelector: '.dark'`
      // (configured in app.config.ts) to activate the dark Aura preset.
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
    }
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch {
      // localStorage may be unavailable in certain environments
    }
  }
}
