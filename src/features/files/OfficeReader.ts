import type JSZip from 'jszip';

export interface Sheet {
  name: string;
  /** Cell texts by row, column A first; empty strings for gaps. */
  rows: string[][];
}

export interface Slide {
  title: string;
  lines: string[];
}

export interface OfficeLimits {
  maxRows: number;
  maxColumns: number;
  maxSlides: number;
}

const RELS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** Characters of one XML part; real club documents stay far below this. */
const MAX_PART_CHARS = 20_000_000;

interface ZipStream {
  on(event: 'data', listener: (chunk: string) => void): ZipStream;
  on(event: 'error', listener: (error: Error) => void): ZipStream;
  on(event: 'end', listener: () => void): ZipStream;
  pause(): ZipStream;
  resume(): ZipStream;
}

/**
 * Reads the text of Excel and PowerPoint files (Office Open XML) for previews: cell values per sheet,
 * text per slide. Text only (no formatting, charts or pictures); the result is rendered as plain text,
 * so nothing from the file can run in the page.
 */
export class OfficeReader {
  constructor(private readonly limits: OfficeLimits) {}

  async sheets(content: Blob): Promise<Sheet[]> {
    const zip = await OfficeReader.open(content);
    const workbook = await OfficeReader.xml(zip, 'xl/workbook.xml');
    const targets = await OfficeReader.relationships(zip, 'xl/_rels/workbook.xml.rels', 'xl/');
    const shared = await OfficeReader.sharedStrings(zip);
    const sheets: Sheet[] = [];
    for (const sheet of OfficeReader.all(workbook, 'sheet')) {
      const path = targets.get(sheet.getAttributeNS(RELS_NS, 'id') ?? '');
      if (!path || !zip.file(path)) continue;
      sheets.push({ name: sheet.getAttribute('name') ?? `Blatt ${sheets.length + 1}`, rows: this.rows(await OfficeReader.xml(zip, path), shared) });
    }
    return sheets;
  }

  async slides(content: Blob): Promise<Slide[]> {
    const zip = await OfficeReader.open(content);
    const presentation = await OfficeReader.xml(zip, 'ppt/presentation.xml');
    const targets = await OfficeReader.relationships(zip, 'ppt/_rels/presentation.xml.rels', 'ppt/');
    const slides: Slide[] = [];
    for (const id of OfficeReader.all(presentation, 'sldId').slice(0, this.limits.maxSlides)) {
      const path = targets.get(id.getAttributeNS(RELS_NS, 'id') ?? '');
      if (!path || !zip.file(path)) continue;
      const doc = await OfficeReader.xml(zip, path);
      const paragraphs = OfficeReader.all(doc, 'p')
        .filter((p) => p.namespaceURI?.includes('drawingml'))
        .map((p) =>
          OfficeReader.all(p, 't')
            .map((t) => t.textContent ?? '')
            .join('')
            .trim(),
        )
        .filter(Boolean);
      slides.push({ title: paragraphs[0] ?? '', lines: paragraphs.slice(1) });
    }
    return slides;
  }

  /** Paragraph texts of a Word document, empty ones left out. */
  async paragraphs(content: Blob): Promise<string[]> {
    const zip = await OfficeReader.open(content);
    const doc = await OfficeReader.xml(zip, 'word/document.xml');
    return OfficeReader.all(doc, 'p')
      .filter((p) => p.namespaceURI?.includes('wordprocessingml'))
      .map((p) =>
        OfficeReader.all(p, 't')
          .map((t) => t.textContent ?? '')
          .join('')
          .trim(),
      )
      .filter(Boolean);
  }

