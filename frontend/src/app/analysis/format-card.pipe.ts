import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * Converts AI-generated card text to safe HTML:
 * - Converts **bold** markdown to <strong> tags
 * - Converts literal \n\n strings (from LLM output) and real newlines to <br>
 * - Sanitizes output via Angular's DomSanitizer to prevent XSS
 */
@Pipe({
  name: 'formatCard',
  standalone: true,
})
export class FormatCardPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): string {
    if (!value) return '';

    const html = value
      .replace(/\\n\\n/g, '\n')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }
}
