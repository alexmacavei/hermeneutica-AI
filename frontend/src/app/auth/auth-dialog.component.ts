import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
  ],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '380px' }"
      [header]="currentMode() === 'login' ? 'Autentificare' : 'Creare cont'"
    >
      <div class="auth-form">
        <div class="field">
          <label class="field-label">Email</label>
          <input
            pInputText
            type="email"
            [ngModel]="email()"
            (ngModelChange)="email.set($event)"
            placeholder="adresa@email.com"
            class="w-full"
            autocomplete="email"
          />
        </div>

        <div class="field">
          <label class="field-label">Parolă</label>
          <p-password
            [ngModel]="password()"
            (ngModelChange)="password.set($event)"
            [feedback]="currentMode() === 'register'"
            [toggleMask]="true"
            placeholder="Parolă (min. 6 caractere)"
            styleClass="w-full"
            inputStyleClass="w-full"
            [autocomplete]="currentMode() === 'login' ? 'current-password' : 'new-password'"
          ></p-password>
        </div>

        @if (errorMsg()) {
          <p-message
            severity="error"
            [text]="errorMsg()"
            styleClass="w-full mb-2"
          ></p-message>
        }

        <p-button
          [label]="currentMode() === 'login' ? 'Intră în cont' : 'Creează cont'"
          [loading]="loading()"
          (click)="submit()"
          styleClass="w-full"
          [style]="{ marginTop: '8px' }"
        ></p-button>

        <div class="switch-mode">
          @if (currentMode() === 'login') {
            <span>
              Nu ai cont?
              <a href="#" (click)="switchMode($event)">Înregistrează-te</a>
            </span>
          } @else {
            <span>
              Ai deja cont?
              <a href="#" (click)="switchMode($event)">Autentifică-te</a>
            </span>
          }
        </div>
      </div>
    </p-dialog>
  `,
  styles: [
    `
      :host ::ng-deep .p-dialog {
        background: #12122a;
        border: 1px solid rgba(121, 134, 203, 0.35);
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      }
      :host ::ng-deep .p-dialog .p-dialog-header {
        background: #12122a;
        color: var(--text-light, #e8eaf6);
        border-bottom: 1px solid rgba(121, 134, 203, 0.2);
        padding: 16px 20px 14px;
        border-radius: 10px 10px 0 0;
      }
      :host ::ng-deep .p-dialog .p-dialog-header .p-dialog-title {
        color: var(--text-light, #e8eaf6);
        font-family: 'Palatino Linotype', serif;
        font-size: 1.1rem;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      :host ::ng-deep .p-dialog .p-dialog-header .p-dialog-header-icon {
        color: var(--text-muted, #9fa8da);
      }
      :host ::ng-deep .p-dialog .p-dialog-header .p-dialog-header-icon:hover {
        color: var(--text-light, #e8eaf6);
        background: rgba(121, 134, 203, 0.15);
      }
      :host ::ng-deep .p-dialog .p-dialog-content {
        background: #1a1a2e;
        color: var(--text-light, #e8eaf6);
        padding: 20px;
        border-radius: 0 0 10px 10px;
      }
      :host ::ng-deep .p-dialog .p-dialog-content .p-inputtext {
        background: #0d0d1a;
        border-color: rgba(121, 134, 203, 0.35);
        color: var(--text-light, #e8eaf6);
      }
      :host ::ng-deep .p-dialog .p-dialog-content .p-inputtext:focus {
        border-color: rgba(121, 134, 203, 0.7);
        box-shadow: 0 0 0 2px rgba(121, 134, 203, 0.2);
      }
      :host ::ng-deep .p-dialog .p-dialog-content .p-password-input {
        background: #0d0d1a;
        border-color: rgba(121, 134, 203, 0.35);
        color: var(--text-light, #e8eaf6);
      }
      :host ::ng-deep .p-dialog .p-dialog-content .p-password .p-password-toggle-mask-icon {
        color: var(--text-muted, #9fa8da);
      }
      :host ::ng-deep .p-dialog-mask {
        background: rgba(0, 0, 0, 0.65) !important;
      }
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
  readonly visible = model(false);
  readonly initialMode = input<'login' | 'register'>('login', { alias: 'mode' });
  readonly success = output<void>();

  private readonly authService = inject(AuthService);

  readonly currentMode = signal<'login' | 'register'>('login');
  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly errorMsg = signal('');

  constructor() {
    // Sync local currentMode when the input changes (e.g. parent opens login vs register)
    effect(() => {
      this.currentMode.set(this.initialMode());
    });
  }

  switchMode(event: Event): void {
    event.preventDefault();
    this.errorMsg.set('');
    this.currentMode.update((m) => (m === 'login' ? 'register' : 'login'));
  }

  submit(): void {
    this.errorMsg.set('');
    if (!this.email() || !this.password()) {
      this.errorMsg.set('Completează email și parolă.');
      return;
    }
    this.loading.set(true);
    const obs =
      this.currentMode() === 'login'
        ? this.authService.login(this.email(), this.password())
        : this.authService.register(this.email(), this.password());

    obs
      .pipe(
        catchError((err) => {
          const msg =
            err?.error?.message ??
            (this.currentMode() === 'login'
              ? 'Date incorecte. Verifică email și parolă.'
              : 'Înregistrare eșuată. Email-ul poate fi deja folosit.');
          this.errorMsg.set(Array.isArray(msg) ? msg.join(', ') : String(msg));
          this.loading.set(false);
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res) {
          this.email.set('');
          this.password.set('');
          this.visible.set(false);
          this.success.emit();
        }
      });
  }
}
