<script lang="ts">
  import { bus, commands, directory, linksApi, permissions, session } from '../../lib/container';
  import { CONFIRM, TOAST } from '../../channels';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { LinksModel } from '../../lib/links/LinksModel.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Detail from '../../ui/Detail.svelte';
  import LinksSection from '../../ui/LinksSection.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Tag from '../../ui/Tag.svelte';
  import Checklist from './Checklist.svelte';
  import Comments from './Comments.svelte';
  import DueField from './DueField.svelte';
  import { TASK_CHANGED, type TaskChanged } from './events';
  import { statusHue, statusLabel, TASK_STATUSES } from './model';
  import { TaskDetailModel } from './TaskDetailModel.svelte';
  import TaskEditor from './TaskEditor.svelte';
  import { TaskForm } from './TaskForm.svelte';
  import { TasksApi } from './TasksApi';
  import { taskPolicy as policy, tasksApi } from './services';

  /** One task: status, properties, checklist, comments; edit and delete for managers. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const detail = new TaskDetailModel(tasksApi, id);
  const save = new Action();
  let form = $state<TaskForm | null>(null);
  // svelte-ignore state_referenced_locally
  const links = new LinksModel(linksApi, `${TasksApi.BASE}/${encodeURIComponent(id)}`);
  void links.load();

  detail.load().then(() => directory.loadRosters([detail.task.value?.teamId ?? null]));
  if (permissions.isManager) directory.loadTeams().catch(() => {});

  $effect(() => {
    const title = detail.task.value?.title;
    if (title) handle?.setTitle(title);
  });

  useBus(bus, TASK_CHANGED, ({ data }) => {
    if (data.taskId !== detail.id || detail.deleteAction.busy || save.busy) return;
    if (data.change === 'DELETED') {
      bus.publish(TOAST, { text: 'Diese Aufgabe wurde gelöscht.' });
      leave();
    } else {
      if (!form) void detail.load();
      if (!links.editing && !links.save.busy) void links.load();
    }
  });

  useCommands(commands, {
    'task.edit': {
      run: () => detail.task.value && (form = TaskForm.edit(session.clock, detail.task.value)),
      when: () => !form && !!detail.task.value && policy.canManage(detail.task.value),
    },
    'task.done': {
      run: () => detail.task.value && void detail.setStatus(detail.task.value.status === 'DONE' ? 'OPEN' : 'DONE'),
      when: () => !form && !!detail.task.value && policy.canWork(detail.task.value),
    },
  });

  function leave() {
    if (handle) handle.close();
    else onclosed?.();
  }

  async function submit(value: TaskForm) {
    if (!value.original) return;
    const original = value.original;
    if (await save.run(() => tasksApi.update(original.id, value.toPatch()))) {
      form = null;
      bus.publish(TOAST, { text: 'Aufgabe gespeichert.' });
      void detail.load();
    }
  }

  async function remove(title: string) {
    const ok = await bus.request(CONFIRM, {
      title: 'Aufgabe löschen',
      message: `„${title}“ wird mit Checkliste und Kommentaren gelöscht.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok && (await detail.delete())) {
      bus.publish(TOAST, { text: 'Aufgabe gelöscht.' });
      leave();
    }
  }
</script>

<AsyncView resource={detail.task}>
  {#snippet children(task)}
    <Detail title={form ? 'Aufgabe bearbeiten' : task.title}>
      {#snippet actions()}
        {#if !form && policy.canManage(task)}
          <Button onclick={() => (form = TaskForm.edit(session.clock, task))}>Bearbeiten</Button>
          <Button variant="danger" busy={detail.deleteAction.busy} onclick={() => remove(task.title)}>Löschen</Button>
        {/if}
      {/snippet}
      {#snippet meta()}
        {#if !form}<Tag tone={statusHue(task.status)}>{statusLabel(task.status)}</Tag>{/if}
      {/snippet}

      {#if form}
        <TaskEditor {form} action={save} submitLabel="Speichern" oncancel={() => (form = null)} onsubmit={() => form && submit(form)} />
      {:else}
        {#if policy.canWork(task)}
          <div class="stack">
            <ChoiceGroup name="task-status-{task.id}" label="Status" options={TASK_STATUSES} disabled={detail.statusAction.busy}
              bind:value={() => task.status, (status) => status && detail.setStatus(status)} />
            <ErrorNote error={detail.statusAction.error} />
          </div>
        {/if}

        <dl class="props">
          <dt>Fällig</dt>
          <dd><DueField {task} {detail} editable={policy.canManage(task)} /></dd>
          <dt>Für</dt>
          <dd>{task.teamId ? (directory.teamName(task.teamId) ?? 'Team') : 'Ganzer Verein'}</dd>
          <dt>Zugewiesen</dt>
          <dd>
            {#each task.assignees as assignee (assignee)}<Tag tone="gray">{directory.nameOf(assignee)}</Tag>{/each}
          </dd>
          <dt>Erstellt</dt>
          <dd>
            {session.format.dateTime(task.createdAt)}{directory.knownName(task.createdBy) ? `, ${directory.knownName(task.createdBy)}` : ''}
          </dd>
          {#if task.completedAt}
            <dt>Erledigt</dt>
            <dd>{session.format.dateTime(task.completedAt)}</dd>
          {/if}
        </dl>
        {#if task.description}<p class="prose">{task.description}</p>{/if}

        <LinksSection model={links} editable={policy.canManage(task)} />

        {#if task.checklist.length}
          {@const progress = TaskDetailModel.progress(task)}
          <h2>Checkliste <span class="muted count">{progress.done}/{progress.total}</span></h2>
          <Checklist {task} {detail} editable={policy.canWork(task)} />
          <ErrorNote error={detail.checkAction.error} />
        {/if}

        <h2>Kommentare</h2>
        <Comments {task} {detail} />
      {/if}
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .count {
    font-weight: normal;
  }
</style>
