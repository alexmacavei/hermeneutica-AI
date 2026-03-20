import {
  Directive,
  ElementRef,
  HostListener,
  Renderer2,
  inject,
  input,
  output,
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
  readonly bookName = input('');
  readonly chapterNumber = input('');
  readonly verseSelected = output<VerseSelection>();

  private clickedVerseEl: HTMLElement | null = null;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

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
    const reference = `${this.bookName()} ${this.chapterNumber()}:${verseNumber}`;

    this.verseSelected.emit({ text: cleanText, range: reference });
  }

  @HostListener('mouseup')
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

    const anchorNum = parseInt(anchorVerse.getAttribute('data-verse') ?? '0', 10);
    const focusNum = parseInt(focusVerse.getAttribute('data-verse') ?? '0', 10);

    // Normalize so range is always ascending (handles bottom-to-top drag)
    const startVerseNum = Math.min(anchorNum, focusNum);
    const endVerseNum = Math.max(anchorNum, focusNum);

    if (startVerseNum === endVerseNum) {
      return `${this.bookName()} ${this.chapterNumber()}:${startVerseNum}`;
    }

    return `${this.bookName()} ${this.chapterNumber()}:${startVerseNum}-${endVerseNum}`;
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
