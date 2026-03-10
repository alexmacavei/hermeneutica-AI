import { Component } from '@angular/core';
import { BibleViewerComponent } from './bible-viewer/bible-viewer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BibleViewerComponent],
  template: `
    <div class="app-shell">
      <app-bible-viewer></app-bible-viewer>
    </div>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      background: var(--bg-dark);
    }
  `],
})
export class AppComponent {}
