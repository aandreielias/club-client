<script lang="ts">
  import { session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Tag from '../../ui/Tag.svelte';
  import MemberChips from './MemberChips.svelte';
  import type { FollowUp, NewFollowUp, Person } from './model';

  /** The tasks of a meeting or resolution, each opening its task; who runs the meeting adds more by hand. */
  let { followUps, canAdd, candidates, add }: {
    followUps: readonly FollowUp[];
    canAdd: boolean;
    /** Who may take the task: those present. */
    candidates: readonly Person[];
    add: (f: NewFollowUp) => Promise<boolean>;
  } = $props();

  const action = new Action();
  let open = $state(false);
  let title = $state('');
  let assignees = $state<string[]>([]);
  let due = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const followUp = { title: title.trim(), description: null, assigneeIds: assignees, dueAt: due ? session.clock.toInstant(`${due}T18:00`) : null };
    if (await action.run(() => add(followUp).then((ok) => ok || Promise.reject(new Error('Nicht gespeichert.'))))) {
      title = '';
      assignees = [];
      due = '';
      open = false;
    }
  }
</script>

{#if followUps.length}
  <ul class="follow-ups">
    {#each followUps as f (f.id)}
      <li>
        {#if f.taskId}<RecordLink kind="task" id={f.taskId}>{f.title}</RecordLink>{:else}<span>{f.title}</span>{/if}
        {#if f.taskStatus === 'DONE'}<Tag tone="green">Erledigt</Tag>{:else if f.taskStatus}<Tag tone="orange">Offen</Tag>{/if}
        {#if f.dueAt && f.taskStatus !== 'DONE'}<span class="muted small">bis {session.format.date(session.clock.localDate(f.dueAt))}</span>{/if}
        {#if f.automatic && f.taskStatus !== 'DONE'}<span class="muted small">erledigt sich beim Eintragen</span>{/if}
      </li>
    {/each}
  </ul>
{/if}

{#if canAdd}
  {#if open}
    <form class="stack add" onsubmit={submit}>
      <Field label="Aufgabe">
        <input bind:value={title} maxlength="150" required />
      </Field>
      <MemberChips bind:value={assignees} {candidates} label="Verantwortlich" placeholder="Verantwortlich (leer = Vorstand)" />
      <Field label="Fällig (optional)">
        <input type="date" bind:value={due} />
      </Field>
      <ErrorNote error={action.error} />
      <div class="row">
        <Button type="submit" variant="primary" busy={action.busy} disabled={!title.trim()}>Aufgabe anlegen</Button>
        <Button variant="ghost" onclick={() => (open = false)}>Abbrechen</Button>
      </div>
    </form>
  {:else}
    <div><Button size="sm" icon="add" onclick={() => (open = true)}>Aufgabe hinzufügen</Button></div>
  {/if}
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
  .add {
    margin-top: var(--space-sm);
  }
</style>
