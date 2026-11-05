<script lang="ts">
  import { background } from '../../lib/state/background';
  import { bus, commands, directory, permissions, router, store, windows } from '../../lib/container';
  import { APP_ERROR, CONFIRM, TOAST, WINDOW_OPEN } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { MenuEntry } from '../../lib/overlay/ContextMenuService.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';
  import TaskTable from './TaskTable.svelte';
  import Page from '../../ui/Page.svelte';
  import { TASK_CHANGED } from './events';
  import type { Task } from './model';
  import { TaskListModel } from './TaskListModel.svelte';
  import { taskPolicy, tasksApi } from './services';

  const list = new TaskListModel(tasksApi, taskPolicy, directory, store);
  void list.load();
  directory.loadRosters();
  if (permissions.isManager) background(directory.loadTeams());
  useBus(bus, TASK_CHANGED, () => void list.load());
  /** Window entries plus done/reopen for members who work on the task. */
  function taskMenu(task: Task): MenuEntry[] {
    const done = task.status === 'DONE';
    return [
      ...windowMenu(bus, windows, router, 'task', task.id),
      { separator: true },
      {
        label: done ? 'Wieder öffnen' : 'Als erledigt markieren',
        disabled: !taskPolicy.canWork(task),
        run: async () => {
          try {
            await tasksApi.setStatus(task.id, done ? 'OPEN' : 'DONE');
            bus.publish(TOAST, { text: done ? 'Aufgabe wieder geöffnet.' : 'Aufgabe erledigt.' });
            void list.load();
          } catch (error) {
            bus.publish(APP_ERROR, error);
          }
        },
      },
    ];
  }

  // Several tasks at once: done, reopened or deleted; each only where the member may (the server checks every one).
  let selecting = $state(false);
  let chosen = $state<ReadonlySet<string>>(new Set());
  let bulkBusy = $state(false);
  const picked = $derived((list.data.value ?? []).filter((t) => chosen.has(t.id)));

  function toggle(task: Task) {
    const next = new Set(chosen);
    if (!next.delete(task.id)) next.add(task.id);
    chosen = next;
  }

  function stopSelecting() {
    selecting = false;
    chosen = new Set();
  }

  async function bulk(label: string, run: (task: Task) => Promise<unknown>, allowed: (task: Task) => boolean) {
    const targets = picked.filter(allowed);
    bulkBusy = true;
    let done = 0;
    for (const task of targets) {
      try {
        await run(task);
        done++;
      } catch (error) {
        bus.publish(APP_ERROR, error);
        break;
      }
    }
    bulkBusy = false;
    bus.publish(TOAST, {
      text: `${done} ${done === 1 ? 'Aufgabe' : 'Aufgaben'} ${label}.${targets.length < picked.length ? ' Andere durftest du nicht ändern.' : ''}`,
    });
    stopSelecting();
    void list.load();
  }

  // Reassigning: to one person who may get every picked task (the team's roster when they share a team, else everyone).
  let assigning = $state(false);
  let assignee = $state('');
  let people = $state<readonly { memberId: string; name: string }[]>([]);
  async function openAssign() {
    const teams = new Set(picked.map((t) => t.teamId));
    const team = teams.size === 1 ? [...teams][0] : null;
    await directory.loadRosters();
    people = await directory.candidates(team);
    assignee = '';
    assigning = true;
  }

  async function bulkAssign() {
    const to = assignee;
    assigning = false;
    await bulk(
      `${directory.nameOf(to)} zugewiesen`,
      (t) => tasksApi.update(t.id, { assignees: [to] }),
      (t) => taskPolicy.canManage(t),
    );
  }

  async function bulkDelete() {
    const ok = await bus.request(CONFIRM, {
      title: 'Aufgaben löschen',
      message: `${picked.length} ausgewählte Aufgaben endgültig löschen?`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok)
      await bulk(
        'gelöscht',
        (t) => tasksApi.delete(t.id),
        (t) => taskPolicy.canManage(t),
      );
  }

  useCommands(commands, {
    'page.new': { run: () => bus.publish(WINDOW_OPEN, { kind: 'task-new', id: list.filters.team || '-' }), when: () => taskPolicy.canCreate() },
  });
</script>

<Page title="Aufgaben">
  {#snippet actions()}
    {#if selecting}
      <span class="muted">{chosen.size} ausgewählt</span>
      <Button
        busy={bulkBusy}
        disabled={!chosen.size}
        onclick={() =>
          bulk(
            'erledigt',
            (t) => tasksApi.setStatus(t.id, 'DONE'),
            (t) => taskPolicy.canWork(t) && t.status !== 'DONE',
          )}>Erledigt</Button
      >
      <Button
        busy={bulkBusy}
        disabled={!chosen.size}
        onclick={() =>
          bulk(
            'wieder geöffnet',
            (t) => tasksApi.setStatus(t.id, 'OPEN'),
            (t) => taskPolicy.canWork(t) && t.status === 'DONE',
          )}>Wieder öffnen</Button
      >
      <Button busy={bulkBusy} disabled={!chosen.size} onclick={openAssign}>Zuweisen</Button>
      <Button variant="danger" busy={bulkBusy} disabled={!chosen.size} onclick={bulkDelete}>Auswahl löschen</Button>
      <Button variant="ghost" onclick={stopSelecting}>Fertig</Button>
    {:else}
      <Button onclick={() => (selecting = true)}>Auswählen</Button>
    {/if}
    {#if taskPolicy.canCreate() && !selecting}
      <Button variant="primary" icon="add" onclick={() => bus.publish(WINDOW_OPEN, { kind: 'task-new', id: list.filters.team || '-' })}
        >Neue Aufgabe</Button
      >
    {/if}
  {/snippet}

  {#if list.cut.truncated}<p class="muted small">Es gibt mehr Aufgaben, als die Liste zeigt. Bitte Filter eingrenzen.</p>{/if}
  <TaskTable
    {list}
    menu={taskMenu}
    check={selecting ? { checked: (t) => chosen.has(t.id), toggle, label: (t) => `${t.title} auswählen` } : undefined}
    emptyText={list.filters.mine ? 'Dir ist keine offene Aufgabe zugewiesen.' : 'Keine Aufgaben.'}
    emptyAction={taskPolicy.canCreate()
      ? { label: 'Neue Aufgabe', icon: 'add', run: () => bus.publish(WINDOW_OPEN, { kind: 'task-new', id: list.filters.team || '-' }) }
      : null}
  />
</Page>

<Dialog open={assigning} title="Aufgaben zuweisen" onclose={() => (assigning = false)}>
  <div class="stack">
    <p>Die {picked.length} ausgewählten Aufgaben bekommt künftig nur noch diese Person.</p>
    <Field label="An">
      <Select bind:value={assignee} placeholder="Bitte wählen" options={people.map((p) => ({ value: p.memberId, label: p.name }))} />
    </Field>
    <div class="row">
      <Button variant="primary" disabled={!assignee} onclick={bulkAssign}>Zuweisen</Button>
      <Button variant="ghost" onclick={() => (assigning = false)}>Abbrechen</Button>
    </div>
  </div>
</Dialog>
