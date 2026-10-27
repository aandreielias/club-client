<script lang="ts">
  import { bus, commands, session } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Empty from '../../ui/Empty.svelte';
  import Page from '../../ui/Page.svelte';
  import RecordCards, { type RecordCard } from '../../ui/RecordCards.svelte';
  import CircularVotes from './CircularVotes.svelte';
  import { MEETING_CHANGED } from './events';
  import { isAssembly, STATUS_LABELS, STATUS_TONES, type MeetingSummary } from './model';
  import { meetingPolicy as policy, meetingsApi, meetingTypes } from './services';

  /** Mitgliederversammlungen and Vorstandssitzungen: upcoming first, then the past ones (newest first). */
  const list = new Resource(() => meetingsApi.list());
  void list.load();
  useBus(bus, MEETING_CHANGED, () => void list.load());
  const create = () => bus.publish(WINDOW_OPEN, { kind: 'meeting-new', id: '-' });
  useCommands(commands, { 'page.new': { run: create, when: () => policy.canCreate() } });

  const now = new Date().toISOString();
  const upcoming = (all: MeetingSummary[]) => all.filter((m) => m.endsAt >= now && m.status !== 'CLOSED');
  const past = (all: MeetingSummary[]) => all.filter((m) => m.endsAt < now || m.status === 'CLOSED').reverse();
  const card = (m: MeetingSummary): RecordCard => ({
    href: `#/meetings/${m.id}`, record: { kind: 'meeting', id: m.id, title: m.title }, icon: 'meetings', altIcon: !isAssembly(meetingTypes.get(m.kind)),
    detail: meetingTypes.label(m.kind), meta: session.format.dateTime(m.startsAt), tag: { tone: STATUS_TONES[m.status], label: STATUS_LABELS[m.status] },
  });
</script>

<Page title="Sitzungen">
  {#snippet actions()}
    {#if policy.canCreate()}<Button variant="primary" icon="add" onclick={create}>Neue Sitzung</Button>{/if}
  {/snippet}

  <AsyncView resource={list}>
    {#snippet children(all)}
      {#if all.length}
        {#if upcoming(all).length}<RecordCards cards={upcoming(all).map(card)} />{:else}<p class="muted">Keine Sitzung geplant.</p>{/if}
        {#if past(all).length}
          <h2>Vergangen</h2>
          <RecordCards cards={past(all).map(card)} />
        {/if}
      {:else}
        <Empty text="Noch keine Sitzung. Mitgliederversammlungen sehen die stimmberechtigten Mitglieder, Vorstandssitzungen nur der Vorstand."
          action={policy.canCreate() ? { label: 'Neue Sitzung', icon: 'add', run: create } : null} />
      {/if}
    {/snippet}
  </AsyncView>

  {#if policy.canCreate()}<CircularVotes />{/if}
</Page>
