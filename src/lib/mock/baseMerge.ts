// server: documents.domain.BaseMerge, line for line — a kind's template on the base template: the base's package (header, footer,
// styles, numbering, settings, page) with the kind's body. Styles the base lacks come from the kind, the kind's lists are renumbered
// after the base's, images and links of the body are copied; anything else the body refers to is refused.
import type JSZip from 'jszip';
import { MockServer } from './MockServer';

export const UNSUPPORTED = 'document.template-unsupported';

const DOCUMENT = 'word/document.xml';
const RELS = 'word/_rels/document.xml.rels';
const STYLES = 'word/styles.xml';
const NUMBERING = 'word/numbering.xml';
const TYPES = '[Content_Types].xml';
const REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

const ROOT = /<(?![?!])[^>]+>/;
const XMLNS = /\sxmlns:([\w.-]+)="[^"]*"/g;
const BODY = /<w:body>([\s\S]*)<\/w:body>/;
const HEADER_FOOTER_REF = /<w:(headerReference|footerReference)\s[^>]*\/>/g;
const REL_ATTRIBUTE = /\sr:([a-zA-Z]+)="([^"]*)"/g;
const NOTE_REF = /<w:(footnoteReference|endnoteReference|commentReference|altChunk)[\s/>]/g;
const RELATIONSHIP = /<Relationship\s[^>]*\/>/g;
const STYLE = /<w:style\s[^>]*w:styleId="([^"]+)"[^>]*(?:\/>|>[\s\S]*?<\/w:style>)/g;
const NUM_ID = /(<w:numId\s+w:val=")(\d+)(")/g;
const ABSTRACT = /<w:abstractNum\s[^>]*w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/g;
const NUM = /<w:num\s[^>]*w:numId="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/w:num>)/g;
const ABSTRACT_REF = /(<w:abstractNumId\s+w:val=")(\d+)(")/g;
const ABSTRACT_ID = /(w:abstractNumId=")(\d+)(")/g;

interface Rel {
  type: string;
  target: string;
  external: boolean;
}

/** Refuses a kind template whose body refers to more than images and links. */
export async function requireSupported(Zip: typeof JSZip, kind: Blob): Promise<void> {
  const zip = await load(Zip, kind, UNSUPPORTED);
  body(await text(zip, DOCUMENT), relationships(await text(zip, RELS)));
}

