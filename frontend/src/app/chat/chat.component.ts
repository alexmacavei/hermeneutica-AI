import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { catchError, of } from 'rxjs';
import { ChatMessage, ChatService } from '../services/chat.service';

/** Maximum number of previous messages sent to the AI as conversation context. */
const MAX_HISTORY_MESSAGES = 40;

@Component({
  selector: 'app-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonModule, InputTextModule],
  template: `
    <div class="chat-container">
      <div class="chat-header">
        <p-button
          icon="pi pi-arrow-left"
          class="back-btn"
          [text]="true"
          pTooltip="Înapoi la vizualizarea biblică"
          tooltipPosition="bottom"
          (click)="close.emit()"
        ></p-button>
        <i class="pi pi-comments chat-icon"></i>
        <span class="chat-title">Chat Teologic</span>
        <span class="chat-subtitle">Asistent bazat pe patrologie și Sfânta Scriptură</span>
      </div>

      <div class="messages-area" #messagesArea>
        @if (messages().length === 0) {
          <div class="welcome-message">
            <div class="welcome-icon">✝</div>
            <p class="welcome-text">
              Bun venit! Pot să vă ajut cu întrebări despre Sfânta Scriptură, 
              comentariile Sfinților Părinți și hermeneutica ortodoxă.
            </p>
            <div class="suggestion-chips">
              <button class="chip" (click)="sendSuggestion('Ce înseamnă Ioan 3:16 în tradiția patristică?')">
                Ioan 3:16 patristic
              </button>
              <button class="chip" (click)="sendSuggestion('Explică sensurile hermeneutice ale Psalmului 22')">
                Psalmul 22 hermeneutic
              </button>
              <button class="chip" (click)="sendSuggestion('Cine sunt Sfinții Părinți principali ai Bisericii Ortodoxe?')">
                Sfinții Părinți
              </button>
            </div>
          </div>
        }

        @for (msg of messages(); track $index) {
          <div class="message" [class.user-message]="msg.role === 'user'" [class.assistant-message]="msg.role === 'assistant'">
            @if (msg.role === 'assistant') {
              <div class="message-avatar">✝</div>
            }
            <div class="message-bubble">
              <p class="message-content">{{ msg.content }}</p>
            </div>
            @if (msg.role === 'user') {
              <div class="message-avatar user-avatar">
                <i class="pi pi-user"></i>
              </div>
            }
          </div>
        }

        @if (loading()) {
          <div class="message assistant-message">
            <div class="message-avatar">✝</div>
            <div class="message-bubble typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        }
      </div>

      <div class="input-area">
        <input
          pInputText
          class="chat-input"
          type="text"
          [ngModel]="inputText()"
          (ngModelChange)="inputText.set($event)"
          placeholder="Adresați o întrebare teologică…"
          (keydown.enter)="send()"
          [disabled]="loading()"
        />
        <p-button
          icon="pi pi-send"
          class="send-btn"
          [disabled]="!inputText().trim() || loading()"
          [loading]="loading()"
          (click)="send()"
        ></p-button>
      </div>

      @if (errorMsg()) {
        <div class="error-bar">
          <i class="pi pi-exclamation-circle"></i> {{ errorMsg() }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-dark, #0d0d1a);
        color: var(--text-light, #eceff1);
      }

      .chat-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border-bottom: 1px solid rgba(121, 134, 203, 0.2);
        background: rgba(26, 35, 126, 0.1);
        flex-shrink: 0;
      }

      :host ::ng-deep .back-btn .p-button {
        color: var(--text-muted, #9fa8da);
        padding: 4px 6px;
        border-radius: 6px;
        transition: color 0.2s, background 0.2s;
      }

      :host ::ng-deep .back-btn .p-button:hover {
        color: var(--text-light, #eceff1);
        background: rgba(121, 134, 203, 0.15);
      }

      .chat-icon {
        font-size: 1.2rem;
        color: var(--gold, #fdd835);
      }

      .chat-title {
        font-family: 'Palatino Linotype', serif;
        font-size: 1.05rem;
        font-weight: 600;
        color: var(--text-light, #e8eaf6);
      }

      .chat-subtitle {
        font-size: 0.78rem;
        color: var(--text-muted, #9fa8da);
        margin-left: 4px;
      }

      .messages-area {
        flex: 1;
        overflow-y: auto;
        padding: 20px 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .messages-area::-webkit-scrollbar {
        width: 4px;
      }

      .messages-area::-webkit-scrollbar-track {
        background: transparent;
      }

      .messages-area::-webkit-scrollbar-thumb {
        background: rgba(121, 134, 203, 0.3);
        border-radius: 2px;
      }

      .welcome-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        padding: 40px 20px;
        text-align: center;
        gap: 16px;
      }

      .welcome-icon {
        font-size: 2.5rem;
        color: var(--gold, #fdd835);
        opacity: 0.7;
        line-height: 1;
      }

      .welcome-text {
        color: var(--text-muted, #9fa8da);
        font-size: 0.95rem;
        max-width: 480px;
        line-height: 1.6;
        margin: 0;
        font-style: italic;
      }

      .suggestion-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        margin-top: 8px;
      }

      .chip {
        background: rgba(26, 35, 126, 0.3);
        border: 1px solid rgba(121, 134, 203, 0.35);
        color: var(--text-muted, #9fa8da);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 0.8rem;
        cursor: pointer;
        transition: background 0.2s, color 0.2s, border-color 0.2s;
      }

      .chip:hover {
        background: rgba(26, 35, 126, 0.55);
        color: var(--text-light, #e8eaf6);
        border-color: rgba(121, 134, 203, 0.6);
      }

      .message {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        max-width: 85%;
      }

      .user-message {
        align-self: flex-end;
        flex-direction: row-reverse;
      }

      .assistant-message {
        align-self: flex-start;
      }

      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 1rem;
        background: rgba(26, 35, 126, 0.5);
        border: 1px solid rgba(121, 134, 203, 0.4);
        color: var(--gold, #fdd835);
      }

      .user-avatar {
        background: rgba(198, 40, 40, 0.3);
        border-color: rgba(198, 40, 40, 0.4);
        color: var(--text-muted, #9fa8da);
        font-size: 0.8rem;
      }

      .message-bubble {
        padding: 10px 14px;
        border-radius: 12px;
        line-height: 1.6;
        font-size: 0.9rem;
      }

      .user-message .message-bubble {
        background: rgba(198, 40, 40, 0.2);
        border: 1px solid rgba(198, 40, 40, 0.3);
        border-bottom-right-radius: 4px;
        color: var(--text-light, #eceff1);
      }

      .assistant-message .message-bubble {
        background: rgba(26, 35, 126, 0.25);
        border: 1px solid rgba(121, 134, 203, 0.25);
        border-bottom-left-radius: 4px;
        color: var(--text-light, #eceff1);
      }

      .message-content {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }

      /* Typing indicator dots */
      .typing-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 12px 16px;
        min-height: 42px;
      }

      .typing-indicator span {
        width: 7px;
        height: 7px;
        background: rgba(121, 134, 203, 0.6);
        border-radius: 50%;
        animation: typing-bounce 1.2s infinite;
      }

      .typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typing-bounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
        30% { transform: translateY(-5px); opacity: 1; }
      }

      .input-area {
        display: flex;
        gap: 10px;
        padding: 14px 16px;
        border-top: 1px solid rgba(121, 134, 203, 0.2);
        background: rgba(13, 13, 26, 0.8);
        flex-shrink: 0;
      }

      .chat-input {
        flex: 1;
        background: rgba(13, 13, 26, 0.9) !important;
        border: 1px solid rgba(121, 134, 203, 0.35) !important;
        color: var(--text-light, #eceff1) !important;
        border-radius: 8px !important;
        padding: 10px 14px !important;
        font-size: 0.9rem;
        outline: none !important;
        transition: border-color 0.2s !important;
      }

      .chat-input::placeholder {
        color: var(--text-muted, #9fa8da);
        opacity: 0.8;
      }

      .chat-input:focus {
        border-color: rgba(121, 134, 203, 0.6) !important;
        box-shadow: 0 0 0 2px rgba(121, 134, 203, 0.15) !important;
      }

      :host ::ng-deep .send-btn .p-button {
        background: var(--cross-red, #c62828);
        border-color: var(--cross-red, #c62828);
        color: #fff;
        border-radius: 8px;
        width: 42px;
        height: 42px;
        padding: 0;
        justify-content: center;
      }

      :host ::ng-deep .send-btn .p-button:not(:disabled):hover {
        background: #b71c1c;
        border-color: #b71c1c;
      }

      :host ::ng-deep .send-btn .p-button:disabled {
        opacity: 0.4;
      }

      .error-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: rgba(198, 40, 40, 0.1);
        border-top: 1px solid rgba(198, 40, 40, 0.3);
        color: #ef9a9a;
        font-size: 0.85rem;
        flex-shrink: 0;
      }

      @media (max-width: 768px) {
        .message {
          max-width: 95%;
        }
        .chat-subtitle {
          display: none;
        }
      }
    `,
  ],
})
export class ChatComponent implements AfterViewChecked {
  readonly close = output<void>();

