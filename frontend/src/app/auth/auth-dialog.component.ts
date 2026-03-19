import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
  ],
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="visibleChange.emit($event)"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '380px' }"
      [header]="mode === 'login' ? 'Autentificare' : 'Creare cont'"
    >
      <div class="auth-form">
        <div class="field">
          <label class="field-label">Email</label>
          <input
            pInputText
            type="email"
            [(ngModel)]="email"
            placeholder="adresa@email.com"
            class="w-full"
            autocomplete="email"
          />
        </div>

        <div class="field">
          <label class="field-label">Parolă</label>
          <p-password
            [(ngModel)]="password"
            [feedback]="mode === 'register'"
            [toggleMask]="true"
            placeholder="Parolă (min. 6 caractere)"
            styleClass="w-full"
            inputStyleClass="w-full"
            [autocomplete]="mode === 'login' ? 'current-password' : 'new-password'"
          ></p-password>
        </div>

        <p-message
          *ngIf="errorMsg"
          severity="error"
          [text]="errorMsg"
          styleClass="w-full mb-2"
        ></p-message>

        <p-button
          [label]="mode === 'login' ? 'Intră în cont' : 'Creează cont'"
          [loading]="loading"
          (click)="submit()"
          styleClass="w-full"
          [style]="{ marginTop: '8px' }"
        ></p-button>

        <div class="switch-mode">
          <span *ngIf="mode === 'login'">
            Nu ai cont?
            <a href="#" (click)="switchMode($event)">Înregistrează-te</a>
          </span>
          <span *ngIf="mode === 'register'">
            Ai deja cont?
            <a href="#" (click)="switchMode($event)">Autentifică-te</a>
          </span>
        </div>
      </div>
    </p-dialog>
  `,
  styles: [
    `
      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 4px 0;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field-label {
        font-size: 0.85rem;
        color: var(--text-muted, #90a4ae);
        font-weight: 500;
      }
      .switch-mode {
        text-align: center;
        font-size: 0.85rem;
        color: var(--text-muted, #90a4ae);
        margin-top: 4px;
      }
      .switch-mode a {
        color: var(--gold, #fdd835);
        text-decoration: none;
        margin-left: 4px;
      }
      .switch-mode a:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class AuthDialogComponent {
  @Input() visible = false;
  @Input() mode: 'login' | 'register' = 'login';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() success = new EventEmitter<void>();

  email = '';
  password = '';
  loading = false;
  errorMsg = '';

  constructor(private readonly authService: AuthService) {}

  switchMode(event: Event): void {
    event.preventDefault();
    this.errorMsg = '';
    this.mode = this.mode === 'login' ? 'register' : 'login';
  }

  submit(): void {
    this.errorMsg = '';
    if (!this.email || !this.password) {
      this.errorMsg = 'Completează email și parolă.';
      return;
    }
    this.loading = true;
    const obs =
      this.mode === 'login'
        ? this.authService.login(this.email, this.password)
        : this.authService.register(this.email, this.password);

    obs
      .pipe(
        catchError((err) => {
          const msg =
            err?.error?.message ??
            (this.mode === 'login'
              ? 'Date incorecte. Verifică email și parolă.'
              : 'Înregistrare eșuată. Email-ul poate fi deja folosit.');
          this.errorMsg = Array.isArray(msg) ? msg.join(', ') : String(msg);
          this.loading = false;
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.loading = false;
        if (res) {
          this.email = '';
          this.password = '';
          this.visibleChange.emit(false);
          this.success.emit();
        }
      });
  }
}
