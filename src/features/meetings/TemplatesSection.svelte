<script lang="ts">
  import { TOAST } from '../../channels';
  import { bus } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import SettingFilesSection from '../files/SettingFilesSection.svelte';
  import { meetingsApi } from './services';

  /** Einstellungen › Vorlagen (admin/board): the Word templates of the invitation and protocol documents. */
  const LETTERHEAD = ['Verein', 'Adresse', 'Webseite', 'Kontakt', 'Registernummer', 'Sitzung'];
  // server: AgendaDocument (invitation and protocol)
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
  ] as const;

  const seed = new Action();
  async function seedTemplates() {
    if (await seed.run(() => meetingsApi.seedTemplates())) bus.publish(TOAST, { text: 'Leere Vorlagen mit dem Standard belegt.' });
  }
</script>

<section class="panel stack" aria-label="Vorlagen">
  <header>
    <h2>Vorlagen</h2>
    <p class="muted small">
      Word-Vorlagen (.dotx) für die Einladung und das Protokoll einer Sitzung. Aus Dateien gewählt, liegt eine Kopie im geschützten Ordner
      „Einstellungen“; neue Versionen des Originals werden übernommen. Absätze mit leerem Platzhalter entfallen, eine Tabellenzeile mit nur leeren
      Platzhaltern auch; der Absatz mit {'{{Tagesordnung}}'} wiederholt sich pro Zeile.
    </p>
  </header>
  <SettingFilesSection slots={SLOTS} />
  <div class="row">
    <Button busy={seed.busy} tooltip="Leere Vorlagen mit dem eingebauten A4-Layout belegen" onclick={seedTemplates}>Standardvorlagen anlegen</Button>
    <ErrorNote error={seed.error} />
  </div>
</section>