  private readonly chatService = inject(ChatService);
  private readonly messagesArea = viewChild<ElementRef<HTMLDivElement>>('messagesArea');

  readonly messages = signal<ChatMessage[]>([]);
  readonly inputText = signal('');
  readonly loading = signal(false);
  readonly errorMsg = signal('');

  private shouldScroll = false;

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  sendSuggestion(text: string): void {
    this.inputText.set(text);
    this.send();
  }

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.loading()) return;

    this.errorMsg.set('');
    this.inputText.set('');

    // Add user message to history
    this.messages.update((msgs) => [...msgs, { role: 'user', content: text }]);
    this.shouldScroll = true;
    this.loading.set(true);

    // Send all previous messages (before the new one) as history context
    const history = this.messages().slice(-MAX_HISTORY_MESSAGES, -1);

    this.chatService
      .sendMessage(text, history)
      .pipe(
        catchError((err) => {
          const msg =
            err?.error?.message ?? 'A apărut o eroare. Vă rugăm să încercați din nou.';
          this.errorMsg.set(Array.isArray(msg) ? msg.join(', ') : String(msg));
          return of({ reply: '' });
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res.reply) {
          this.messages.update((msgs) => [...msgs, { role: 'assistant', content: res.reply }]);
          this.shouldScroll = true;
        }
      });
  }

  private scrollToBottom(): void {
    const el = this.messagesArea()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
