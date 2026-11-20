// server: documents module (Catalogue, BuiltIn, DocumentHandlers) — the placeholders come from the server's snapshot
// (docs/api/document-kinds.json, copied by `npm run api:sync`), so the mock refuses the same names.
import type JSZip from 'jszip';
import kinds from '../../lib/api/document-kinds.json';
import { MockServer } from '../../lib/mock/MockServer';
import { merge, requireSupported } from '../../lib/mock/baseMerge';
import { check, fill, p, template, TemplateError, type Values } from '../../lib/mock/wordTemplate';
import type { MockDirectory } from '../../lib/mock/core';
import { ADMIN_BOARD, type Member } from '../../lib/types';
import type { SettingSlot } from './model';

interface Field {
  name: string;
  example: string | null;
  fields: Field[];
}

const INVALID = 'document.template-invalid';
const fail = MockServer.fail;

/** server: DocumentsApi.SLOTS — the base first. */
export const DOCUMENT_SLOTS: readonly SettingSlot[] = kinds.items.map((k) => k.slot as SettingSlot);

/** server: texts template.* — the name a seeded built-in gets in "Einstellungen". */
const NAMES: Readonly<Record<string, string>> = {
  DOKUMENT: 'Dokument.dotx',
  INVITATION_TEMPLATE: 'Einladung Sitzung.dotx',
  PROTOCOL_TEMPLATE: 'Protokoll Sitzung.dotx',
  AUDIT_TEMPLATE: 'Bericht Kassenprüfung.dotx',
};

const labelOf = (slot: SettingSlot) => kinds.items.find((k) => k.slot === slot)!.label;

function examples(fields: Field[]): Values {
  return Object.fromEntries(fields.map((f) => [f.name, f.fields.length ? [examples(f.fields)] : f.example]));
}

/** server: Catalogue.examples — the letterhead and the kind's fields, one item per list. */
function examplesOf(slot: SettingSlot): Values {
  return { ...examples(kinds.letterhead), ...examples(kinds.items.find((k) => k.slot === slot)!.fields) };
}

function requireDocumentSlot(slot: string): asserts slot is SettingSlot {
  if (!DOCUMENT_SLOTS.includes(slot as SettingSlot)) fail(404, 'document.kind-not-found');
}

/** server: DocumentHandlers.check — unknown placeholders and misplaced blocks with their names, bodies the base merge cannot take. */
export async function checkTemplate(Zip: typeof JSZip, slot: SettingSlot, content: Blob): Promise<void> {
  requireDocumentSlot(slot);
  let problems;
  try {
    problems = await check(Zip, content, examplesOf(slot));
  } catch (e) {
    if (e instanceof TemplateError) fail(400, INVALID);
    throw e;
  }
  if (problems.unknown.length) fail(400, 'document.placeholder-unknown', [...problems.unknown].sort());
  if (problems.blocks.length) fail(400, 'document.block-invalid', [...problems.blocks].sort());
  if (slot !== 'DOKUMENT') await requireSupported(Zip, content);
}

