// Word templates for the mocks: the built-in layout and the engine of server platform.WordTemplate, line for line. Both pass
// club-server/docs/api/word-template-cases.json, copied to src/lib/api by npm run api:sync (wordTemplate.test.ts here, WordTemplateTest there); change both or neither.
import type JSZip from 'jszip';

const TEMPLATE_TYPE = 'wordprocessingml.template.main+xml';
const DOCUMENT_TYPE = 'wordprocessingml.document.main+xml';

/** server: WordTemplate.escape — control characters go, tabs become spaces. */
const escape = (text: string) =>
  text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000a-\u001f]/g, '')
    .replace(/\t/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
const unescape = (xml: string) =>
  xml.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-fA-F]+);/g, (_, e: string) =>
    e.startsWith('#x')
      ? String.fromCodePoint(parseInt(e.slice(2), 16))
      : e.startsWith('#')
        ? String.fromCodePoint(parseInt(e.slice(1), 10))
        : ENTITIES[e],
  );

export const p = (style: string | null, text: string) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="de-AT"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Klein"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="595959"/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NAMESPACES =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
/** A4 portrait. */
const SECTION =
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';

/** server: WordTemplate.template — the house styles around `body`, with a header and footer (paragraphs) when given. */
export async function template(Zip: typeof JSZip, body: string, header?: string, footer?: string): Promise<Blob> {
  const zip = new Zip();
  let [types, rels, section] = [CONTENT_TYPES, DOCUMENT_RELS, SECTION];
  if (header != null) {
    types = types.replace(
      '</Types>',
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>\n</Types>',
    );
    rels = rels.replace(
      '</Relationships>',
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>\n</Relationships>',
    );
    section = section.replace('<w:sectPr>', '<w:sectPr><w:headerReference w:type="default" r:id="rId2"/>');
    zip.file('word/header1.xml', `${XML}<w:hdr ${NAMESPACES}>${header}</w:hdr>`);
  }
  if (footer != null) {
    types = types.replace(
      '</Types>',
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>\n</Types>',
    );
    rels = rels.replace(
      '</Relationships>',
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>\n</Relationships>',
    );
    section = section.replace('<w:pgSz', '<w:footerReference w:type="default" r:id="rId3"/><w:pgSz');
    zip.file('word/footer1.xml', `${XML}<w:ftr ${NAMESPACES}>${footer}</w:ftr>`);
  }
  zip.file('[Content_Types].xml', types);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', rels);
  zip.file('word/styles.xml', STYLES);
  zip.file('word/document.xml', `${XML}<w:document ${NAMESPACES}><w:body>${body}${section}</w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' });
}

/** A value tree: texts, or lists of value maps for blocks. */
export type Values = { [name: string]: string | null | undefined | readonly Values[] };

/** server: WordTemplate.Problems */
export interface Problems {
  unknown: string[];
  blocks: string[];
}

const TOKEN = /<[^>]*>|[^<]+/g;
const PLACEHOLDER = /\{\{\s*([#^/]?)\s*(\p{L}+)\s*\}\}/gu;
const MARKER = /^\s*\{\{\s*([#^/])\s*(\p{L}+)\s*\}\}\s*$/u;
const PARAGRAPH_ID = / w14:(paraId|textId)="[^"]*"/g;
const OTHER_TEXT = new Set(['w:p', 'w:txbxContent', 'mc:AlternateContent', 'w:pict', 'w:drawing']);
const FILLED_PART = /^word\/(document|header\d*|footer\d*)\.xml$/;
const UNKNOWN = Symbol('unknown');

/** An element (`name` set, `close` null when empty) or a raw token: text, declaration, comment. */
interface XmlNode {
  name: string | null;
  open: string;
  close: string | null;
  children: XmlNode[];
}

export class TemplateError extends Error {}

function parse(xml: string): XmlNode {
  const root: XmlNode = { name: '#root', open: '', close: null, children: [] };
  const stack = [root];
  for (const [token] of xml.matchAll(TOKEN)) {
    const top = stack[stack.length - 1];
    if (!token.startsWith('<') || token.startsWith('<?') || token.startsWith('<!')) {
      top.children.push({ name: null, open: token, close: null, children: [] });
      continue;
    }
    const name = /^<\/?([^\s/>]+)/.exec(token)?.[1];
    if (!name) throw new TemplateError('Unreadable tag');
    if (token.startsWith('</')) {
      if (stack.length < 2 || top.name !== name) throw new TemplateError(`Unbalanced tag ${name}`);
      top.close = token;
      stack.pop();
    } else {
      const element: XmlNode = { name, open: token, close: null, children: [] };
      top.children.push(element);
      if (!token.endsWith('/>')) stack.push(element);
    }
  }
  if (stack.length !== 1) throw new TemplateError('Unclosed tag');
  return root;
}

const openTag = (n: XmlNode, repeated: boolean) => (repeated && n.name === 'w:p' ? n.open.replace(PARAGRAPH_ID, '') : n.open);

function write(n: XmlNode, texts: Map<XmlNode, string>, repeated: boolean): string {
  if (repeated && (n.name === 'w:bookmarkStart' || n.name === 'w:bookmarkEnd')) return '';
  const replaced = texts.get(n);
  if (replaced !== undefined) return `<w:t xml:space="preserve">${escape(replaced)}</w:t>`;
  return openTag(n, repeated) + n.children.map((c) => write(c, texts, repeated)).join('') + (n.close ?? '');
}

function collect(n: XmlNode, out: XmlNode[], top: boolean) {
  for (const c of n.children) {
    if (c.name === 'w:t') out.push(c);
    else if (c.name !== null && (top || !OTHER_TEXT.has(c.name))) collect(c, out, top && c.name !== 'w:p');
  }
}

function textsOf(n: XmlNode): XmlNode[] {
  const out: XmlNode[] = [];
  collect(n, out, n.name === 'w:tr' || n.name === 'w:tc');
  return out;
}

const textOf = (t: XmlNode) =>
  unescape(
    t.children
      .filter((c) => c.name === null)
      .map((c) => c.open)
      .join(''),
  );
const joined = (ts: XmlNode[]) => ts.map(textOf).join('');

class Scope {
  constructor(
    private readonly values: Values,
    private readonly parent: Scope | null,
  ) {}

  get(name: string): string | readonly Values[] | typeof UNKNOWN {
    if (Object.hasOwn(this.values, name)) {
      const v = this.values[name];
      return v == null ? '' : Array.isArray(v) ? v : String(v);
    }
    return this.parent ? this.parent.get(name) : UNKNOWN;
  }

  with(item: unknown): Scope {
    return new Scope(item && typeof item === 'object' ? (item as Values) : {}, this);
  }
}

type Body = (scope: Scope, repeated: boolean) => void;

class Filler {
  readonly unknown = new Set<string>();
  readonly blocks = new Set<string>();
  /** The block whose markers sit in the row being filled; they are taken out of its text. */
  private rowBlock: string | null = null;
  readonly out: string[] = [];

  constructor(private readonly checking: boolean) {}

  children(nodes: XmlNode[], scope: Scope, repeated: boolean, out: string[]) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.name === 'w:p') {
        const marker = MARKER.exec(joined(textsOf(n)));
        if (!marker || marker[2] === this.rowBlock) {
          this.paragraph(n, scope, repeated, out);
          continue;
        }
        const [, kind, name] = marker;
        const end = kind === '/' ? -1 : Filler.close(nodes, i, name);
        if (end < 0) {
          this.blocks.add(`{{${kind}${name}}}`);
          continue;
        }
        const content = nodes.slice(i + 1, end);
        this.block(kind, name, scope, repeated, (s, r) => this.children(content, s, r, out));
        i = end;
      } else if (n.name === 'w:tr') this.row(n, scope, repeated, out);
      else if (n.name === null || n.children.length === 0) out.push(write(n, new Map(), repeated));
      else this.element(n, scope, repeated, out);
    }
  }

  private static close(nodes: XmlNode[], open: number, name: string): number {
    let depth = 0;
    for (let j = open; j < nodes.length; j++) {
      if (nodes[j].name !== 'w:p') continue;
      const m = MARKER.exec(joined(textsOf(nodes[j])));
      if (m && m[2] === name) {
        depth += m[1] === '/' ? -1 : 1;
        if (depth === 0) return j;
      }
    }
    return -1;
  }

  private block(kind: string, name: string, scope: Scope, repeated: boolean, body: Body) {
    const value = scope.get(name);
    if (value === UNKNOWN) {
      this.unknown.add(name);
      if (this.checking) body(scope, repeated);
      return;
    }
    if (this.checking) {
      body(Array.isArray(value) && value.length > 0 ? scope.with(value[0]) : scope, repeated);
      return;
    }
    const empty = Array.isArray(value) ? value.length === 0 : !(value as string).trim();
    if (kind === '^') {
      if (empty) body(scope, repeated);
    } else if (Array.isArray(value)) {
      for (const item of value) body(scope.with(item), repeated || value.length > 1);
    } else if (!empty) body(scope, repeated);
  }

  private element(n: XmlNode, scope: Scope, repeated: boolean, out: string[]) {
    const parts: string[] = [];
    this.children(n.children, scope, repeated, parts);
    let inner = parts.join('');
    if (n.name === 'w:tbl' && !/<w:tr[ >]/.test(inner)) return;
    if (n.name === 'w:tc' && !/<w:p[ >/]/.test(inner)) inner += '<w:p/>';
    out.push(openTag(n, repeated) + inner + (n.close ?? ''));
  }

  private row(row: XmlNode, scope: Scope, repeated: boolean, out: string[]) {
    let open: string | null = null;
    let kind = '';
    let openCell = -1;
    let closeCell = -1;
    let any = false;
    let allEmpty = true;
    const cells = row.children.filter((c) => c.name === 'w:tc');
    cells.forEach((cell, ci) => {
      for (const [, prefix, name] of joined(textsOf(cell)).matchAll(PLACEHOLDER)) {
        if (!prefix) {
          const v = scope.get(name);
          any = true;
          allEmpty &&= typeof v === 'string' && !v.trim();
        } else if (open === null && prefix !== '/') {
          open = name;
          kind = prefix;
          openCell = ci;
        } else if (prefix === '/' && name === open && closeCell < 0) closeCell = ci;
      }
    });
    if (open !== null && openCell === closeCell && Filler.standalone(cells[openCell], open)) open = null;
    if (open === null) {
      if (!this.checking && any && allEmpty) return;
      this.element(row, scope, repeated, out);
      return;
    }
    if (closeCell < 0) {
      this.blocks.add(`{{${kind}${open}}}`);
      return;
    }
    const outer = this.rowBlock;
    this.rowBlock = open;
    this.block(kind, open, scope, repeated, (s, r) => this.element(row, s, r, out));
    this.rowBlock = outer;
  }

  private static standalone(cell: XmlNode, name: string): boolean {
    return cell.children
      .filter((c) => c.name === 'w:p')
      .some((c) => {
        const m = MARKER.exec(joined(textsOf(c)));
        return !!m && m[1] !== '/' && m[2] === name;
      });
  }

  private paragraph(p: XmlNode, scope: Scope, repeated: boolean, out: string[]) {
    const ts = textsOf(p);
    const spans: [number, number][] = [];
    const values: string[] = [];
    let lines: string[] | null = null;
    let multiline = -1;
    let missing = false;
    for (const m of joined(ts).matchAll(PLACEHOLDER)) {
      const [whole, prefix, name] = m;
      let value: string;
      if (prefix) {
        if (name !== this.rowBlock) this.blocks.add(`{{${prefix}${name}}}`);
        value = '';
      } else {
        const v = scope.get(name);
        if (v === UNKNOWN) {
          this.unknown.add(name);
          value = whole;
        } else if (Array.isArray(v)) {
          this.blocks.add(`{{${name}}}`);
          value = whole;
        } else {
          value = v as string;
          if (!value.trim()) missing = true;
          else if (multiline < 0 && /[\n\r]/.test(value)) {
            lines = value
              .split(/\r\n|\r|\n/)
              .map((l) => l.trim())
              .filter(Boolean);
            multiline = values.length;
          }
        }
      }
      spans.push([m.index, m.index + whole.length]);
      values.push(value);
    }
    if (spans.length === 0) {
      out.push(write(p, new Map(), repeated));
      return;
    }
    if (missing || this.checking) return;
    const each: string[] = lines ?? [''];
    for (const line of each) {
      if (multiline >= 0) values[multiline] = line;
      out.push(write(p, Filler.replace(ts, spans, values), repeated || each.length > 1));
    }
  }

  /** New texts of the w:t the placeholders span: the value goes where the placeholder starts, the rest of it is cut. */
  private static replace(ts: XmlNode[], spans: [number, number][], values: string[]): Map<XmlNode, string> {
    const texts = ts.map(textOf);
    const starts: number[] = [];
    let at = 0;
    for (const t of texts) {
      starts.push(at);
      at += t.length;
    }
    const index = (offset: number) => {
      let i = 0;
      while (i + 1 < starts.length && starts[i + 1] <= offset) i++;
      return i;
    };
    const changed = new Set<number>();
    for (let k = spans.length - 1; k >= 0; k--) {
      const [start, end] = spans[k];
      const i = index(start);
      const j = index(end - 1);
      const a = start - starts[i];
      const b = end - starts[j];
      if (i === j) texts[i] = texts[i].slice(0, a) + values[k] + texts[i].slice(b);
      else {
        texts[i] = texts[i].slice(0, a) + values[k];
        for (let x = i + 1; x < j; x++) {
          texts[x] = '';
          changed.add(x);
        }
        texts[j] = texts[j].slice(b);
        changed.add(j);
      }
      changed.add(i);
    }
    return new Map([...changed].sort((x, y) => x - y).map((x) => [ts[x], texts[x]]));
  }
}

/** server: WordTemplate.fillXml — throws TemplateError on misplaced blocks. */
export function fillXml(xml: string, values: Values): string {
  const filler = new Filler(false);
  const out: string[] = [];
  filler.children(parse(xml).children, new Scope(values, null), false, out);
  if (filler.blocks.size > 0) throw new TemplateError(`Misplaced blocks ${[...filler.blocks].join(', ')}`);
  return out.join('');
}

/** server: WordTemplate.checkXml */
export function checkXml(xml: string, examples: Values): Problems {
  const filler = new Filler(true);
  filler.children(parse(xml).children, new Scope(examples, null), false, []);
  return { unknown: [...filler.unknown], blocks: [...filler.blocks] };
}

/** The parts with text (body, headers, footers); throws TemplateError for what is no Word file. */
async function textParts(Zip: typeof JSZip, template: Blob): Promise<{ zip: JSZip; names: string[] }> {
  let zip: JSZip;
  try {
    zip = await Zip.loadAsync(template);
  } catch {
    throw new TemplateError('The template is not a readable zip');
  }
  if (!zip.file('word/document.xml') || !zip.file('[Content_Types].xml')) throw new TemplateError('The template is not a Word file');
  return { zip, names: Object.keys(zip.files).filter((n) => FILLED_PART.test(n)) };
}

/** server: WordTemplate.fill — every part with text filled, saved as a document (`asDocument` false keeps a template). */
export async function fill(Zip: typeof JSZip, template: Blob, values: Values, asDocument = true): Promise<Blob> {
  const { zip, names } = await textParts(Zip, template);
  if (asDocument) {
    zip.file('[Content_Types].xml', (await zip.file('[Content_Types].xml')!.async('string')).replace(TEMPLATE_TYPE, DOCUMENT_TYPE));
  }
  for (const name of names) zip.file(name, fillXml(await zip.file(name)!.async('string'), values));
  const kind = asDocument ? 'document' : 'template';
  return zip.generateAsync({ type: 'blob', mimeType: `application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}` });
}

/** server: WordTemplate.check */
export async function check(Zip: typeof JSZip, template: Blob, examples: Values): Promise<Problems> {
  const { zip, names } = await textParts(Zip, template);
  const filler = new Filler(true);
  for (const name of names) filler.children(parse(await zip.file(name)!.async('string')).children, new Scope(examples, null), false, []);
  return { unknown: [...filler.unknown], blocks: [...filler.blocks] };
}
