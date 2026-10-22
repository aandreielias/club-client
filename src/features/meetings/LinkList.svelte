<script lang="ts">
  import type { Snippet } from 'svelte';
  import { backStack, bus, permissions } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { RefList } from '../../lib/records/RefList.svelte';
  import { DROPPABLE, REF_ICONS, refWindow, type LinkedRef, type RefKind } from '../../lib/records/refs';
  import Button from '../../ui/Button.svelte';
  import Icon from '../../ui/Icon.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import RefPicker from '../../ui/RefPicker.svelte';
  import { recordDrop } from '../../ui/recordDrop';
  import { kindLabel } from '../search/model';

  /**
   * Records linked to a meeting or resolution (files, people, appointments, ...); who runs it edits the list by search or drag and drop.
   * `self`: the record itself, which cannot link itself. `actions`: more buttons next to "Verknüpfungen bearbeiten".
   */
  let {
    links,
    canEdit,
    busy = false,
    self,
    save,
    actions,
  }: {
    links: readonly LinkedRef[];
    canEdit: boolean;
    busy?: boolean;
    self?: { kind: string; id: string };
    save: (refs: { kind: RefKind; id: string }[]) => Promise<boolean>;
    actions?: Snippet;
  } = $props();

  /** server: MAX_LINKS of meetings and resolutions */
  const MAX_LINKS = 30;
  let draft = $state<RefList | null>(null);
  backStack.while(() => draft !== null, () => (draft = null));

  const allowed = (kind: string, id: string) => kind !== 'MEMBER' || permissions.canSeeMember(id);

  async function submit() {
    if (!draft) return;
    if (await save(draft.refs.filter((r) => !(self && r.kind.toLowerCase() === self.kind && r.id === self.id)))) {
      draft = null;
      bus.publish(TOAST, { text: 'Verknüpfungen gespeichert.' });
    }
  }

  function drop(record: { kind: string; id: string; title: string }) {
    if (self && record.kind === self.kind && record.id === self.id) return;
    if (!draft?.addRecord(record)) bus.publish(TOAST, { text: `„${record.title}“ lässt sich hier nicht verknüpfen.` });
  }
</script>

{#if draft}
  <div class="stack" {@attach recordDrop(Object.keys(DROPPABLE), drop)}>
    <RefPicker form={draft} label="Dateien, Personen, Termine und mehr" />
    <div class="row">
      <Button variant="primary" {busy} onclick={submit}>Verknüpfungen speichern</Button>
      <Button variant="ghost" onclick={() => (draft = null)}>Abbrechen</Button>
    </div>
  </div>
{:else}
  {#if links.length}
    <ul class="refs">
      {#each links as ref (`${ref.kind}:${ref.id}`)}
        {@const target = refWindow(ref)}
        <li>
          <Icon name={REF_ICONS[ref.kind]} small />
          <span class="muted kind">{kindLabel(ref.kind)}</span>
          <RecordLink kind={target.kind} id={target.id} allowed={allowed(ref.kind, ref.id)}>{ref.title}</RecordLink>
        </li>
      {/each}
    </ul>
  {:else if canEdit}
    <p class="muted small">Nichts verknüpft.</p>
  {/if}
  {#if canEdit}
    <div class="row">
      {@render actions?.()}
      <Button size="sm" icon="link" onclick={() => (draft = new RefList(MAX_LINKS, links))}>Verknüpfungen bearbeiten</Button>
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
