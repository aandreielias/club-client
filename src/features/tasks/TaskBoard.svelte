<script lang="ts">
  import { bus, directory, store } from '../../lib/container';
  import { WINDOW_OPEN } from '../../channels';
  import { attempt } from '../../lib/actions/RecordActions';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { usePane } from '../../lib/split/usePane';
  import { menu, recordMenu } from '../../ui/contextMenu';
  import { tooltip } from '../../ui/tooltip';
  import ListToolbar from '../../ui/ListToolbar.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { TASK_CHANGED } from './events';
  import { priorityLabel, TASK_PRIORITIES, type Task, type TaskPriority, type TaskStage } from './model';
  import TaskDue from './TaskDue.svelte';
  import { TaskListModel } from './TaskListModel.svelte';
  import { taskLabels, taskPolicy, taskStages, tasksApi } from './services';

  /** Kanban view of Aufgaben: one column per club status, cards dragged between columns change it; rows group by person, team or priority. */
  const list = new TaskListModel(tasksApi, taskPolicy, directory, store, true);
  void list.load();
  useBus(bus, TASK_CHANGED, () => void list.load());

  const TYPE = 'application/x-club-task';
  let over = $state<string | null>(null);

  type Grouping = '' | 'person' | 'team' | 'priority';
  const GROUPINGS: { value: Grouping; label: string }[] = [
    { value: '', label: 'Nicht gruppiert' },
    { value: 'person', label: 'Nach Person' },
    { value: 'team', label: 'Nach Team' },
    { value: 'priority', label: 'Nach Priorität' },
  ];
  const pane = usePane();
  const grouping = $derived(GROUPINGS.find((g) => g.value === pane.query.get('group'))?.value ?? '');

  // Archived statuses stay as columns while tasks stand in them.
  const columns = $derived(taskStages.items.filter((s) => !s.archived || list.rows.some((t) => t.stage === s.key)));

  /** The rows of the board; a task with several assignees appears in each person's row. */
  const lanes = $derived.by((): { key: string; label: string; tasks: Task[] }[] => {
    const rows = list.rows;
    if (grouping === 'priority') {
      return [...TASK_PRIORITIES].reverse().map((p) => ({ key: p.value, label: p.label, tasks: rows.filter((t) => t.priority === p.value) }));
    }
    if (grouping === 'person' || grouping === 'team') {
      const keysOf = (t: Task) => (grouping === 'person' ? (t.assignees.length ? t.assignees : ['']) : [t.teamId ?? '']);
      const keys = [...new Set(rows.flatMap(keysOf))];
      const label = (key: string) =>
        grouping === 'person' ? (key ? directory.nameOf(key) : 'Niemand zugewiesen') : key ? (directory.teamName(key) ?? 'Team') : 'Ohne Team';
      return keys
        .map((key) => ({ key, label: label(key), tasks: rows.filter((t) => keysOf(t).includes(key)) }))
        .sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || a.label.localeCompare(b.label, 'de'));
    }
    return [{ key: '', label: '', tasks: rows }];
  });

  /** The card being dragged and the row it came from (a task with several assignees sits in several rows). */
  let dragging: { task: Task; lane: string } | null = null;

  function dragStart(event: DragEvent, task: Task, lane: string) {
    dragging = { task, lane };
    event.dataTransfer?.setData(TYPE, task.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /**
   * What a drop into another row changes: the priority, or the person (the row's person replaces the one dragged from).
   * Teams stay (a task's team is fixed) and nobody is dropped into "Niemand zugewiesen" (a task keeps an assignee).
   */
  function lanePatch(task: Task, from: string, to: string): Partial<Pick<Task, 'priority' | 'assignees'>> | null | undefined {
    if (!grouping || from === to) return null;
    if (!taskPolicy.canManage(task)) return undefined;
    if (grouping === 'priority') return { priority: to as TaskPriority };
    if (grouping === 'person' && to) return { assignees: [...new Set([...task.assignees.filter((id) => id !== from), to])] };
    return undefined;
  }

  function dragOver(event: DragEvent, lane: string, cell: string) {
    if (!dragging || !event.dataTransfer?.types.includes(TYPE) || lanePatch(dragging.task, dragging.lane, lane) === undefined) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    over = cell;
  }

  async function drop(event: DragEvent, lane: string, stage: TaskStage) {
    over = null;
    const from = dragging;
    dragging = null;
    if (!from) return;
    const task = from.task;
    const patch = lanePatch(task, from.lane, lane);
    if (patch === undefined || (!patch && task.stage === stage.key)) return;
    event.preventDefault();
    // Optimistic: the card moves at once, takes the server's answer, and goes back when a write fails.
    const replace = (next: Task) => list.set((list.data.value ?? []).map((t) => (t.id === next.id ? next : t)));
    replace({ ...task, ...patch, stage: stage.key, status: stage.phase });
    let saved: Task = task;
    const ok = await attempt(bus, async () => {
      if (patch) saved = await tasksApi.update(task.id, patch);
      if (saved.stage !== stage.key) saved = await tasksApi.setStage(task.id, stage.key);
    });
    if (ok) replace(saved);
    else if (saved === task) replace(task);
    else void list.load(); // the row change went through, the column change did not
  }

  const checked = (t: Task) => t.checklist.filter((i) => i.done).length;
  const openBlockers = (t: Task) => t.blockedBy.filter((b) => b.status !== 'DONE').length;
  const doneSubtasks = (t: Task) => t.subtasks.filter((s) => s.status === 'DONE').length;
</script>

<ListToolbar model={list}>
  {#snippet actions()}
    <Select inline aria-label="Gruppieren" bind:value={() => grouping, (g) => pane.updateQuery({ group: g || null }, true)} options={GROUPINGS} />
  {/snippet}
</ListToolbar>
{#each lanes as lane (lane.key)}
  {#if grouping}<h3 class="lane">{lane.label} <span class="muted">{lane.tasks.length}</span></h3>{/if}
  <div class="board">
    {#each columns as stage (stage.key)}
      {@const cell = `${lane.key}/${stage.key}`}
      {@const tasks = lane.tasks.filter((t) => t.stage === stage.key)}
      <section
        class="column"
        class:lean={grouping}
        class:over={over === cell}
        aria-label={grouping ? `${lane.label}: ${stage.label}` : stage.label}
        ondragover={(e) => dragOver(e, lane.key, cell)}
        ondragleave={() => (over = null)}
        ondrop={(e) => drop(e, lane.key, stage)}
      >
        <header><Tag tone={stage.hue}>{taskStages.label(stage.key)}</Tag><span class="muted">{tasks.length}</span></header>
        {#each tasks as task (task.id)}
          <button
            type="button"
            class="card"
            draggable={taskPolicy.canWork(task)}
            ondragstart={(e) => dragStart(e, task, lane.key)}
            ondragend={() => (dragging = null)}
            onclick={() => bus.publish(WINDOW_OPEN, { kind: 'task', id: task.id })}
            {@attach menu(() => recordMenu('task', task.id))}
            {@attach tooltip('Aufgabe öffnen')}
          >
            <span class="title" class:done={task.status === 'DONE'}>{task.title}</span>
            {#if task.priority !== 'NORMAL' || task.labels.length}
              <span class="tags">
                {#if task.priority !== 'NORMAL'}<Tag tone={task.priority === 'HIGH' ? 'red' : 'gray'}>{priorityLabel(task.priority)}</Tag>{/if}
                {#each task.labels as key (key)}<Tag tone={taskLabels.get(key)?.hue ?? 'gray'}>{taskLabels.label(key)}</Tag>{/each}
              </span>
            {/if}
            <TaskDue {task} />
            {#if task.assignees.length}<span class="muted small">{task.assignees.map((id) => directory.nameOf(id)).join(', ')}</span>{/if}
            {#if task.checklist.length}<span class="muted small">Checkliste {checked(task)}/{task.checklist.length}</span>{/if}
            {#if task.subtasks.length}<span class="muted small">Unteraufgaben {doneSubtasks(task)}/{task.subtasks.length}</span>{/if}
            {#if openBlockers(task)}<span class="muted small">Wartet auf {openBlockers(task)}</span>{/if}
          </button>
        {:else}
          {#if !grouping}<p class="muted small">Keine Aufgaben.</p>{/if}
        {/each}
      </section>
    {/each}
  </div>
{/each}
{#if list.cut.truncated}<p class="muted small">Es gibt mehr Aufgaben, als die Tafel zeigt. Bitte Filter eingrenzen.</p>{/if}

<style>
  .lane {
    margin: var(--space-md) 0 var(--space-xs);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .board {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-sm);
    align-items: start;
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding: var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    min-height: 6rem;
  }
  .column.lean {
    min-height: 3rem;
  }
  .column.over {
    background: var(--color-accent-soft);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
    padding: var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .card:hover {
    background: var(--color-hover);
  }
  .done {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