export async function merge(Zip: typeof JSZip, base: Blob, kind: Blob, invalidCode: string): Promise<Blob> {
  const out = await load(Zip, base, invalidCode);
  const k = await load(Zip, kind, invalidCode);
  const kindDocument = (await text(k, DOCUMENT))!;
  const kindRels = relationships(await text(k, RELS));
  let content = body(kindDocument, kindRels);

  // Images and links of the body under new ids.
  const rels =
    (await text(out, RELS)) ??
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  let types = (await text(out, TYPES))!;
  const newIds = new Map<string, string>();
  let added = '';
  for (const id of referenced(content)) {
    const rel = kindRels.get(id)!;
    const newId = `rIdK${newIds.size + 1}`;
    newIds.set(id, newId);
    let target = rel.target;
    if (!rel.external) {
      const source = `word/${target}`;
      const extension = /\.([A-Za-z0-9]+)$/.exec(target)?.[1].toLowerCase() ?? 'bin';
      target = `media/k${newIds.size}.${extension}`;
      out.file(`word/${target}`, (await k.file(source)?.async('uint8array')) ?? new Uint8Array());
      if (!types.includes(`Extension="${extension}"`)) {
        types = types.replace(
          '<Default ',
          `<Default Extension="${extension}" ContentType="${contentType((await text(k, TYPES))!, extension)}"/><Default `,
        );
      }
    }
    added += `<Relationship Id="${newId}" Type="${rel.type}" Target="${escape(target)}"${rel.external ? ' TargetMode="External"' : ''}/>`;
  }
  content = content.replace(REL_ATTRIBUTE, (_, name: string, id: string) => ` r:${name}="${newIds.get(id)}"`);

  // Styles the base lacks, and the kind's lists after the base's.
  const baseStyles = await text(out, STYLES);
  const kindStyles = await text(k, STYLES);
  let newStyles = '';
  if (kindStyles != null && baseStyles != null) {
    const known = ids(STYLE, baseStyles);
    for (const m of kindStyles.matchAll(STYLE)) if (!known.has(m[1])) newStyles += m[0];
  }
  const kindNumbering = await text(k, NUMBERING);
  if (kindNumbering != null) {
    const used = new Set([...numIds(content), ...numIds(newStyles)]);
    used.delete('0');
    if (used.size > 0) {
      const baseNumbering = await text(out, NUMBERING);
      const numOffset = baseNumbering == null ? 0 : max(NUM, baseNumbering);
      const abstractOffset = baseNumbering == null ? 0 : max(ABSTRACT, baseNumbering) + 1;
      let nums = '';
      const abstracts = new Set<string>();
      for (const m of kindNumbering.matchAll(NUM)) {
        if (!used.has(m[1])) continue;
        const num = m[0].replace(/w:numId="\d+"/, `w:numId="${Number(m[1]) + numOffset}"`);
        const a = new RegExp(ABSTRACT_REF.source).exec(num);
        if (a) abstracts.add(a[2]);
        nums += shift(ABSTRACT_REF, num, abstractOffset);
      }
      let abstractNums = '';
      for (const m of kindNumbering.matchAll(ABSTRACT)) if (abstracts.has(m[1])) abstractNums += shift(ABSTRACT_ID, m[0], abstractOffset);
      content = shift(NUM_ID, content, numOffset);
      newStyles = shift(NUM_ID, newStyles, numOffset);
      let numbering: string;
      if (baseNumbering == null) {
        numbering = kindNumbering.substring(0, rootEnd(kindNumbering)) + abstractNums + nums + '</w:numbering>';
        types = types.replace(
          '</Types>',
          '<Override PartName="/word/numbering.xml" ' +
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>',
        );
        added += `<Relationship Id="rIdKNumbering" Type="${REL_TYPE}numbering" Target="numbering.xml"/>`;
      } else {
        numbering = namespaces(baseNumbering, kindNumbering);
        const firstNum = numbering.indexOf('<w:num ');
        const at = firstNum >= 0 ? firstNum : numbering.lastIndexOf('</w:numbering>');
        numbering = numbering.substring(0, at) + abstractNums + numbering.substring(at);
        numbering = numbering.replace('</w:numbering>', nums + '</w:numbering>');
      }
      out.file(NUMBERING, numbering);
    }
  }
  if (newStyles) out.file(STYLES, namespaces(baseStyles!, kindStyles!).replace('</w:styles>', newStyles + '</w:styles>'));

  const baseDocument = (await text(out, DOCUMENT))!;
  const baseBody = BODY.exec(baseDocument);
  if (!baseBody) MockServer.fail(400, invalidCode);
  const section = lastSection(baseBody[1]);
  const frame = namespaces(baseDocument, kindDocument);
  const bodyAt = frame.indexOf('<w:body>') + '<w:body>'.length;
  out.file(
    DOCUMENT,
    frame.substring(0, bodyAt) + content + (section ? baseBody[1].substring(section[0], section[1]) : '') + '</w:body></w:document>',
  );
  out.file(RELS, rels.replace('</Relationships>', added + '</Relationships>'));
  out.file(TYPES, types);
  return out.generateAsync({ type: 'blob' });
}

// --- parts ---

async function load(Zip: typeof JSZip, file: Blob, code: string): Promise<JSZip> {
  try {
    const zip = await Zip.loadAsync(file);
    if (zip.file(DOCUMENT) && zip.file(TYPES)) return zip;
  } catch {
    // not a zip: refused below
  }
  return MockServer.fail(400, code);
}

