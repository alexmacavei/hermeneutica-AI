import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MenuItem, MessageService } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { BibleStore } from './bible.store';
import { BibleSelectorComponent } from './bible-selector.component';
import { BibleTextComponent } from './bible-text.component';
import { ResultsViewerComponent } from '../analysis/results-viewer.component';
import { SemanticSearchComponent } from './semantic-search.component';
import { ParallelViewerComponent } from './parallel-viewer.component';
import { AuthDialogComponent } from '../auth/auth-dialog.component';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { SlicePipe } from '@angular/common';
import { ChatComponent } from '../chat/chat.component';

@Component({
  selector: 'app-bible-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarModule,
    ButtonModule,
    MenuModule,
    ToastModule,
    TooltipModule,
    BibleSelectorComponent,
    BibleTextComponent,
    ResultsViewerComponent,
    SemanticSearchComponent,
    ParallelViewerComponent,
    AuthDialogComponent,
    SlicePipe,
    ChatComponent,
  ],
  providers: [BibleStore, MessageService],
  template: `
    <p-toast position="top-right"></p-toast>

    <!-- Auth Dialog -->
    <app-auth-dialog
      [(visible)]="authDialogVisible"
      [mode]="authDialogMode()"
    ></app-auth-dialog>

    <!-- Auth dropdown menu -->
    <p-menu #authMenu [model]="authMenuItems()" [popup]="true" appendTo="body"></p-menu>

    <div class="viewer-shell">
      <!-- Navbar -->
      <header class="top-bar">
        <div class="brand">
          <!-- Orthodox three-bar cross (suppedaneum tilted: right side up, left side down) -->
          <svg class="brand-cross" viewBox="0 0 100 135" aria-hidden="true">
            <rect x="43" y="0" width="14" height="135"/>
            <rect x="30" y="13" width="40" height="13"/>
            <rect x="2" y="48" width="96" height="15"/>
            <polygon points="21,107 79,94 79,108 21,121"/>
          </svg>
          <span class="brand-title">AI Hermeneutica Orthodoxa</span>
        </div>
        <app-bible-selector
          (navigate)="store.navigate($event)"
        ></app-bible-selector>
        <app-semantic-search
          style="flex: 2"
          [translationId]="store.currentNav()?.translationId ?? ''"
          (navigateTo)="store.navigateFromSearch($event)"
        ></app-semantic-search>

        <!-- Auth area – single dropdown button -->
        <div class="auth-area">
          <!-- Theme toggle -->
          <p-button
            [icon]="themeService.theme() === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"
            [pTooltip]="themeService.theme() === 'dark' ? 'Comută la modul luminos' : 'Comută la modul întunecat'"
            tooltipPosition="bottom"
            severity="secondary"
            [text]="true"
            class="theme-toggle-btn"
            (click)="themeService.toggleTheme()"
          ></p-button>
          @if (authService.isLoggedIn()) {
            <p-button
              icon="pi pi-comments"
              label="Chat"
              severity="secondary"
              [text]="true"
              [class.chat-btn-active]="showChat()"
              class="chat-nav-btn"
              pTooltip="Chat teologic cu IA"
              tooltipPosition="bottom"
              (click)="toggleChat()"
            ></p-button>
          }
          @if (!authService.currentUser()) {
            <p-button
              icon="pi pi-user"
              label="Cont"
              severity="secondary"
              [text]="true"
              class="auth-menu-btn"
              (click)="toggleAuthMenu($event)"
            ></p-button>
          } @else {
            <div
              class="user-avatar-area"
              (click)="toggleAuthMenu($event)"
            >
              <p-avatar
                [label]="authService.currentUser()!.email[0].toUpperCase()"
                shape="circle"
                styleClass="user-avatar"
                pTooltip="{{ authService.currentUser()!.email }}"
                tooltipPosition="bottom"
              ></p-avatar>
              <i class="pi pi-angle-down avatar-caret"></i>
            </div>
          }
        </div>
      </header>

      <!-- Main Layout -->
      @if (showChat()) {
        <!-- Chat Page (replaces main layout for logged-in users) -->
        <main class="chat-page">
          <app-chat (close)="showChat.set(false)"></app-chat>
        </main>
      } @else {
      <main class="main-layout">
        <!-- Bible Text Panel -->
        <section class="bible-panel">
          @if (store.loadingChapter()) {
            <div class="loading-chapter">
              <i class="pi pi-spin pi-spinner"></i> Se încarcă...
            </div>
          }

          @if (!store.loadingChapter()) {
            <app-bible-text
              [bookName]="store.currentNav()?.bookName ?? ''"
              [chapterNumber]="store.currentNav()?.chapter?.toString() ?? ''"
              [verses]="store.currentVerses()"
              [selectedVerses]="store.selectedVerseNumbers()"
              (verseSelected)="store.selectVerse($event)"
            ></app-bible-text>
          }

          <!-- Footer navigation -->
          <footer class="verse-footer">
            <p-button
              icon="pi pi-chevron-left"
              variant="text"
              class="nav-btn"
              (click)="store.prevChapter()"
              [disabled]="!store.hasPrevChapter()"
              [rounded]="true"
            ></p-button>
            @if (store.selectedSelection()) {
              <span class="footer-ref">
                &#128204; {{ store.selectedSelection()!.range }}
              </span>
            } @else {
              <span class="footer-ref no-selection">
                Selectează un verset pentru analiză
              </span>
            }
            <p-button
              icon="pi pi-chevron-right"
              variant="text"
              class="nav-btn"
              (click)="store.nextChapter()"
              [disabled]="!store.hasNextChapter()"
              [rounded]="true"
            ></p-button>
          </footer>
        </section>

        <!-- Analysis Panel -->
        @if (store.analysisResult() || store.analyzing()) {
          <aside class="analysis-panel">
            <app-results-viewer
              [result]="store.analysisResult()"
              [loading]="store.analyzing()"
            ></app-results-viewer>
          </aside>
        }

        <!-- Parallel Study Panel -->
        @if (store.showParallelView()) {
          <aside class="parallel-panel">
            <app-parallel-viewer
              [translations]="store.parallelVerses()"
              [loading]="store.loadingParallel()"
              [reference]="store.selectedSelection()?.range ?? ''"
              (close)="store.closeParallelView()"
            ></app-parallel-viewer>
          </aside>
        }
      </main>

      <!-- Big Analyze Button -->
      <div class="analyze-bar">
        @if (authService.isLoggedIn()) {
          <p-button
            class="analyze-btn"
            [class.analyze-btn-pulse]="!!store.selectedSelection() && !store.analyzing()"
            [disabled]="!store.selectedSelection() || store.analyzing()"
            [loading]="store.analyzing()"
            (click)="store.analyze()"
            icon="pi pi-search"
            label="Analizează selecția"
          >
          </p-button>
        } @else {
          <span class="login-prompt">
            <i class="pi pi-lock"></i>
            Autentifică-te pentru a analiza versete.
            <a href="#" (click)="openAuthFromPrompt($event, 'login')">Login</a>
            sau
            <a href="#" (click)="openAuthFromPrompt($event, 'register')">Înregistrare</a>
          </span>
        }

        <p-button
          label="Studiu Paralel"
          icon="pi pi-book"
          iconPos="left"
          class="parallel-btn"
          [class.parallel-btn-active]="store.showParallelView()"
          [disabled]="!store.selectedSelection()"
          [loading]="store.loadingParallel()"
          (click)="store.toggleParallelView()"
        ></p-button>

        @if (store.selectedSelection()) {
          <span class="selection-preview">
            "{{ store.selectedSelection()!.text | slice: 0 : 60
            }}{{ store.selectedSelection()!.text.length > 60 ? '…' : '' }}" —
            <em>{{ store.selectedSelection()!.range }}</em>
          </span>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      .viewer-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--bg-dark);
      }
      .top-bar {
        background: var(--navbar-bg);
        border-bottom: 2px solid rgba(26, 35, 126, 0.6);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }
      .brand {
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 10px;
        white-space: nowrap;
      }
      .brand-cross {
        color: var(--gold);
        fill: var(--gold);
        width: 1.4rem;
        height: 1.9rem;
        flex-shrink: 0;
      }
      .brand-title {
        color: var(--text-light);
        font-size: 1.1rem;
        font-weight: 500;
        font-family: 'Palatino Linotype', serif;
      }
      .main-layout {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      .chat-page {
        flex: 1;
        display: flex;
        overflow: hidden;
        max-height: calc(100vh - 60px);
      }
      .bible-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        max-height: calc(100vh - 160px);
      }
      .analysis-panel {
        width: 40%;
        min-width: 320px;
        border-left: 1px solid rgba(121, 134, 203, 0.2);
        overflow-y: auto;
        max-height: calc(100vh - 160px);
        background: var(--panel-bg);
      }
      .parallel-panel {
        width: 40%;
        min-width: 320px;
        border-left: 1px solid rgba(121, 134, 203, 0.2);
        overflow-y: auto;
        max-height: calc(100vh - 160px);
        background: var(--panel-bg);
      }
      .loading-chapter {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 60px;
        color: var(--text-muted);
        font-size: 1rem;
      }
      .verse-footer {
        padding: 10px 24px;
        background: var(--navbar-bg);
        border-top: 1px solid rgba(26, 35, 126, 0.4);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .footer-ref {
        color: var(--text-muted);
        font-size: 0.85rem;
      }
      .no-selection {
        font-style: italic;
        opacity: 0.6;
      }
      :host ::ng-deep .nav-btn .p-button {
        color: var(--text-muted) !important;
      }
      .analyze-bar {
        padding: 14px 24px;
        background: var(--navbar-bg);
        border-top: 2px solid rgba(198, 40, 40, 0.4);
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
      }
      :host ::ng-deep .analyze-btn .p-button {
        background: var(--cross-red);
        border-color: var(--cross-red);
        color: white;
        font-size: 1rem;
        font-weight: 600;
        padding: 10px 28px;
        border-radius: 24px;
        height: 46px;
        gap: 0.5rem;
      }
      :host ::ng-deep .analyze-btn .p-button:not(:disabled):hover {
        background: #b71c1c;
        border-color: #b71c1c;
      }
      :host ::ng-deep .analyze-btn .p-button:disabled {
        background: rgba(198, 40, 40, 0.3);
        border-color: rgba(198, 40, 40, 0.3);
        color: rgba(255, 255, 255, 0.4);
      }
      :host ::ng-deep .parallel-btn .p-button {
        background: rgba(26, 35, 126, 0.5);
        border: 1px solid rgba(121, 134, 203, 0.5);
        color: #9fa8da;
        font-size: 1rem;
        font-weight: 600;
        padding: 10px 22px;
        border-radius: 24px;
        height: 46px;
        gap: 0.5rem;
      }
      :host ::ng-deep .parallel-btn .p-button:not(:disabled):hover {
        background: rgba(26, 35, 126, 0.7);
        border-color: rgba(121, 134, 203, 0.8);
        color: #c5cae9;
      }
      :host ::ng-deep .parallel-btn.parallel-btn-active .p-button {
        background: rgba(26, 35, 126, 0.8);
        border-color: #7986cb;
        color: #e8eaf6;
      }
      :host ::ng-deep .parallel-btn .p-button:disabled {
        background: rgba(26, 35, 126, 0.2);
        border-color: rgba(121, 134, 203, 0.2);
        color: rgba(159, 168, 218, 0.4);
      }
      .selection-preview {
        color: var(--text-muted);
        font-style: italic;
        font-size: 0.9rem;
        flex: 1;
      }
      .login-prompt {
        color: var(--text-muted, #90a4ae);
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .login-prompt .pi-lock {
        color: rgba(198, 40, 40, 0.7);
      }
      .login-prompt a {
        color: var(--gold, #fdd835);
        text-decoration: none;
      }
      .login-prompt a:hover {
        text-decoration: underline;
      }
      .auth-area {
        margin-left: auto;
        padding-right: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      :host ::ng-deep .chat-nav-btn .p-button {
        color: var(--text-muted, #90a4ae);
        font-size: 0.9rem;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 20px;
        border: 1px solid rgba(121, 134, 203, 0.25);
        background: rgba(26, 35, 126, 0.2);
        transition: background 0.2s, border-color 0.2s, color 0.2s;
      }
      :host ::ng-deep .chat-nav-btn .p-button:hover {
        color: var(--text-light, #eceff1);
        background: rgba(26, 35, 126, 0.4);
        border-color: rgba(121, 134, 203, 0.5);
      }
      :host ::ng-deep .chat-nav-btn.chat-btn-active .p-button {
        color: var(--gold, #fdd835);
        background: rgba(26, 35, 126, 0.5);
        border-color: rgba(253, 216, 53, 0.5);
      }
      :host ::ng-deep .theme-toggle-btn .p-button {
        color: var(--text-muted, #90a4ae);
        font-size: 1rem;
        padding: 6px 10px;
        border-radius: 20px;
        border: 1px solid rgba(121, 134, 203, 0.25);
        background: rgba(26, 35, 126, 0.2);
        transition: background 0.2s, border-color 0.2s, color 0.2s;
      }
      :host ::ng-deep .theme-toggle-btn .p-button:hover {
        color: var(--text-light, #eceff1);
        background: rgba(26, 35, 126, 0.4);
        border-color: rgba(121, 134, 203, 0.5);
      }
      :host ::ng-deep .auth-menu-btn .p-button {
        color: var(--text-muted, #90a4ae);
        font-size: 0.9rem;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 20px;
        border: 1px solid rgba(121, 134, 203, 0.25);
        background: rgba(26, 35, 126, 0.2);
        transition: background 0.2s, border-color 0.2s, color 0.2s;
      }
      :host ::ng-deep .auth-menu-btn .p-button:hover {
        color: var(--text-light, #eceff1);
        background: rgba(26, 35, 126, 0.4);
        border-color: rgba(121, 134, 203, 0.5);
      }
      .user-avatar-area {
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 20px;
        border: 1px solid transparent;
        transition: border-color 0.2s, background 0.2s;
      }
      .user-avatar-area:hover {
        background: rgba(26, 35, 126, 0.3);
        border-color: rgba(121, 134, 203, 0.4);
      }
      :host ::ng-deep .user-avatar {
        background: rgba(26, 35, 126, 0.8);
        color: var(--gold, #fdd835);
        border: 1px solid rgba(121, 134, 203, 0.5);
        font-size: 0.9rem;
        font-weight: 700;
        width: 34px;
        height: 34px;
      }
      .avatar-caret {
        color: var(--text-muted, #90a4ae);
        font-size: 0.75rem;
      }
      @media (max-width: 768px) {
        .main-layout {
          flex-direction: column;
          overflow: visible;
        }
        .bible-panel {
          max-height: none;
          overflow-y: visible;
        }
        .analysis-panel {
          width: 100%;
          min-width: 0;
          border-left: none;
          border-top: 1px solid rgba(121, 134, 203, 0.2);
          max-height: none;
          overflow-y: visible;
        }
        .parallel-panel {
          width: 100%;
          min-width: 0;
          border-left: none;
          border-top: 1px solid rgba(121, 134, 203, 0.2);
          max-height: none;
          overflow-y: visible;
        }
        .viewer-shell {
          overflow-y: auto;
          height: auto;
        }
        .analyze-bar {
          gap: 10px;
          padding: 10px 14px;
        }
        .selection-preview {
          font-size: 0.82rem;
          flex-basis: 100%;
          order: 10;
        }
      }
      @media (max-width: 540px) {
        .brand {
          padding: 10px 14px;
          flex: 1;
        }
        .brand-title {
          font-size: 0.9rem;
        }
        .auth-area {
          padding-right: 10px;
        }
        :host ::ng-deep .analyze-btn .p-button {
          padding: 8px 16px !important;
          height: 40px !important;
          font-size: 0.9rem !important;
        }
        :host ::ng-deep .parallel-btn .p-button {
          padding: 8px 14px !important;
          height: 40px !important;
          font-size: 0.9rem !important;
        }
      }
      @media (max-width: 420px) {
        .brand-title {
          display: none;
        }
        .analyze-bar {
          padding: 8px 12px;
        }
        .verse-footer {
          padding: 8px 12px;
        }
      }
    `,
  ],
})
export class BibleViewerComponent {
  protected readonly store = inject(BibleStore);
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);

  readonly authDialogVisible = signal(false);
  readonly authDialogMode = signal<'login' | 'register'>('login');
  readonly showChat = signal(false);

  private readonly authMenu = viewChild.required<Menu>('authMenu');

  /** Menu items are reactive: different items for guest vs. authenticated user. */
  readonly authMenuItems = computed<MenuItem[]>(() => {
    if (!this.authService.currentUser()) {
      return [
        {
          label: 'Login',
          icon: 'pi pi-sign-in',
          command: () => this.openAuth('login'),
        },
        {
          label: 'Înregistrare',
          icon: 'pi pi-user-plus',
          command: () => this.openAuth('register'),
        },
      ];
    }
    return [
      {
        label: this.authService.currentUser()!.email,
        icon: 'pi pi-user',
        disabled: true,
        styleClass: 'auth-menu-email',
      },
      { separator: true },
      {
        label: 'Deconectare',
        icon: 'pi pi-sign-out',
        command: () => this.authService.logout(),
      },
    ];
  });

  toggleAuthMenu(event: Event): void {
    this.authMenu().toggle(event);
  }

  openAuth(mode: 'login' | 'register'): void {
    this.authDialogMode.set(mode);
    this.authDialogVisible.set(true);
  }

  openAuthFromPrompt(event: Event, mode: 'login' | 'register'): void {
    event.preventDefault();
    this.openAuth(mode);
  }

  toggleChat(): void {
    this.showChat.update((v) => !v);
  }
}
