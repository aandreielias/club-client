// The invitation's Word template and filling, for the mock (server: meetings.domain.AgendaDocument, same layout and rules).
import type JSZip from 'jszip';

export const TEMPLATE_NAME = 'Einladung Sitzung.dotx';
const TEMPLATE_TYPE = 'wordprocessingml.template.main+xml';
const DOCUMENT_TYPE = 'wordprocessingml.document.main+xml';
const AGENDA = 'Tagesordnung';

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescape = (xml: string) => xml.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const p = (style: string | null, text: string) =>
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
const DOCUMENT_START = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`;
/** A4 portrait. */
const SECTION = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';

/** server: AgendaDocument.defaultTemplate */
export async function defaultTemplate(Zip: typeof JSZip): Promise<Blob> {
  const zip = new Zip();
  const body = [p('Small', '{{Verein}}'), p('Title', 'Einladung zur {{Art}}'), p('Subtitle', '{{Titel}}'), p(null, 'Wann: {{Wann}}'), p(null, 'Wo: {{Ort}}'),
    p(null, 'Videokonferenz: {{Video}}'), p(null, 'Grund der Dringlichkeit: {{Dringlichkeit}}'), p('Heading1', 'Tagesordnung'),
    p('ListParagraph', '{{Tagesordnung}}'), p('Small', 'Einladung versandt am {{Versandt}}.')].join('');
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
  zip.file('word/styles.xml', STYLES);
  zip.file('word/document.xml', `${DOCUMENT_START}${body}${SECTION}</w:body></w:document>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' });
}

/** server: AgendaDocument.fillParagraph — empty known placeholders drop the paragraph, the agenda paragraph repeats, unknown ones stay. */
function fillParagraph(paragraph: string, values: Record<string, string | null>, agenda: readonly string[]): string {
  const text = [...paragraph.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => unescape(m[1])).join('');
  if (!/\{\{\s*\p{L}+\s*\}\}/u.test(text)) return paragraph;
  const lines = text.includes(`{{${AGENDA}}}`) ? agenda : [''];
  const props = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(paragraph);
  const run = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(props ? paragraph.slice(props.index + props[0].length) : paragraph);
  return lines.map((line) => {
    let missing = false;
    const filled = text.replace(/\{\{\s*(\p{L}+)\s*\}\}/gu, (whole, name: string) => {
      if (name === AGENDA) return line;
      if (!(name in values)) return whole;
      const value = values[name];
      if (!value?.trim()) missing = true;
      return value ?? '';
    });
    return missing ? '' : `<w:p>${props?.[0] ?? ''}<w:r>${run?.[0] ?? ''}<w:t xml:space="preserve">${escape(filled)}</w:t></w:r></w:p>`;
  }).join('');
}

/** server: AgendaDocument.fill — the template's parts with placeholders filled, saved as a document. */
export async function fill(Zip: typeof JSZip, template: Blob, values: Record<string, string | null>, agenda: readonly string[]): Promise<Blob> {
  const zip = await Zip.loadAsync(template);
  for (const name of Object.keys(zip.files)) {
    if (name === '[Content_Types].xml') zip.file(name, (await zip.file(name)!.async('string')).replace(TEMPLATE_TYPE, DOCUMENT_TYPE));
    else if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) {
      const xml = await zip.file(name)!.async('string');
      zip.file(name, xml.replace(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g, (para) => fillParagraph(para, values, agenda)));
    }
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
