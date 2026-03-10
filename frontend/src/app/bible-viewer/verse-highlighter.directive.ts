import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  Renderer2,
} from '@angular/core';

export interface VerseSelection {
  text: string;
  range: string;
}

@Directive({
  selector: '[verseHighlight]',
  standalone: true,
})
export class VerseHighlightDirective {
  @Input() bookName = '';
  @Input() chapterNumber = '';
  @Output() verseSelected = new EventEmitter<VerseSelection>();

  private clickedVerseEl: HTMLElement | null = null;

  constructor(
    private readonly el: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
  ) {}

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const verseEl = target.closest('[data-verse]') as HTMLElement | null;
    if (!verseEl) return;

    // Clear previous highlight
    if (this.clickedVerseEl && this.clickedVerseEl !== verseEl) {
      this.renderer.removeClass(this.clickedVerseEl, 'selected');
    }

    this.renderer.addClass(verseEl, 'selected');
    this.clickedVerseEl = verseEl;

    const verseNumber = verseEl.getAttribute('data-verse') ?? '';
    const verseText = verseEl.textContent?.trim() ?? '';

    const cleanText = verseText.replace(/^\d+\s*/, '');
    const reference = `${this.bookName} ${this.chapterNumber}:${verseNumber}`;

    this.verseSelected.emit({ text: cleanText, range: reference });
  }

  @HostListener('mouseup', ['$event'])
  onMouseup(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = this.extractVerseRange(selection);
    if (range) {
      this.verseSelected.emit({ text: selectedText, range });
    }
  }

  private extractVerseRange(selection: Selection): string | null {
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    if (!anchorNode || !focusNode) return null;

    const anchorVerse = this.findVerseEl(anchorNode);
    const focusVerse = this.findVerseEl(focusNode);

    if (!anchorVerse || !focusVerse) return null;

    const startVerse = anchorVerse.getAttribute('data-verse') ?? '';
    const endVerse = focusVerse.getAttribute('data-verse') ?? '';

    if (startVerse === endVerse) {
      return `${this.bookName} ${this.chapterNumber}:${startVerse}`;
    }

    return `${this.bookName} ${this.chapterNumber}:${startVerse}-${endVerse}`;
  }

  private findVerseEl(node: Node): HTMLElement | null {
    let current: Node | null = node;
    while (current && current !== this.el.nativeElement) {
      if (
        current instanceof HTMLElement &&
        current.hasAttribute('data-verse')
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  }
}