async function text(zip: JSZip, name: string): Promise<string | null> {
  return (await zip.file(name)?.async('string')) ?? null;
}

/** The kind's body without its own page settings and header/footer references; refuses references it cannot take along. */
function body(document: string | null, rels: Map<string, Rel>): string {
  const m = document == null ? null : BODY.exec(document);
  if (!m) return MockServer.fail(400, UNSUPPORTED);
  let content = m[1];
  const section = lastSection(content);
  if (section) content = content.substring(0, section[0]) + content.substring(section[1]);
  content = content.replace(HEADER_FOOTER_REF, '');
  const problems = new Set<string>();
  for (const note of content.matchAll(NOTE_REF)) problems.add(note[1]);
  for (const id of referenced(content)) {
    const rel = rels.get(id);
    if (!rel || !(rel.type === REL_TYPE + 'image' || rel.type === REL_TYPE + 'hyperlink')) {
      problems.add(rel ? rel.type.substring(rel.type.lastIndexOf('/') + 1) : id);
    }
  }
  if (problems.size > 0) MockServer.fail(400, UNSUPPORTED, [...problems]);
  return content;
}

/** Start and end of the body's own page settings, its last child. */
function lastSection(content: string): [number, number] | null {
  const start = content.lastIndexOf('<w:sectPr');
  const end = start < 0 ? -1 : content.indexOf('</w:sectPr>', start);
  return end < 0 || content.substring(end + '</w:sectPr>'.length).trim() ? null : [start, end + '</w:sectPr>'.length];
}

function referenced(content: string): Set<string> {
  return new Set([...content.matchAll(REL_ATTRIBUTE)].map((m) => m[2]));
}

function relationships(rels: string | null): Map<string, Rel> {
  const out = new Map<string, Rel>();
  for (const [tag] of rels?.matchAll(RELATIONSHIP) ?? []) {
    out.set(attribute(tag, 'Id')!, {
      type: attribute(tag, 'Type')!,
      target: unescape(attribute(tag, 'Target') ?? ''),
      external: attribute(tag, 'TargetMode') === 'External',
    });
  }
  return out;
}

const attribute = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const unescape = (t: string) =>
  t
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function contentType(types: string, extension: string): string {
  const quoted = extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<Default\\s[^>]*Extension="${quoted}"[^>]*ContentType="([^"]+)"`, 'i').exec(types)?.[1] ?? `image/${extension}`;
}

/** `xml` with the namespace declarations of `other`'s root it lacks (the kind's parts may use more prefixes). */
function namespaces(xml: string, other: string): string {
  const root = ROOT.exec(xml);
  const otherRoot = ROOT.exec(other);
  if (!root || !otherRoot) return xml;
  const known = new Set([...root[0].matchAll(XMLNS)].map((m) => m[1]));
  let missing = '';
  for (const m of otherRoot[0].matchAll(XMLNS)) {
    if (!known.has(m[1])) {
      known.add(m[1]);
      missing += m[0];
    }
  }
  const close = root.index + root[0].length - (root[0].endsWith('/>') ? 2 : 1);
  return xml.substring(0, close) + missing + xml.substring(close);
}

function rootEnd(xml: string): number {
  const root = ROOT.exec(xml);
  return root ? root.index + root[0].length : 0;
}

const ids = (p: RegExp, xml: string) => new Set([...xml.matchAll(p)].map((m) => m[1]));
const numIds = (xml: string) => [...xml.matchAll(NUM_ID)].map((m) => m[2]);
const max = (p: RegExp, xml: string) => Math.max(0, ...[...ids(p, xml)].map(Number));

/** Adds `offset` to the number in group 2 (0 = no list stays 0). */
function shift(p: RegExp, xml: string, offset: number): string {
  return xml.replace(p, (all, before: string, n: string, after: string) =>
    n === '0' && p === NUM_ID ? all : `${before}${Number(n) + offset}${after}`,
  );
}
