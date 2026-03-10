import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';

export interface BibleNavigation {
  testament: string;
  book: string;
  chapter: string;
  language: string;
}

interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-bible-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, DropdownModule],
  template: `
    <div class="selector-bar">
      <p-dropdown
        [options]="testamentOptions"
        [(ngModel)]="selectedTestament"
        (ngModelChange)="onTestamentChange()"
        optionLabel="label"
        optionValue="value"
        placeholder="Testament"
        styleClass="selector-dropdown"
      ></p-dropdown>

      <p-dropdown
        [options]="bookOptions"
        [(ngModel)]="selectedBook"
        (ngModelChange)="onBookChange()"
        optionLabel="label"
        optionValue="value"
        placeholder="Carte"
        styleClass="selector-dropdown"
      ></p-dropdown>

      <p-dropdown
        [options]="chapterOptions"
        [(ngModel)]="selectedChapter"
        (ngModelChange)="onNavigate()"
        optionLabel="label"
        optionValue="value"
        placeholder="Capitol"
        styleClass="selector-dropdown"
      ></p-dropdown>

      <p-dropdown
        [options]="languageOptions"
        [(ngModel)]="selectedLanguage"
        (ngModelChange)="onNavigate()"
        optionLabel="label"
        optionValue="value"
        placeholder="Limbă"
        styleClass="selector-dropdown"
      ></p-dropdown>
    </div>
  `,
  styles: [`
    .selector-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding: 10px 16px;
      align-items: center;
    }

    :host ::ng-deep .selector-dropdown {
      min-width: 140px;

      .p-dropdown {
        background: rgba(30, 30, 60, 0.9);
        border: 1px solid rgba(121, 134, 203, 0.4);
        border-radius: 6px;
      }

      .p-dropdown-label {
        color: #e8eaf6;
        font-size: 0.9rem;
        padding: 6px 10px;
      }

      .p-dropdown-trigger {
        color: #9fa8da;
      }

      .p-dropdown-panel {
        background: #1e1e2e;
        border: 1px solid rgba(121, 134, 203, 0.3);
      }

      .p-dropdown-item {
        color: #e8eaf6;
        font-size: 0.9rem;
        &:hover { background: rgba(121, 134, 203, 0.2); }
        &.p-highlight { background: rgba(26, 35, 126, 0.6); }
      }
    }
  `],
})
export class BibleSelectorComponent implements OnChanges {
  @Input() bibleData: Record<string, Record<string, Record<string, Record<string, string>>>> = {};
  @Output() navigate = new EventEmitter<BibleNavigation>();

  selectedTestament = 'NT';
  selectedBook = 'Matei';
  selectedChapter = '5';
  selectedLanguage = 'sinodala-ro';

  readonly testamentOptions: SelectOption[] = [
    { label: 'Noul Testament', value: 'NT' },
    { label: 'Vechiul Testament', value: 'VT' },
  ];

  readonly languageOptions: SelectOption[] = [
    { label: '🇷🇴 Sinodală', value: 'sinodala-ro' },
    { label: '🇬🇷 Greacă NT', value: 'greaca-nt' },
  ];

  bookOptions: SelectOption[] = [];
  chapterOptions: SelectOption[] = [];

  ngOnChanges(): void {
    this.updateBooks();
    this.updateChapters();
  }

  onTestamentChange(): void {
    this.updateBooks();
    if (this.bookOptions.length > 0) {
      this.selectedBook = this.bookOptions[0].value;
    }
    this.updateChapters();
    if (this.chapterOptions.length > 0) {
      this.selectedChapter = this.chapterOptions[0].value;
    }
    this.onNavigate();
  }

  onBookChange(): void {
    this.updateChapters();
    if (this.chapterOptions.length > 0) {
      this.selectedChapter = this.chapterOptions[0].value;
    }
    this.onNavigate();
  }

  onNavigate(): void {
    this.navigate.emit({
      testament: this.selectedTestament,
      book: this.selectedBook,
      chapter: this.selectedChapter,
      language: this.selectedLanguage,
    });
  }

  private updateBooks(): void {
    const testament = this.bibleData[this.selectedTestament];
    this.bookOptions = testament
      ? Object.keys(testament).map((b) => ({ label: b, value: b }))
      : [];
  }

  private updateChapters(): void {
    const book = this.bibleData[this.selectedTestament]?.[this.selectedBook];
    this.chapterOptions = book
      ? Object.keys(book).map((c) => ({ label: `Capitol ${c}`, value: c }))
      : [];
  }
}
