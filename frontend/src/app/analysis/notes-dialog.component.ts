import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { catchError, of } from 'rxjs';
import { NotesService, UserNote } from '../services/notes.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-notes-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    AccordionModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    TooltipModule,
  ],
  template: `
    <!-- Notes trigger button -->
    <p-button
      icon="pi pi-book"
      severity="secondary"
      [rounded]="true"
      [text]="true"
      pTooltip="Notițe personale pentru acest verset"
      tooltipPosition="left"
      (click)="open()"
      [disabled]="!verseReference()"
      styleClass="notes-trigger-btn"
    ></p-button>

    <!-- Notes dialog -->
    <p-dialog
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '520px', maxWidth: '95vw' }"
      header="Notițe personale"
    >
      <div class="notes-dialog-content">
        @if (verseReference()) {
          <p class="verse-ref-label">
            <i class="pi pi-map-marker"></i> {{ verseReference() }}
          </p>
        }

        <!-- Add new note -->
        <div class="add-note-section">
          <input
            pInputText
            type="text"
            [ngModel]="newNoteTitle()"
            (ngModelChange)="newNoteTitle.set($event)"
            placeholder="Titlu notiță (opțional)…"
            class="w-full note-title-input"
          />
          <textarea
            pTextarea
            [ngModel]="newNoteText()"
            (ngModelChange)="newNoteText.set($event)"
            placeholder="Scrie o notiță pentru acest verset…"
            rows="3"
            class="w-full"
            [autoResize]="true"
          ></textarea>
          <p-button
            label="Salvează"
            icon="pi pi-save"
            (click)="saveNote()"
            [loading]="saving()"
            [disabled]="!newNoteText().trim()"
            styleClass="save-note-btn"
          ></p-button>
        </div>

        <!-- Existing notes as accordion -->
        @if (notes().length > 0) {
          <div class="notes-section">
            <div class="notes-divider">
              <span>Notițele tale ({{ notes().length }})</span>
            </div>
            <p-accordion [multiple]="true" styleClass="notes-accordion">
              @for (note of notes(); track note.id) {
                <p-accordion-panel [value]="note.id.toString()">
                  <p-accordion-header>
                    <span class="note-header-content">
                      <span class="note-header-title">
                        {{ getNoteDisplayTitle(note) }}
                      </span>
                      <span class="note-header-date">{{ note.created_at | date: 'dd MMM yyyy' }}</span>
                    </span>
                  </p-accordion-header>
                  <p-accordion-content>
                    @if (editingNoteId() !== note.id) {
                      <div class="note-view">
                        <p class="note-text">{{ note.note_text }}</p>
                        <div class="note-actions">
                          <p-button
                            icon="pi pi-pencil"
                            severity="secondary"
                            [text]="true"
                            [rounded]="true"
                            pTooltip="Editează"
                            (click)="startEdit(note)"
                            styleClass="note-action-btn"
                          ></p-button>
                          <p-button
                            icon="pi pi-trash"
                            severity="danger"
                            [text]="true"
                            [rounded]="true"
                            pTooltip="Șterge"
                            (click)="deleteNote(note.id)"
                            styleClass="note-action-btn"
                          ></p-button>
                        </div>
                      </div>
                    } @else {
                      <div class="note-edit">
                        <input
                          pInputText
                          type="text"
                          [ngModel]="editNoteTitle()"
                          (ngModelChange)="editNoteTitle.set($event)"
                          placeholder="Titlu notiță (opțional)…"
                          class="w-full note-title-input"
                        />
                        <textarea
                          pTextarea
                          [ngModel]="editNoteText()"
                          (ngModelChange)="editNoteText.set($event)"
                          rows="3"
                          class="w-full"
                          [autoResize]="true"
                        ></textarea>
                        <div class="edit-actions">
                          <p-button
                            label="Salvează"
                            icon="pi pi-check"
                            (click)="saveEdit(note.id)"
                            [loading]="saving()"
                            [disabled]="!editNoteText().trim()"
                          ></p-button>
                          <p-button
                            label="Anulează"
                            icon="pi pi-times"
                            severity="secondary"
                            (click)="cancelEdit()"
                          ></p-button>
                        </div>
                      </div>
                    }
                  </p-accordion-content>
                </p-accordion-panel>
              }
            </p-accordion>
          </div>
        }

        @if (notes().length === 0 && !loadingNotes()) {
          <div class="empty-notes">
            <i class="pi pi-inbox"></i>
            <span>Nicio notiță pentru acest verset.</span>
          </div>
        }
      </div>
    </p-dialog>
  `,
  styles: [
    `
      :host ::ng-deep .notes-trigger-btn .p-button {
        color: var(--text-muted, #90a4ae);
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      :host ::ng-deep .notes-trigger-btn .p-button:hover {
        opacity: 1;
        color: var(--gold, #fdd835);
      }
      .notes-dialog-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .verse-ref-label {
        font-size: 0.85rem;
        color: var(--gold, #fdd835);
        margin: 0;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .add-note-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .note-title-input {
        font-size: 0.9rem;
      }
      :host ::ng-deep .save-note-btn {
        align-self: flex-end;
      }
      .notes-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .notes-divider {
        border-top: 1px solid rgba(121, 134, 203, 0.2);
        padding-top: 8px;
        font-size: 0.8rem;
        color: var(--text-muted, #90a4ae);
      }
      .note-header-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: 10px;
        overflow: hidden;
      }
      .note-header-title {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-light, #eceff1);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }
      .note-header-date {
        font-size: 0.75rem;
        color: var(--text-muted, #90a4ae);
        white-space: nowrap;
        flex-shrink: 0;
      }
      :host ::ng-deep .notes-accordion .p-accordionpanel {
        border: 1px solid rgba(121, 134, 203, 0.2);
        border-radius: 6px;
        margin-bottom: 6px;
        overflow: hidden;
        background: rgba(10, 10, 30, 0.4);
      }
      :host ::ng-deep .notes-accordion .p-accordionheader {
        background: rgba(26, 35, 126, 0.2);
        padding: 10px 14px;
        color: var(--text-light, #eceff1);
        border: none;
      }
      :host ::ng-deep .notes-accordion .p-accordionheader:hover {
        background: rgba(26, 35, 126, 0.35);
      }
      :host ::ng-deep .notes-accordion .p-accordioncontent-content {
        padding: 10px 14px;
        background: rgba(10, 10, 30, 0.3);
      }
      .note-view {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .note-text {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text-light, #eceff1);
        white-space: pre-wrap;
        line-height: 1.6;
      }
      .note-actions {
        display: flex;
        gap: 2px;
        justify-content: flex-end;
      }
      :host ::ng-deep .note-action-btn .p-button {
        width: 28px;
        height: 28px;
        padding: 0;
        font-size: 0.75rem;
      }
      .note-edit {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .edit-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .empty-notes {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 24px;
        color: var(--text-muted, #90a4ae);
        font-size: 0.85rem;
      }
      .empty-notes .pi {
        font-size: 1.5rem;
        opacity: 0.5;
      }
    `,
  ],
})
export class NotesDialogComponent {
  readonly verseReference = input('');

