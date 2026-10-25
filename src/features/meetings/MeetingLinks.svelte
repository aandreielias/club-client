<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import LinkList from './LinkList.svelte';
  import type { MeetingModel } from './MeetingModel.svelte';
  import type { Meeting } from './model';

  /** Documents and records of a meeting, and its invitation as a Word document from the template. */
  let { meeting, model }: { meeting: Meeting; model: MeetingModel } = $props();

  /** server: AgendaDocument.PLACEHOLDERS */
  const PLACEHOLDERS = ['Verein', 'Art', 'Titel', 'Wann', 'Ort', 'Video', 'Dringlichkeit', 'Tagesordnung', 'Versandt']
    .map((name) => `{{${name}}}`).join(', ');

  async function invitation() {
    if (await model.generateInvitation()) bus.publish(TOAST, { text: 'Einladung im Sitzungsordner gespeichert und verknüpft.' });
  }
</script>

<LinkList links={meeting.links} canEdit={meeting.canManage} busy={model.action.busy} self={{ kind: 'meeting', id: meeting.id }}
  save={(refs) => model.setLinks(refs)}>
  {#snippet actions()}
    <Button size="sm" icon="document" busy={model.action.busy} onclick={invitation}>Einladung als Word-Dokument</Button>
  {/snippet}
</LinkList>
{#if meeting.canManage}
  <p class="muted small">
    Das Layout kommt aus der Vorlage „Einladung Sitzung.dotx“ im Ordner „Vorlagen“; zum Ändern eine neue Version hochladen.
    Platzhalter: {PLACEHOLDERS}. Absätze mit leerem Platzhalter entfallen, der Absatz mit {'{{Tagesordnung}}'} wiederholt sich pro Punkt.
  </p>
{:else if !meeting.links.length}
  <p class="muted">Nichts verknüpft.</p>
{/if}
