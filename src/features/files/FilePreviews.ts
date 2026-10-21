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

  /**
   * A Word document as a standalone HTML page, for a sandboxed iframe: docx-preview copies style values from the
   * file into CSS unescaped, so rendering it into the app's own DOM would let a document restyle the app.
   * Images become data: URIs (no object URLs left to revoke).
   */
  async renderDocx(content: Blob, background: string): Promise<string> {
    const { renderAsync } = await import('docx-preview');
    const body = document.createElement('div');
    const styles = document.createElement('div');
    await renderAsync(content, body, styles, { inWrapper: true, ignoreLastRenderedPageBreak: true, breakPages: true, useBase64URL: true });
    FilePreviews.defuseLinks(body);
    // docx-preview draws white pages on a grey desk; the desk takes the house colour.
    const desk = `body{margin:0}.docx-wrapper{padding:16px;background:${background.replace(/[^#\w(),.% -]/g, '')}}`;
    return `<!doctype html><html><head><meta charset="utf-8"><style>${desk}</style>${styles.innerHTML}</head><body>${body.innerHTML}</body></html>`;
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
