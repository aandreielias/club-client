// The invitation and protocol Word templates for the mock (server: meetings.domain.AgendaDocument, same layout).
import type JSZip from 'jszip';
import { fill as fillTemplate, p, template } from '../../lib/mock/wordTemplate';

export const TEMPLATE_NAME = 'Einladung Sitzung.dotx';
export const PROTOCOL_TEMPLATE_NAME = 'Protokoll Sitzung.dotx';
const AGENDA = 'Tagesordnung';

/** server: AgendaDocument.renderProtocol — the built-in protocol layout; the text repeats line by line. */
export async function protocolTemplate(Zip: typeof JSZip): Promise<Blob> {
  return template(
    Zip,
    [
      p('Small', '{{Verein}}'),
      p('Title', 'Protokoll der {{Art}}'),
      p('Subtitle', '{{Titel}}'),
      p(null, 'Wann: {{Wann}}'),
      p(null, 'Wo: {{Ort}}'),
      p(null, 'Vorsitz: {{Vorsitz}}'),
      p(null, 'Schriftführung: {{Schriftführer}}'),
      p(null, 'Anwesend: {{Anwesend}}'),
      p(null, 'Beschlussfähig: {{Beschlussfähig}}'),
      p(null, 'Tagesordnung: {{Agenda}}'),
      p(null, 'Beschlüsse: {{Beschlüsse}}'),
      p('Heading1', 'Protokoll'),
      p(null, '{{Tagesordnung}}'),
    ].join(''),
  );
}

/** server: AgendaDocument.defaultTemplate */
export async function defaultTemplate(Zip: typeof JSZip): Promise<Blob> {
  return template(
    Zip,
    [
      p('Small', '{{Verein}}'),
      p('Title', 'Einladung zur {{Art}}'),
      p('Subtitle', '{{Titel}}'),
      p(null, 'Wann: {{Wann}}'),
      p(null, 'Wo: {{Ort}}'),
      p(null, 'Videokonferenz: {{Video}}'),
      p(null, 'Grund der Dringlichkeit: {{Dringlichkeit}}'),
      p('Heading1', 'Tagesordnung'),
      p('ListParagraph', '{{Tagesordnung}}'),
      p('Small', 'Einladung versandt am {{Versandt}}.'),
    ].join(''),
  );
}

/** The agenda (or protocol text) paragraph repeats per line. */
export const fill = (Zip: typeof JSZip, template: Blob, values: Record<string, string | null>, agenda: readonly string[]): Promise<Blob> =>
  fillTemplate(Zip, template, values, AGENDA, agenda);
