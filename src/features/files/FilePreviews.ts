import type { FileLinks } from './FileLinks';

export type PreviewKind = 'pdf' | 'docx';

const KINDS: Readonly<Record<string, PreviewKind>> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/**
 * In-app previews of documents: PDFs through the browser's own viewer, Word files rendered to
 * HTML in the page (docx-preview, loaded on first use). Other formats are downloaded instead.
 */
export class FilePreviews {
  constructor(private readonly links: FileLinks) {}

  kind(contentType: string): PreviewKind | null {
    return KINDS[contentType] ?? null;
  }

  /** The file's content, typed, so object URLs open inline instead of downloading. */
  async content(fileId: string, contentType: string): Promise<Blob> {
    const response = await fetch(await this.links.url(fileId));
    if (!response.ok) throw new Error(`Vorschau nicht verfügbar (${response.status}).`);
    return new Blob([await response.blob()], { type: contentType });
  }

  /** Renders a Word document into `target`; styles stay inside the generated markup. */
  async renderDocx(content: Blob, target: HTMLElement): Promise<void> {
    const { renderAsync } = await import('docx-preview');
    await renderAsync(content, target, undefined, { inWrapper: true, ignoreLastRenderedPageBreak: true, breakPages: true });
  }
}
