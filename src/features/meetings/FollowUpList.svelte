<script lang="ts">
  import { session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Tag from '../../ui/Tag.svelte';
  import FollowUpAddDialog from './FollowUpAddDialog.svelte';
  import { waitingText } from './followUpText';
  import type { FollowUp, NewFollowUp, Person } from './model';

  /** The tasks of a meeting or resolution in order, each opening its task; who runs the meeting adds more in a dialog. */
  let {
    followUps,
    canAdd,
    candidates,
    contextTitle,
    add,
  }: {
    followUps: readonly FollowUp[];
    canAdd: boolean;
    /** Who may take the task: those present. */
    candidates: readonly Person[];
    /** The resolution's or meeting's title, for templates. */
    contextTitle: string;
    add: (f: NewFollowUp) => Promise<boolean>;
  } = $props();

  let adding = $state(false);
</script>

{#if followUps.length}
  <ol class="follow-ups">
    {#each followUps as f (f.id)}
      {@const waiting = waitingText(f, followUps)}
      <li class:chained={!!f.waitsFor}>
        {#if f.taskId}<RecordLink kind="task" id={f.taskId}>{f.title}</RecordLink>{:else}<span>{f.title}</span>{/if}
        {#if f.taskStatus === 'DONE'}<Tag tone="green">Erledigt</Tag>{:else if waiting}<Tag tone="gray">Wartet</Tag>{:else if f.taskStatus}<Tag
            tone="orange">Offen</Tag
          >{/if}
        {#if waiting}<span class="muted small">{waiting}</span>{/if}
        {#if f.dueAt && f.taskStatus !== 'DONE'}<span class="muted small">bis {session.format.date(session.clock.localDate(f.dueAt))}</span>{/if}
        {#if f.automatic && f.taskStatus !== 'DONE'}<span class="muted small">erledigt sich beim Eintragen</span>{/if}
      </li>
    {/each}
  </ol>
{/if}

{#if canAdd}
  <div><Button size="sm" icon="add" onclick={() => (adding = true)}>Aufgabe hinzufügen</Button></div>
  <FollowUpAddDialog open={adding} {contextTitle} {candidates} {followUps} {add} onclose={() => (adding = false)} />
{/if}

<style>
  .follow-ups {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .follow-ups li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
  }
  .follow-ups li.chained {
    margin-left: var(--space-md);
    padding-left: var(--space-md);
    border-left: 2px solid var(--color-border-strong);
  }
</style>
