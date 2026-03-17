import {
  Component,
  EventEmitter,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { BibleApiService, Translation, Book } from '../services/bible-api.service';

export interface BibleNavigation {
  translationId: string;
  translationName: string;
  bookId: string;
  bookName: string;
  chapter: number;
  numChapters: number;
}

interface SelectOption<T = string> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-bible-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule],
  template: `
    <div class="selector-bar">
      <!-- Translation -->
      <p-select
        [options]="translationOptions"
        [(ngModel)]="selectedTranslationId"
        (ngModelChange)="onTranslationChange()"
        optionLabel="label"
        optionValue="value"
        placeholder="Traducere..."
        [filter]="true"
        filterBy="label"
        styleClass="selector-dropdown"
      ></p-select>

      <!-- Book -->
      <p-select
        [options]="bookOptions"
        [(ngModel)]="selectedBookId"
        (ngModelChange)="onBookChange()"
        optionLabel="label"
        optionValue="value"
        placeholder="Carte..."
        [filter]="true"
        filterBy="label"
        styleClass="selector-dropdown"
        [disabled]="bookOptions.length === 0"
      ></p-select>

      <!-- Chapter -->
      <p-select
        [options]="chapterOptions"
        [(ngModel)]="selectedChapter"
        (ngModelChange)="onNavigate()"
        optionLabel="label"
        optionValue="value"
        placeholder="Capitol..."
        styleClass="selector-dropdown"
        [disabled]="chapterOptions.length === 0"
      ></p-select>
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
      min-width: 150px;

      .p-select {
        background: #1e1e3c;
        border: 1px solid rgba(121, 134, 203, 0.4);
        border-radius: 6px;
      }
      .p-select-label {
        color: #e8eaf6;
        font-size: 0.9rem;
        padding: 6px 10px;
      }
      .p-select-dropdown { color: #9fa8da; }
      .p-select-overlay {
        background: #1e1e3c;
        border: 1px solid rgba(121, 134, 203, 0.3);
      }
      .p-select-list-container {
        background: #1e1e3c;
      }
      .p-select-option {
        color: #e8eaf6;
        font-size: 0.9rem;
        &:hover { background: rgba(121, 134, 203, 0.2); }
        &.p-select-option-selected { background: rgba(26, 35, 126, 0.6); }
      }
      .p-select-filter {
        background: #16162e;
        color: #e8eaf6;
        border: 1px solid rgba(121, 134, 203, 0.4);
      }
    }
  `],
})
export class BibleSelectorComponent implements OnInit {
  @Output() navigate = new EventEmitter<BibleNavigation>();

  selectedTranslationId = '';
  selectedBookId = '';
  selectedChapter = 1;

  translationOptions: SelectOption[] = [];
  bookOptions: SelectOption[] = [];
  chapterOptions: SelectOption<number>[] = [];

  private books: Book[] = [];
  private translations: Translation[] = [];

  constructor(private readonly bibleApi: BibleApiService) {}

  ngOnInit(): void {
    this.bibleApi.getTranslations().subscribe((translations) => {
      this.translations = translations;
      this.translationOptions = translations.map((t) => ({
        label: t.name || t.englishName,
        value: t.id,
      }));

      // Default to first translation
      if (this.translationOptions.length > 0) {
        this.selectedTranslationId = this.translationOptions[0].value;
        this.loadBooks();
      }
    });
  }

  onTranslationChange(): void {
    this.selectedBookId = '';
    this.selectedChapter = 1;
    this.bookOptions = [];
    this.chapterOptions = [];
    this.loadBooks();
  }

  onBookChange(): void {
    this.selectedChapter = 1;
    this.buildChapterOptions();
    this.onNavigate();
  }

  onNavigate(): void {
    if (!this.selectedTranslationId || !this.selectedBookId) return;

    const book = this.books.find((b) => b.id === this.selectedBookId);
    const translation = this.translations.find(
      (t) => t.id === this.selectedTranslationId,
    );

    this.navigate.emit({
      translationId: this.selectedTranslationId,
      translationName: translation?.name ?? translation?.englishName ?? this.selectedTranslationId,
      bookId: this.selectedBookId,
      bookName: book?.name ?? this.selectedBookId,
      chapter: this.selectedChapter,
      numChapters: book?.numChapters ?? 1,
    });
  }

  private loadBooks(): void {
    if (!this.selectedTranslationId) return;

    this.bibleApi.getBooks(this.selectedTranslationId).subscribe((books) => {
      this.books = books;
      this.bookOptions = books.map((b) => ({
        label: b.name,
        value: b.id,
      }));

      if (books.length > 0) {
        this.selectedBookId = books[0].id;
        this.buildChapterOptions();
        this.onNavigate();
      }
    });
  }

  private buildChapterOptions(): void {
    const book = this.books.find((b) => b.id === this.selectedBookId);
    if (!book) {
      this.chapterOptions = [];
      return;
    }
    this.chapterOptions = Array.from({ length: book.numChapters }, (_, i) => ({
      label: `Capitol ${i + 1}`,
      value: i + 1,
    }));
    // Clamp selected chapter within valid range
    if (this.selectedChapter < 1 || this.selectedChapter > book.numChapters) {
      this.selectedChapter = 1;
    }
  }
}