  private readonly notesService = inject(NotesService);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);

  readonly dialogVisible = signal(false);
  readonly notes = signal<UserNote[]>([]);
  readonly newNoteTitle = signal('');
  readonly newNoteText = signal('');
  readonly editingNoteId = signal<number | null>(null);
  readonly editNoteTitle = signal('');
  readonly editNoteText = signal('');
  readonly saving = signal(false);
  readonly loadingNotes = signal(false);

  constructor() {
    // Reload notes when verseReference changes while dialog is open
    effect(() => {
      const ref = this.verseReference();
      if (ref && this.dialogVisible()) {
        this.loadNotes();
      }
    });
  }

  /** Returns the title to display in the accordion header; falls back to a date-based label. */
  getNoteDisplayTitle(note: UserNote): string {
    if (note.note_title?.trim()) return note.note_title.trim();
    const date = new Date(note.created_at);
    return `Notiță din ${date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }

  open(): void {
    if (!this.authService.isLoggedIn()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Autentificare necesară',
        detail: 'Trebuie să fii autentificat pentru a adăuga notițe.',
        life: 4000,
      });
      return;
    }
    this.dialogVisible.set(true);
    this.loadNotes();
  }

  loadNotes(): void {
    if (!this.verseReference()) return;
    this.loadingNotes.set(true);
    this.notesService
      .getNotesForVerse(this.verseReference())
      .pipe(catchError(() => of([])))
      .subscribe((notes) => {
        this.notes.set(notes);
        this.loadingNotes.set(false);
      });
  }

  saveNote(): void {
    if (!this.newNoteText().trim()) return;
    this.saving.set(true);
    this.notesService
      .createNote(
        this.verseReference(),
        this.newNoteTitle().trim(),
        this.newNoteText().trim(),
      )
      .pipe(
        catchError(() => {
          this.messageService.add({
            severity: 'error',
            summary: 'Eroare',
            detail: 'Notița nu a putut fi salvată.',
            life: 3000,
          });
          this.saving.set(false);
          return of(null);
        }),
      )
      .subscribe((note) => {
        this.saving.set(false);
        if (note) {
          this.notes.update((ns) => [...ns, note]);
          this.newNoteTitle.set('');
          this.newNoteText.set('');
          this.messageService.add({
            severity: 'success',
            summary: 'Salvat',
            detail: 'Notița a fost salvată.',
            life: 2000,
          });
        }
      });
  }

  startEdit(note: UserNote): void {
    this.editingNoteId.set(note.id);
    this.editNoteTitle.set(note.note_title);
    this.editNoteText.set(note.note_text);
  }

  cancelEdit(): void {
    this.editingNoteId.set(null);
    this.editNoteTitle.set('');
    this.editNoteText.set('');
  }

  saveEdit(id: number): void {
    if (!this.editNoteText().trim()) return;
    this.saving.set(true);
    this.notesService
      .updateNote(id, this.editNoteTitle().trim(), this.editNoteText().trim())
      .pipe(
        catchError(() => {
          this.messageService.add({
            severity: 'error',
            summary: 'Eroare',
            detail: 'Notița nu a putut fi actualizată.',
            life: 3000,
          });
          this.saving.set(false);
          return of(null);
        }),
      )
      .subscribe((updated) => {
        this.saving.set(false);
        if (updated) {
          this.notes.update((ns) => ns.map((n) => (n.id === id ? updated : n)));
          this.cancelEdit();
        }
      });
  }

  deleteNote(id: number): void {
    this.notesService
      .deleteNote(id)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (res) {
          this.notes.update((ns) => ns.filter((n) => n.id !== id));
          this.messageService.add({
            severity: 'success',
            summary: 'Șters',
            detail: 'Notița a fost ștearsă.',
            life: 2000,
          });
        }
      });
  }
}
