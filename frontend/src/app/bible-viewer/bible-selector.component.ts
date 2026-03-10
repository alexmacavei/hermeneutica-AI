import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';

export interface BibleNavigation {
  testament: string;
  book: string;
  chapter: string;
  language: string;
}

@Component({
  selector: 'app-bible-selector',
  standalone: true,
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, FormsModule],
  template: `
    <div class="selector-bar">
      <mat-form-field appearance="outline" class="selector-field">
        <mat-label>Testament</mat-label>
        <mat-select [(ngModel)]="selectedTestament" (ngModelChange)="onTestamentChange()">
          <mat-option value="NT">Noul Testament</mat-option>
          <mat-option value="VT">Vechiul Testament</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="selector-field">
        <mat-label>Carte</mat-label>
        <mat-select [(ngModel)]="selectedBook" (ngModelChange)="onBookChange()">
          <mat-option *ngFor="let book of availableBooks" [value]="book">
            {{ book }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="selector-field">
        <mat-label>Capitol</mat-label>
        <mat-select [(ngModel)]="selectedChapter" (ngModelChange)="onNavigate()">
          <mat-option *ngFor="let ch of availableChapters" [value]="ch">
            Capitol {{ ch }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="selector-field">
        <mat-label>Limbă</mat-label>
        <mat-select [(ngModel)]="selectedLanguage" (ngModelChange)="onNavigate()">
          <mat-option value="sinodala-ro">🇷🇴 Sinodală</mat-option>
          <mat-option value="greaca-nt">🇬🇷 Greacă NT</mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  `,
  styles: [`
    .selector-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding: 16px;
      background: #12122a;
      border-bottom: 1px solid rgba(121, 134, 203, 0.3);
    }
    .selector-field {
      min-width: 160px;
      flex: 1;
    }
    :host ::ng-deep .mat-mdc-form-field {
      .mat-mdc-text-field-wrapper {
        background: rgba(30, 30, 60, 0.8);
      }
      .mat-mdc-select-value, label {
        color: #e8eaf6;
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

  availableBooks: string[] = [];
  availableChapters: string[] = [];

  ngOnChanges(): void {
    this.updateBooks();
    this.updateChapters();
  }

  onTestamentChange(): void {
    this.updateBooks();
    if (this.availableBooks.length > 0) {
      this.selectedBook = this.availableBooks[0];
    }
    this.updateChapters();
    if (this.availableChapters.length > 0) {
      this.selectedChapter = this.availableChapters[0];
    }
    this.onNavigate();
  }

  onBookChange(): void {
    this.updateChapters();
    if (this.availableChapters.length > 0) {
      this.selectedChapter = this.availableChapters[0];
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
    this.availableBooks = testament ? Object.keys(testament) : [];
  }

  private updateChapters(): void {
    const book = this.bibleData[this.selectedTestament]?.[this.selectedBook];
    this.availableChapters = book ? Object.keys(book) : [];
  }
}
