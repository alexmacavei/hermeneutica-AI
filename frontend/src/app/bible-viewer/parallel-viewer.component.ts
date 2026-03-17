import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { ParallelTranslation } from '../services/bible-api.service';

@Component({
  selector: 'app-parallel-viewer',
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule, ButtonModule],
  template: `
    <div class="parallel-section">
      <!-- Header -->
      <div class="parallel-header">
        <div class="header-info">
          <i class="pi pi-book reference-icon"></i>
          <div class="header-text">
            <h3 class="panel-title">Studiu Paralel</h3>
            <span class="reference-badge" *ngIf="reference">{{ reference }}</span>
          </div>
        </div>
        <button
          pButton
          icon="pi pi-times"
          class="p-button-text p-button-rounded close-btn"
          (click)="close.emit()"
          title="Închide panoul"
        ></button>
      </div>

      <!-- Loading state -->
      <div class="loading-state" *ngIf="loading">
        <p-progressSpinner strokeWidth="4" animationDuration=".8s"></p-progressSpinner>
        <p>Se încarcă traducerile paralele…</p>
      </div>

      <!-- Translations list -->
      <div class="translations-list" *ngIf="!loading && translations.length > 0">
        <div
          *ngFor="let t of translations"
          class="translation-card"
          [class.unavailable]="!t.available"
        >
          <div class="translation-header">
            <div class="translation-meta">
              <span class="translation-name">{{ t.translationName }}</span>
              <span class="translation-lang">{{ t.language }}</span>
            </div>
            <span *ngIf="t.textDirection === 'rtl'" class="dir-badge rtl">RTL</span>
          </div>

          <div
            *ngIf="t.available"
            class="translation-verses"
            [attr.dir]="t.textDirection"
          >
            <div *ngFor="let verse of t.verses" class="verse-row">
              <span class="verse-num">{{ verse.number }}</span>
              <span class="verse-text">{{ verse.text }}</span>
            </div>
          </div>

          <div *ngIf="!t.available" class="not-available">
            <i class="pi pi-ban"></i>
            <span>N/A — verset indisponibil în această traducere</span>
          </div>
        </div>
      </div>

      <!-- Empty state (no verse selected yet) -->
      <div class="empty-state" *ngIf="!loading && translations.length === 0">
        <i class="pi pi-info-circle"></i>
        <p>Selectați un verset pentru a vedea traducerile paralele.</p>
      </div>
    </div>
  `,
  styles: [`
    .parallel-section {
      padding: 20px;
    }

    .parallel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 20px;
      padding: 14px;
      background: rgba(26, 35, 126, 0.4);
      border-radius: 8px;
      border: 1px solid rgba(121, 134, 203, 0.3);
    }

    .header-info {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      flex: 1;
    }

    .reference-icon {
      font-size: 1.8rem;
      color: var(--gold);
      margin-top: 2px;
    }

    .header-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .panel-title {
      color: var(--gold);
      margin: 0;
      font-size: 1.1rem;
    }

    .reference-badge {
      background: rgba(26, 35, 126, 0.8);
      color: var(--text-muted);
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      border: 1px solid rgba(121, 134, 203, 0.4);
      display: inline-block;
      white-space: nowrap;
    }

    :host ::ng-deep .close-btn.p-button {
      color: var(--text-muted) !important;
      width: 32px;
      height: 32px;
      padding: 0;
      flex-shrink: 0;
    }

    :host ::ng-deep .close-btn.p-button:hover {
      color: var(--text-light) !important;
      background: rgba(121, 134, 203, 0.15) !important;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 40px;
      color: var(--text-muted);
    }

    .translations-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .translation-card {
      border-radius: 8px;
      border: 1px solid rgba(121, 134, 203, 0.2);
      background: var(--bg-card);
      overflow: hidden;
    }

    .translation-card.unavailable {
      border-color: rgba(121, 134, 203, 0.1);
      opacity: 0.7;
    }

    .translation-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(26, 35, 126, 0.3);
      border-bottom: 1px solid rgba(121, 134, 203, 0.15);
    }

    .translation-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .translation-name {
      color: var(--text-light);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .translation-lang {
      color: var(--text-muted);
      font-size: 0.75rem;
      background: rgba(121, 134, 203, 0.15);
      padding: 2px 7px;
      border-radius: 10px;
      border: 1px solid rgba(121, 134, 203, 0.25);
    }

    .dir-badge {
      font-size: 0.7rem;
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 600;
    }

    .dir-badge.rtl {
      background: rgba(255, 193, 7, 0.15);
      color: #ffd54f;
      border: 1px solid rgba(255, 193, 7, 0.3);
    }

    .translation-verses {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .verse-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .verse-num {
      min-width: 22px;
      color: #7986cb;
      font-size: 0.75rem;
      font-weight: 600;
      padding-top: 2px;
      flex-shrink: 0;
    }

    .verse-text {
      color: #b0bec5;
      line-height: 1.7;
      font-size: 0.88rem;
    }

    .not-available {
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 0.85rem;
      font-style: italic;
    }

    .not-available i {
      color: rgba(121, 134, 203, 0.5);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 20px;
      color: var(--text-muted);
      font-style: italic;
      text-align: center;
    }

    .empty-state i {
      font-size: 2rem;
      opacity: 0.5;
    }
  `],
})
export class ParallelViewerComponent {
  @Input() translations: ParallelTranslation[] = [];
  @Input() loading = false;
  @Input() reference = '';

  @Output() close = new EventEmitter<void>();
}
