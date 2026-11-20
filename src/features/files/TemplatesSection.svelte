<script lang="ts">
  import { BrowserFile } from '../../lib/files/BrowserFile';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import InfoTip from '../../ui/InfoTip.svelte';
  import type { DocumentField, SettingSlot } from './model';
  import { filesApi } from './services';
  import SettingFilesSection from './SettingFilesSection.svelte';

  /** Einstellungen › Vorlagen (admin/board): the Word templates of the documents; their placeholders come from the server's catalogue. */
  const kinds = new Resource(() => filesApi.documentKinds());
  void kinds.load();

  function lines(fields: DocumentField[], indent = ''): string[] {
    return fields.flatMap((f) =>
      f.fields.length
        ? [`${indent}{{#${f.name}}} … {{/${f.name}}}: ${f.description}`, ...lines(f.fields, `${indent}   `)]
        : [`${indent}{{${f.name}}}: ${f.description}`],
    );
  }

  const slots = $derived(
    kinds.value?.items.map(({ slot, label, fields }) => ({
      slot,
      label,
      info:
        slot === 'DOKUMENT'
          ? ['Kopf- und Fußzeile, Formatvorlagen und Seite aller Dokumente. Platzhalter:', ...lines(kinds.value!.letterhead)].join('\n')
          : ['Nur der Inhalt; Kopf, Fuß und Formate kommen vom Briefpapier. Platzhalter (dazu die des Briefpapiers):', ...lines(fields)].join('\n'),
    })) ?? [],
  );

  const sample = new Action();
  async function download(slot: SettingSlot) {
    const label = slots.find((s) => s.slot === slot)?.label ?? slot;
    const name = slot === 'DOKUMENT' ? `${label}.dotx` : `${label}.docx`;
    await sample.run(async () => BrowserFile.save(await filesApi.documentSample(slot), name));
  }

  const INTRO =
    'Word-Vorlagen (.dotx). Das Briefpapier gibt allen Dokumenten Kopf, Fuß und Formate; Einladung, Protokoll und Kassenprüfung bringen nur ' +
    'ihren Inhalt. Aus Dateien gewählt, liegt eine Kopie im geschützten Ordner „Einstellungen“; neue Versionen des Originals werden übernommen. ' +
    'Unbekannte Platzhalter werden abgelehnt.\n' +
    '{{Name}} setzt einen Wert ein; ein leerer Wert lässt seinen Absatz entfallen. {{#Liste}} … {{/Liste}} wiederholt den Inhalt pro Eintrag ' +
    '(in einer Tabellenzeile: die Zeile), bei einem Text nur wenn er gesetzt ist; {{^Liste}} … {{/Liste}} gilt, wenn sie leer ist. ' +
    'Eine leere Vorlage bekommt beim ersten Gebrauch den Standard.';
</script>

<section class="panel stack" aria-label="Vorlagen">
  <h2>Vorlagen&nbsp;<InfoTip text={INTRO} /></h2>
  <SettingFilesSection {slots}>
    {#snippet extra(slot)}
      <Button
        icon="download"
        busy={sample.busy}
        tooltip={slot === 'DOKUMENT' ? 'Briefpapier herunterladen' : 'Vorlage testen (mit Beispielwerten)'}
        onclick={() => download(slot)}
      />
    {/snippet}
  </SettingFilesSection>
  <ErrorNote error={sample.error ?? kinds.error} />
</section>