  private rows(sheet: Document, shared: string[]): string[][] {
    const rows: string[][] = [];
    for (const row of OfficeReader.all(sheet, 'row')) {
      const index = Number(row.getAttribute('r') ?? rows.length + 1) - 1;
      if (index >= this.limits.maxRows) break;
      const cells: string[] = [];
      for (const cell of OfficeReader.all(row, 'c')) {
        const column = OfficeReader.column(cell.getAttribute('r') ?? '') ?? cells.length;
        if (column >= this.limits.maxColumns) continue;
        cells[column] = OfficeReader.value(cell, shared);
      }
      rows[index] = Array.from({ length: cells.length }, (_, i) => cells[i] ?? '');
    }
    // Drop leading/trailing gaps' undefined holes; keep empty rows between data visible.
    return Array.from({ length: rows.length }, (_, i) => rows[i] ?? []);
  }

  private static value(cell: Element, shared: string[]): string {
    const type = cell.getAttribute('t');
    const raw = OfficeReader.first(cell, 'v')?.textContent ?? '';
    if (type === 's') return shared[Number(raw)] ?? '';
    if (type === 'inlineStr')
      return OfficeReader.all(cell, 't')
        .map((t) => t.textContent ?? '')
        .join('');
    if (type === 'b') return raw === '1' ? 'WAHR' : 'FALSCH';
    if (type === 'str' || type === 'e') return raw;
    const number = Number(raw);
    return raw && Number.isFinite(number) ? number.toLocaleString('de-AT', { maximumFractionDigits: 10 }) : raw;
  }

  /** "C12" → 2 */
  static column(reference: string): number | null {
    const letters = /^[A-Z]+/.exec(reference)?.[0];
    if (!letters) return null;
    return [...letters].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  }

  /** 2 → "C" */
  static columnName(index: number): string {
    let name = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
  }

  private static async sharedStrings(zip: JSZip): Promise<string[]> {
    if (!zip.file('xl/sharedStrings.xml')) return [];
    const doc = await OfficeReader.xml(zip, 'xl/sharedStrings.xml');
    return OfficeReader.all(doc, 'si').map((si) =>
      OfficeReader.all(si, 't')
        .map((t) => t.textContent ?? '')
        .join(''),
    );
  }

  /** Relationship id → part path inside the package. */
  private static async relationships(zip: JSZip, path: string, base: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!zip.file(path)) return map;
    for (const rel of OfficeReader.all(await OfficeReader.xml(zip, path), 'Relationship')) {
      const target = rel.getAttribute('Target') ?? '';
      map.set(rel.getAttribute('Id') ?? '', target.startsWith('/') ? target.slice(1) : base + target);
    }
    return map;
  }

  private static async open(content: Blob): Promise<JSZip> {
    const { default: JSZipClass } = await import('jszip');
    return JSZipClass.loadAsync(content);
  }

  private static async xml(zip: JSZip, path: string): Promise<Document> {
    const file = zip.file(path);
    if (!file) throw new Error(`Teil ${path} fehlt.`);
    const doc = new DOMParser().parseFromString(await OfficeReader.text(file, path), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error(`Teil ${path} ist kein gültiges XML.`);
    return doc;
  }

  /** Inflates one part, stopping at MAX_PART_CHARS: a small zip can unpack to gigabytes and freeze the tab. */
  private static text(file: JSZip.JSZipObject, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parts: string[] = [];
      let size = 0;
      // internalStream exists at runtime but is missing from JSZip's types.
      const stream = (file as unknown as { internalStream(type: 'string'): ZipStream }).internalStream('string');
      stream
        .on('data', (chunk: string) => {
          size += chunk.length;
          if (size > MAX_PART_CHARS) {
            stream.pause();
            reject(new Error(`Teil ${path} ist zu groß für die Vorschau.`));
          } else {
            parts.push(chunk);
          }
        })
        .on('error', reject)
        .on('end', () => resolve(parts.join('')))
        .resume();
    });
  }

  private static all(node: Document | Element, localName: string): Element[] {
    return [...node.getElementsByTagNameNS('*', localName)];
  }

  private static first(node: Element, localName: string): Element | undefined {
    return node.getElementsByTagNameNS('*', localName)[0];
  }
}
