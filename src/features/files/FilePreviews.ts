import type { FileLinks } from './FileLinks';
import type { OfficeReader } from './OfficeReader';

export type PreviewKind = 'pdf' | 'docx' | 'xlsx' | 'pptx';

const KINDS: Readonly<Record<string, PreviewKind>> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

/**
 * In-app previews of documents: PDFs through the browser's own viewer, Word files rendered to
 * HTML in the page (docx-preview, loaded on first use), Excel and PowerPoint as their text
 * (OfficeReader). Other formats are downloaded instead.
 */
export class FilePreviews {
  constructor(
    private readonly links: FileLinks,
    readonly office: OfficeReader,
  ) {}

  kind(contentType: string): PreviewKind | null {
    return KINDS[contentType] ?? null;
  }

  /** The file's content, typed, so object URLs open inline instead of downloading. */
  async content(fileId: string, contentType: string): Promise<Blob> {
    const response = await fetch(await this.links.url(fileId));
    if (!response.ok) throw new Error(`Vorschau nicht verfügbar (${response.status}).`);
    return new Blob([await response.blob()], { type: contentType });
  }

  /** Whether two versions of this type can be compared line by line (Word, Excel, PowerPoint, text). */
  comparable(contentType: string): boolean {
    const kind = this.kind(contentType);
    return kind === 'docx' || kind === 'xlsx' || kind === 'pptx' || contentType.startsWith('text/');
  }

  /** A document's text as lines for comparing versions: paragraphs, sheet rows ("A | B | C"), slide lines. */
  async lines(content: Blob, contentType: string): Promise<string[]> {
    switch (this.kind(contentType)) {
      case 'docx':
        return this.office.paragraphs(content);
      case 'xlsx':
        return (await this.office.sheets(content)).flatMap((s) => [`Blatt ${s.name}`, ...s.rows.map((r) => r.join(' | ').trim()).filter(Boolean)]);
      case 'pptx':
        return (await this.office.slides(content)).flatMap((s, i) => [`Folie ${i + 1}: ${s.title}`, ...s.lines]);
      default:
        return (await content.text()).split(/\r?\n/);
    }
  }

  /** One version's content, typed like the file. */
  async versionContent(fileId: string, versionId: string, contentType: string): Promise<Blob> {
    const response = await fetch(await this.links.versionUrl(fileId, versionId));
    if (!response.ok) throw new Error(`Version nicht verfügbar (${response.status}).`);
    return new Blob([await response.blob()], { type: contentType });
  }

  /** Renders a Word document into `target`; styles stay inside the generated markup. */
  async renderDocx(content: Blob, target: HTMLElement): Promise<void> {
    const { renderAsync } = await import('docx-preview');
    await renderAsync(content, target, undefined, { inWrapper: true, ignoreLastRenderedPageBreak: true, breakPages: true });
    FilePreviews.defuseLinks(target);
  }

  /** Links inside a document must not run script in the app (javascript: and the like): keep web and mail links only. */
  static defuseLinks(root: HTMLElement): void {
    for (const anchor of root.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href') ?? '';
      if (/^(https?:|mailto:|#)/i.test(href.trim())) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      } else {
        anchor.removeAttribute('href');
      }
    }
  }
}
