<script lang="ts">
  import { TOAST } from '../../channels';
  import { bus } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import InfoTip from '../../ui/InfoTip.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import SettingFilesSection from '../files/SettingFilesSection.svelte';
  import { meetingsApi } from './services';

  /** Einstellungen › Vorlagen (admin/board): the Word templates of the invitation, protocol and Kassenprüfung documents. */
  const LETTERHEAD = ['Verein', 'Adresse', 'Webseite', 'Kontakt', 'Registernummer', 'Sitzung'];
  // server: AgendaDocument (invitation and protocol), AuditReport (Kassenprüfung)
  const SLOTS = [
    {
      slot: 'INVITATION_TEMPLATE',
      label: 'Einladung',
      hint:
        'Platzhalter: ' +
        [...LETTERHEAD, 'Art', 'Titel', 'Wann', 'Ort', 'Video', 'Dringlichkeit', 'Tagesordnung', 'Versandt'].map((p) => `{{${p}}}`).join(', '),
    },
    {
      slot: 'PROTOCOL_TEMPLATE',
      label: 'Protokoll',
      hint:
        'Platzhalter: ' +
        [
          ...LETTERHEAD,
          'Art',
          'Titel',
          'Wann',
          'Ort',
          'Anwesend',
          'Beschlussfähig',
          'Agenda',
          'Beschlüsse',
          'Vorsitz',
          'Schriftführer',
          'Tagesordnung',
        ]
          .map((p) => `{{${p}}}`)
          .join(', '),
    },
    {
      slot: 'AUDIT_TEMPLATE',
      label: 'Kassenprüfung',
      hint:
        'Platzhalter: ' +
        [...LETTERHEAD.slice(0, 5), 'Von', 'Bis', 'Buchungen', 'Einnahmen', 'Ausgaben', 'Konten', 'Notiz', 'Prüfer', 'Datum']
          .map((p) => `{{${p}}}`)
          .join(', '),
    },
  ] as const;

  const seed = new Action();
  async function seedTemplates() {
    if (await seed.run(() => meetingsApi.seedTemplates())) bus.publish(TOAST, { text: 'Leere Vorlagen mit dem Standard belegt.' });
  }

  const INTRO =
    'Word-Vorlagen (.dotx) für die Einladung und das Protokoll einer Sitzung und den Bericht der Kassenprüfung. Aus Dateien gewählt, liegt eine Kopie ' +
    'im geschützten Ordner „Einstellungen“; neue Versionen des Originals werden übernommen. Absätze mit leerem Platzhalter entfallen, eine ' +
    'Tabellenzeile mit nur leeren Platzhaltern auch; der Absatz mit {{Tagesordnung}} (beim Prüfbericht {{Konten}}) wiederholt sich pro Zeile. ' +
    'Eine leere Vorlage bekommt beim ersten Gebrauch den Standard.';
</script>

<section class="panel stack" aria-label="Vorlagen">
  <h2>Vorlagen&nbsp;<InfoTip text={INTRO} /></h2>
  <SettingFilesSection slots={SLOTS} />
  <div class="row">
    <Button busy={seed.busy} tooltip="Leere Vorlagen mit dem eingebauten A4-Layout belegen" onclick={seedTemplates}>Standardvorlagen anlegen</Button>
    <ErrorNote error={seed.error} />
  </div>
</section>
