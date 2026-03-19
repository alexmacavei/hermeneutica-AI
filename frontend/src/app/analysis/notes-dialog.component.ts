import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { catchError, of } from 'rxjs';
import { NotesService, UserNote } from '../services/notes.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-notes-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
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
      [disabled]="!verseReference"
      styleClass="notes-trigger-btn"
    ></p-button>

    <!-- Notes dialog -->
    <p-dialog
      [(visible)]="dialogVisible"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '480px', maxWidth: '95vw' }"
      header="Notițe personale"
    >
      <div class="notes-dialog-content">
        <p class="verse-ref-label" *ngIf="verseReference">
          <i class="pi pi-map-marker"></i> {{ verseReference }}
        </p>

        <!-- Add new note -->
        <div class="add-note-section">
          <textarea
            pTextarea
            [(ngModel)]="newNoteText"
            placeholder="Scrie o notiță pentru acest verset…"
            rows="3"
            class="w-full"
            [autoResize]="true"
          ></textarea>
          <p-button
            label="Salvează"
            icon="pi pi-save"
            (click)="saveNote()"
            [loading]="saving"
            [disabled]="!newNoteText.trim()"
            styleClass="save-note-btn"
          ></p-button>
        </div>

        <!-- Existing notes -->
        <div class="notes-list" *ngIf="notes.length > 0">
          <div class="notes-divider">
            <span>Notițele tale ({{ notes.length }})</span>
          </div>
          <div *ngFor="let note of notes" class="note-item">
            <div *ngIf="editingNoteId !== note.id" class="note-view">
              <p class="note-text">{{ note.note_text }}</p>
              <div class="note-meta">
                <span class="note-date">{{ note.created_at | date: 'dd MMM yyyy, HH:mm' }}</span>
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
            </div>
            <div *ngIf="editingNoteId === note.id" class="note-edit">
              <textarea
                pTextarea
                [(ngModel)]="editNoteText"
                rows="3"
                class="w-full"
                [autoResize]="true"
              ></textarea>
              <div class="edit-actions">
                <p-button
                  label="Salvează"
                  icon="pi pi-check"
                  (click)="saveEdit(note.id)"
                  [loading]="saving"
                  [disabled]="!editNoteText.trim()"
                ></p-button>
                <p-button
                  label="Anulează"
                  icon="pi pi-times"
                  severity="secondary"
                  (click)="cancelEdit()"
                ></p-button>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-notes" *ngIf="notes.length === 0 && !loadingNotes">
          <i class="pi pi-inbox"></i>
          <span>Nicio notiță pentru acest verset.</span>
        </div>
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
      :host ::ng-deep .save-note-btn {
        align-self: flex-end;
      }
      .notes-divider {
        border-top: 1px solid rgba(121, 134, 203, 0.2);
        padding-top: 8px;
        font-size: 0.8rem;
        color: var(--text-muted, #90a4ae);
        margin-top: 4px;
      }
      .notes-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .note-item {
        background: rgba(26, 35, 126, 0.15);
        border: 1px solid rgba(121, 134, 203, 0.15);
        border-radius: 6px;
        padding: 10px 12px;
      }
      .note-view {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .note-text {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text-light, #eceff1);
        white-space: pre-wrap;
        line-height: 1.5;
      }
      .note-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .note-date {
        font-size: 0.75rem;
        color: var(--text-muted, #90a4ae);
      }
      .note-actions {
        display: flex;
        gap: 2px;
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
export class NotesDialogComponent implements OnChanges {
  @Input() verseReference = '';

  dialogVisible = false;
  notes: UserNote[] = [];
  newNoteText = '';
  editingNoteId: number | null = null;
  editNoteText = '';
  saving = false;
  loadingNotes = false;

  constructor(
    private readonly notesService: NotesService,
    private readonly authService: AuthService,
    private readonly messageService: MessageService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['verseReference'] && this.dialogVisible) {
      this.loadNotes();
    }
  }

  open(): void {
    if (!this.authService.isLoggedIn) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Autentificare necesară',
        detail: 'Trebuie să fii autentificat pentru a adăuga notițe.',
        life: 4000,
      });
      return;
    }
    this.dialogVisible = true;
    this.loadNotes();
  }

  loadNotes(): void {
    if (!this.verseReference) return;
    this.loadingNotes = true;
    this.notesService
      .getNotesForVerse(this.verseReference)
      .pipe(catchError(() => of([])))
      .subscribe((notes) => {
        this.notes = notes;
        this.loadingNotes = false;
      });
  }

  saveNote(): void {
    if (!this.newNoteText.trim()) return;
    this.saving = true;
    this.notesService
      .createNote(this.verseReference, this.newNoteText.trim())
      .pipe(
        catchError(() => {
          this.messageService.add({
            severity: 'error',
            summary: 'Eroare',
            detail: 'Notița nu a putut fi salvată.',
            life: 3000,
          });
          this.saving = false;
          return of(null);
        }),
      )
      .subscribe((note) => {
        this.saving = false;
        if (note) {
          this.notes.push(note);
          this.newNoteText = '';
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
    this.editingNoteId = note.id;
    this.editNoteText = note.note_text;
  }

  cancelEdit(): void {
    this.editingNoteId = null;
    this.editNoteText = '';
  }

  saveEdit(id: number): void {
    if (!this.editNoteText.trim()) return;
    this.saving = true;
    this.notesService
      .updateNote(id, this.editNoteText.trim())
      .pipe(
        catchError(() => {
          this.messageService.add({
            severity: 'error',
            summary: 'Eroare',
            detail: 'Notița nu a putut fi actualizată.',
            life: 3000,
          });
          this.saving = false;
          return of(null);
        }),
      )
      .subscribe((updated) => {
        this.saving = false;
        if (updated) {
          const idx = this.notes.findIndex((n) => n.id === id);
          if (idx !== -1) this.notes[idx] = updated;
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
          this.notes = this.notes.filter((n) => n.id !== id);
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
