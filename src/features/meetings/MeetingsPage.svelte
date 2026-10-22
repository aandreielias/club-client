<script lang="ts">
  import { bus, commands, session } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { RecordDrag } from '../../lib/records/RecordDrag';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Empty from '../../ui/Empty.svelte';
  import Icon from '../../ui/Icon.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import CircularVotes from './CircularVotes.svelte';
  import { MEETING_CHANGED } from './events';
  import { isAssembly, KIND_LABELS, STATUS_LABELS, STATUS_TONES, type MeetingSummary } from './model';
  import { meetingPolicy as policy, meetingsApi } from './services';

  /** Mitgliederversammlungen and Vorstandssitzungen: upcoming first, then the past ones (newest first). */
  const list = new Resource(() => meetingsApi.list());
  void list.load();
  useBus(bus, MEETING_CHANGED, () => void list.load());
  const create = () => bus.publish(WINDOW_OPEN, { kind: 'meeting-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create, when: () => policy.canCreate() } });

  const now = new Date().toISOString();
  const upcoming = (all: MeetingSummary[]) => all.filter((m) => m.endsAt >= now && m.status !== 'CLOSED');
  const past = (all: MeetingSummary[]) => all.filter((m) => m.endsAt < now || m.status === 'CLOSED').reverse();
</script>

{#snippet cards(items: MeetingSummary[])}
  <ul class="cards">
    {#each items as m (m.id)}
      <li>
        <a href="#/meetings/{m.id}" ondragstart={(e) => RecordDrag.set(e, { kind: 'meeting', id: m.id, title: m.title })}>
          <span class="icon" class:board={!isAssembly(m.kind)}><Icon name="meetings" /></span>
          <span class="name">{m.title}<span class="muted small kind">{KIND_LABELS[m.kind]}</span></span>
          <span class="muted">{session.format.dateTime(m.startsAt)}</span>
          <Tag tone={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status]}</Tag>
        </a>
      </li>
    {/each}
  </ul>
{/snippet}

<Page title="Sitzungen">
  {#snippet actions()}
    {#if policy.canCreate()}<Button variant="primary" icon="add" onclick={create}>Neue Sitzung</Button>{/if}
  {/snippet}

  <AsyncView resource={list}>
    {#snippet children(all)}
      {#if all.length}
        {#if upcoming(all).length}{@render cards(upcoming(all))}{:else}<p class="muted">Keine Sitzung geplant.</p>{/if}
        {#if past(all).length}
          <h2>Vergangen</h2>
          {@render cards(past(all))}
        {/if}
      {:else}
        <Empty text="Noch keine Sitzung. Mitgliederversammlungen sehen die stimmberechtigten Mitglieder, Vorstandssitzungen nur der Vorstand."
          action={policy.canCreate() ? { label: 'Neue Sitzung', icon: 'add', run: create } : null} />
      {/if}
    {/snippet}
  </AsyncView>

  {#if policy.canCreate()}<CircularVotes />{/if}
</Page>

<style>
  .cards {
    display: grid;
    gap: var(--space-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .cards a {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: inherit;
    text-decoration: none;
    transition: border-color var(--motion-fast) var(--motion-easing), background var(--motion-fast) var(--motion-easing);
  }
  .cards a:hover {
    border-color: var(--color-border-strong);
    background: var(--color-hover);
  }
  .icon {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }
  .icon.board {
    background: var(--color-tag-purple-bg);
    color: var(--color-tag-purple-text);
  }
  .name {
    display: grid;
    overflow: hidden;
    font-weight: var(--font-weight-medium);
  }
  .name,
  .kind {
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    overflow: hidden;
    font-weight: normal;
  }
  :global(:root[data-layout='compact']) .cards a {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  :global(:root[data-layout='compact']) .cards > li > a > .muted {
    display: none;
  }
</style>
