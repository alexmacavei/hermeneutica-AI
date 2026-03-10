import {
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VerseHighlightDirective, VerseSelection } from './verse-highlighter.directive';

@Component({
  selector: 'app-bible-text',
  standalone: true,
  imports: [CommonModule, VerseHighlightDirective],
  template: `
    <div
      class="bible-text-container"
      verseHighlight
      [bookName]="bookName"
      [chapterNumber]="chapterNumber"
      (verseSelected)="onVerseSelected($event)"
    >
      <h2 class="chapter-heading">
        <span class="book-name">{{ bookName }}</span>
        <span class="chapter-num"> {{ chapterNumber }}</span>
      </h2>

      <div class="verses-wrapper">
        <div
          *ngFor="let verse of verses"
          class="verse verse-highlight"
          [class.selected]="selectedVerses.includes(verse.number)"
          [attr.data-verse]="verse.number"
        >
          <span class="verse-number">{{ verse.number }}</span>
          <span class="verse-text">{{ verse.text }}</span>
        </div>
      </div>

      <div *ngIf="verses.length === 0" class="empty-state">
        <span class="material-icons">menu_book</span>
        <p>Selectează un capitol pentru a vedea textul biblic.</p>
      </div>
    </div>
  `,
  styles: [`
    .bible-text-container {
      padding: 24px 32px;
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.9;
      user-select: text;
    }

    .chapter-heading {
      color: var(--gold);
      font-size: 1.5rem;
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(255, 215, 0, 0.3);
      padding-bottom: 8px;
    }

    .book-name {
      font-weight: 600;
    }

    .chapter-num {
      opacity: 0.8;
      font-size: 1.2rem;
    }

    .verses-wrapper {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .verse {
      display: flex;
      gap: 12px;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .verse:hover {
      background: rgba(121, 134, 203, 0.15);
    }

    .verse.selected {
      background: rgba(183, 28, 28, 0.25) !important;
    }

    .verse-number {
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 700;
      min-width: 24px;
      padding-top: 3px;
      user-select: none;
    }

    .verse-text {
      color: var(--text-light);
      font-size: 1rem;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);

      .material-icons {
        font-size: 4rem;
        margin-bottom: 16px;
        display: block;
      }
    }
  `],
})
export class BibleTextComponent {
  @Input() bookName = '';
  @Input() chapterNumber = '';
  @Input() verses: { number: string; text: string }[] = [];
  @Input() selectedVerses: string[] = [];
  @Output() verseSelected = new EventEmitter<VerseSelection>();

  onVerseSelected(selection: VerseSelection): void {
    this.verseSelected.emit(selection);
  }
}
