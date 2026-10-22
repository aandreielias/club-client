<script lang="ts">
  import { backStack, bus, permissions } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { RefList } from '../../lib/records/RefList.svelte';
  import { DROPPABLE, REF_ICONS, refWindow } from '../../lib/records/refs';
  import Button from '../../ui/Button.svelte';
  import Icon from '../../ui/Icon.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import RefPicker from '../../ui/RefPicker.svelte';
  import { recordDrop } from '../../ui/recordDrop';
  import { kindLabel } from '../search/model';
  import type { MeetingModel } from './MeetingModel.svelte';
  import type { Meeting } from './model';

  /** Files, people, appointments and other records belonging to a meeting; who runs it edits the list. */
  let { meeting, model }: { meeting: Meeting; model: MeetingModel } = $props();

  /** server: MeetingHandlers.MAX_LINKS */
  const MAX_LINKS = 30;
  let draft = $state<RefList | null>(null);
  backStack.while(() => draft !== null, () => (draft = null));

  const allowed = (kind: string, id: string) => kind !== 'MEMBER' || permissions.canSeeMember(id);

  async function save() {
    if (!draft) return;
    if (await model.setLinks(draft.refs.filter((r) => r.id !== meeting.id))) {
      draft = null;
      bus.publish(TOAST, { text: 'Verknüpfungen gespeichert.' });
    }
  }

  async function invitation() {
    if (await model.generateInvitation()) bus.publish(TOAST, { text: 'Einladung im Sitzungsordner gespeichert und verknüpft.' });
  }

  function drop(record: { kind: string; id: string; title: string }) {
    if (record.kind === 'meeting' && record.id === meeting.id) return;
    if (!draft?.addRecord(record)) bus.publish(TOAST, { text: `„${record.title}“ lässt sich hier nicht verknüpfen.` });
  }
</script>

{#if draft}
  <div class="stack" {@attach recordDrop(Object.keys(DROPPABLE), drop)}>
    <RefPicker form={draft} label="Dateien, Personen, Termine und mehr" />
    <div class="row">
      <Button variant="primary" busy={model.action.busy} onclick={save}>Verknüpfungen speichern</Button>
      <Button variant="ghost" onclick={() => (draft = null)}>Abbrechen</Button>
    </div>
  </div>
{:else}
  {#if meeting.links.length}
    <ul class="refs">
      {#each meeting.links as ref (`${ref.kind}:${ref.id}`)}
        {@const target = refWindow(ref)}
        <li>
          <Icon name={REF_ICONS[ref.kind]} small />
          <span class="muted kind">{kindLabel(ref.kind)}</span>
          <RecordLink kind={target.kind} id={target.id} allowed={allowed(ref.kind, ref.id)}>{ref.title}</RecordLink>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">Nichts verknüpft.</p>
  {/if}
  {#if meeting.canManage}
    <div class="row">
      <Button size="sm" icon="document" busy={model.action.busy} onclick={invitation}>Einladung als Word-Dokument</Button>
      <Button size="sm" icon="link" onclick={() => (draft = new RefList(MAX_LINKS, meeting.links))}>Verknüpfungen bearbeiten</Button>
    </div>
  {/if}
{/if}

<style>
  .refs {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .refs li {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  }
  .kind {
    min-width: 5.5rem;
    font-size: var(--font-size-small);
  }
</style>