/** server: BuiltIn — the A4 templates an empty slot gets on first use. */
function builtIn(Zip: typeof JSZip, slot: SettingSlot): Promise<Blob> {
  const join = (...parts: string[]) => parts.join('');
  const table = (lines: boolean, ...rows: string[]) => {
    const border = lines
      ? '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" ' +
        'w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/></w:tblBorders>'
      : '';
    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${border}</w:tblPr>${rows.join('')}</w:tbl>`;
  };
  const row = (...cells: string[]) => `<w:tr>${cells.map((c) => `<w:tc>${c}</w:tc>`).join('')}</w:tr>`;
  const pair = (label: string, value: string) => row(p(null, label), p(null, value));
  const block = (name: string, ...body: string[]) => join(p(null, `{{#${name}}}`), ...body, p(null, `{{/${name}}}`));
  const none = (name: string, text: string) => join(p(null, `{{^${name}}}`), p(null, text), p(null, `{{/${name}}}`));
  switch (slot) {
    case 'DOKUMENT':
      return template(
        Zip,
        p('Title', 'Betreff') + p(null, 'Text'),
        p('Small', '{{Verein}}'),
        table(
          false,
          row(
            p('Small', '{{Verein}}') + p('Small', '{{Adresse}}'),
            p('Small', '{{Kontakt}}') + p('Small', '{{Webseite}}') + p('Small', 'Registernummer {{Registernummer}}'),
            p('Small', '{{Kontoinhaber}}') + p('Small', 'IBAN {{IBAN}}') + p('Small', 'BIC {{BIC}}'),
          ),
        ) + p('Small', '{{Dokument}} · {{Erstellt}}'),
      );
    case 'INVITATION_TEMPLATE':
      return template(
        Zip,
        join(
          p('Title', 'Einladung zur {{Art}}'),
          p('Subtitle', '{{Titel}}'),
          table(false, pair('Wann', '{{Wann}}'), pair('Ort', '{{Ort}}'), pair('Online', '{{Online}}'), pair('Dringlichkeit', '{{Dringlichkeit}}')),
          p('Heading1', 'Tagesordnung'),
          block('Punkte', p('Heading2', '{{Nummer}}. {{Titel}}'), p(null, '{{Notiz}}'), p(null, 'Antrag: {{Antrag}}')),
          none('Punkte', 'Keine Tagesordnung eingetragen.'),
          p('Small', 'Einladung versandt am {{Versandt}}.'),
        ),
      );
    case 'PROTOCOL_TEMPLATE':
      return template(
        Zip,
        join(
          p('Title', 'Protokoll der {{Art}}'),
          p('Subtitle', '{{Titel}}'),
          table(
            false,
            pair('Wann', '{{Wann}}'),
            pair('Ort', '{{Ort}}'),
            pair('Online', '{{Online}}'),
            pair('Vorsitz', '{{Vorsitz}}'),
            pair('Schriftführung', '{{Schriftführer}}'),
            pair('Anwesend', '{{Anwesend}}'),
            pair('Abwesend', '{{Abwesend}}'),
            pair('Gäste', '{{Gäste}}'),
            pair('Beschlussfähig', '{{Beschlussfähig}} ({{AnzahlAnwesend}} von {{AnzahlStimmberechtigt}} Stimmberechtigten anwesend)'),
          ),
          block(
            'Punkte',
            p('Heading1', '{{Nummer}}. {{Titel}}'),
            p(null, '{{Protokoll}}'),
            block(
              'Beschluss',
              p(null, 'Beschluss: {{Antrag}}'),
              p(null, 'Ergebnis: {{Ergebnis}}'),
              p(null, 'Abstimmung: {{Ja}} dafür, {{Nein}} dagegen, {{Enthaltung}} Enthaltungen ({{Mehrheit}}, {{Modus}})'),
            ),
          ),
          none('Punkte', 'Keine Tagesordnung eingetragen.'),
          block('Notizen', p('Heading1', 'Weitere Notizen'), p(null, '{{Notizen}}')),
          p('Heading1', 'Aufgaben'),
          table(
            true,
            row(p(null, 'Aufgabe'), p(null, 'Verantwortlich'), p(null, 'Bis')),
            row(p(null, '{{#Aufgaben}}{{Aufgabe}}'), p(null, '{{Verantwortlich}}'), p(null, '{{Bis}}{{/Aufgaben}}')),
          ),
          none('Aufgaben', 'Keine Aufgaben.'),
          block('Freigaben', p('Heading1', 'Freigabe'), p(null, '{{Freigaben}}')),
        ),
      );
    case 'AUDIT_TEMPLATE':
      return template(
        Zip,
        join(
          p('Title', 'Bericht der Kassenprüfung'),
          p('Subtitle', 'Geprüft bis {{Bis}}'),
          table(
            false,
            pair('Zeitraum', '{{Von}} bis {{Bis}}'),
            pair('Buchungen', '{{Buchungen}}'),
            pair('Einnahmen', '{{Einnahmen}}'),
            pair('Ausgaben', '{{Ausgaben}}'),
          ),
          p('Heading1', 'Kontostände am {{Bis}}'),
          table(true, row(p(null, 'Konto'), p(null, 'Stand')), row(p(null, '{{#Konten}}{{Konto}}'), p(null, '{{Stand}}{{/Konten}}'))),
          none('Konten', 'Keine Konten.'),
          p('Heading1', 'Ergebnis'),
          p(null, '{{Notiz}}'),
          p(null, 'Bestätigt von {{Prüfer}} am {{Bestätigt}}.'),
        ),
      );
    default:
      throw new Error(`No document slot: ${slot}`);
  }
}

/** What the mock documents need of the files mock (it creates this object, so no import cycle). */
export interface TemplateSource {
  settingTemplate(member: Member, slot: SettingSlot, name: string, builtIn: () => Promise<Blob>): Promise<Blob>;
}

/** server: DocumentHandlers — render and sample. */
export class MockDocuments {
  /** server: FinanceApi.BANK — the finance mock sets it (it imports the files mock). */
  bank: () => { holder: string | null; iban: string | null; bic: string | null } = () => ({ holder: null, iban: null, bic: null });

  constructor(
    private readonly templates: TemplateSource,
    private readonly people: MockDirectory,
  ) {}

  kinds(member: Member) {
    this.people.requirePrivileged(member, ADMIN_BOARD);
    return kinds;
  }

  /** server: DocumentHandlers.render — the kind on the base, letterhead and `values` filled. */
  async render(member: Member, slot: SettingSlot, values: Values): Promise<Blob> {
    const { default: Zip } = await import('jszip');
    return fill(Zip, await this.document(Zip, member, slot), { ...this.letterhead(slot, true), ...values });
  }

  /** server: DocumentHandlers.sample — the examples and the real letterhead; the base stays a template (letter paper). */
  async sample(member: Member, slot: string): Promise<Blob> {
    this.people.requirePrivileged(member, ADMIN_BOARD);
    requireDocumentSlot(slot);
    const { default: Zip } = await import('jszip');
    const base = slot === 'DOKUMENT';
    return fill(Zip, await this.document(Zip, member, slot), { ...examplesOf(slot), ...this.letterhead(slot, !base) }, !base);
  }

  private async document(Zip: typeof JSZip, member: Member, slot: SettingSlot): Promise<Blob> {
    const kind = await this.template(Zip, member, slot);
    await checkTemplate(Zip, slot, kind);
    if (slot === 'DOKUMENT') return kind;
    const base = await this.template(Zip, member, 'DOKUMENT');
    await checkTemplate(Zip, 'DOKUMENT', base);
    return merge(Zip, base, kind, INVALID);
  }

  private template(Zip: typeof JSZip, member: Member, slot: SettingSlot): Promise<Blob> {
    return this.templates.settingTemplate(member, slot, NAMES[slot], () => builtIn(Zip, slot));
  }

  private letterhead(slot: SettingSlot, titled: boolean): Values {
    const club = this.people.clubInfo();
    const today = this.people.clock.today();
    const chair = this.people.offices.data
      .filter((o) => o.office === 'CHAIR' && o.startsOn <= today && (o.endedOn == null || o.endedOn > today))
      .map((o) => this.people.displayName(o.memberId))
      .sort()
      .join(', ');
    const bank = this.bank();
    return {
      Verein: club.name,
      Kurzname: club.shortName,
      Adresse: club.address,
      Webseite: club.website,
      Kontakt: club.contactEmail,
      Registernummer: club.registerNumber,
      Vorstandsvorsitz: chair,
      Kontoinhaber: bank.holder,
      IBAN: bank.iban,
      BIC: bank.bic,
      Dokument: titled ? labelOf(slot) : null,
      Erstellt: titled ? new Intl.DateTimeFormat('de-AT', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${today}T00:00:00Z`)) : null,
    };
  }
}
