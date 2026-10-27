<script lang="ts">
  import { background } from '../../lib/state/background';
  import { backStack, bus, commands, directory, linksApi, pendingDeletes, permissions, session } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { LinksModel } from '../../lib/links/LinksModel.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import ActivitySection from '../../ui/ActivitySection.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Detail from '../../ui/Detail.svelte';
  import LinksSection from '../../ui/LinksSection.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Tag from '../../ui/Tag.svelte';
  import MemberName from '../../ui/MemberName.svelte';
  import ChangeRequestSection from '../members/ChangeRequestSection.svelte';
  import Checklist from './Checklist.svelte';
  import Comments from './Comments.svelte';
  import DueField from './DueField.svelte';
  import { TASK_CHANGED } from './events';
  import { repeatLabel, statusHue, statusLabel, type TaskStatus, TASK_STATUSES } from './model';
  import { TaskDetailModel } from './TaskDetailModel.svelte';
  import TaskEditor from './TaskEditor.svelte';
  import { TaskForm } from './TaskForm.svelte';
  import { TasksApi } from './TasksApi';
  import { taskPolicy as policy, tasksApi } from './services';

  /** One task: status, properties, checklist, comments; edit and delete for managers. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<TaskForm>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const detail = new TaskDetailModel(tasksApi, id);
  // svelte-ignore state_referenced_locally
  const links = new LinksModel(linksApi, `${TasksApi.BASE}/${encodeURIComponent(id)}`);
  void links.load();

  detail.load().then(() => directory.loadRosters([detail.task.value?.teamId ?? null]));
  if (permissions.isManager) background(directory.loadTeams());

  view.title(() => detail.task.value?.title);
  view.watch(TASK_CHANGED, (data) => data.taskId === detail.id, {
    deleted: 'Diese Aufgabe wurde gelöscht.',
    busy: () => edit.save.busy,
    changed: () => {
      if (!edit.editing) void detail.load();
      if (!links.editing && !links.save.busy) void links.load();
    },
  });

  useCommands(commands, {
    'task.edit': {
      run: () => detail.task.value && edit.edit(TaskForm.edit(session.clock, detail.task.value)),
      when: () => !edit.editing && !!detail.task.value && policy.canManage(detail.task.value),
    },
    'task.done': {
      run: () => detail.task.value && void detail.setStatus(detail.task.value.status === 'DONE' ? 'OPEN' : 'DONE'),
      when: () => !edit.editing && !!detail.task.value && policy.canWork(detail.task.value),
    },
  });

  async function submit() {
    const original = edit.form?.original;
    if (original && (await edit.submit((form) => tasksApi.update(original.id, form.toPatch()), 'Aufgabe gespeichert.'))) void detail.load();
  }

  function remove(title: string) {
    pendingDeletes.schedule({ ids: [detail.id], text: `Aufgabe „${title}“ gelöscht.`, commit: () => tasksApi.delete(detail.id) });
    view.leave();
  }
</script>

<AsyncView resource={detail.task}>
  {#snippet children(task)}
    <Detail title={edit.form ? 'Aufgabe bearbeiten' : task.title}>
      {#snippet actions()}
        {#if !edit.form && policy.canManage(task)}
          <Button icon="edit" onclick={() => edit.edit(TaskForm.edit(session.clock, task))}>Bearbeiten</Button>
          <Button variant="danger" icon="delete" onclick={() => remove(task.title)}>Löschen</Button>
        {/if}
      {/snippet}
      {#snippet meta()}
        <!-- Members who work on the task change the status in the slider below; others only read it. -->
        {#if !edit.form && !policy.canWork(task)}<Tag tone={statusHue(task.status)}>{statusLabel(task.status)}</Tag>{/if}
      {/snippet}

      {#if edit.form}
        <div class="editing" {@attach edit.track}>
          <TaskEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
        </div>
      {:else}
        <!-- Who works on it and where it stands, side by side: the two things looked at first. -->
        <div class="top-row">
          <div class="assignees">
            <span class="muted label">Zugewiesen</span>
            {#each task.assignees as assignee (assignee)}<MemberName memberId={assignee} tag />{:else}<span class="muted">Niemand</span>{/each}
          </div>
          {#if policy.canWork(task)}
            <ChoiceGroup name="task-status-{task.id}" label="Status" options={TASK_STATUSES} disabled={detail.statusAction.busy}
              bind:value={() => task.status, (status) => status && detail.setStatus(status)} />
          {/if}
        </div>
        <ErrorNote error={detail.statusAction.error} />

        <dl class="props">
          <dt>Fällig</dt>
          <dd><DueField {task} {detail} editable={policy.canManage(task)} /></dd>
          {#if task.repeatWeeks}
            <dt>Wiederholt</dt>
            <dd>{repeatLabel(task.repeatWeeks)}</dd>
          {/if}
          <dt>Für</dt>
          <dd>{task.teamId ? (directory.teamName(task.teamId) ?? 'Team') : 'Ganzer Verein'}</dd>
          <dt>Erstellt</dt>
          <dd>
            {session.format.dateTime(task.createdAt)}{#if directory.knownName(task.createdBy)},&nbsp;<MemberName memberId={task.createdBy} />{/if}
          </dd>
          {#if task.completedAt}
            <dt>Erledigt</dt>
            <dd>{session.format.dateTime(task.completedAt)}</dd>
          {/if}
        </dl>
        {#if task.description}<p class="prose">{task.description}</p>{/if}

        {#if task.source?.kind === 'CHANGE_REQUEST'}<ChangeRequestSection requestId={task.source.id} />{/if}

        <LinksSection model={links} editable={policy.canManage(task)} />

        {#if task.checklist.length}
          {@const progress = TaskDetailModel.progress(task)}
          <h2>Checkliste <span class="muted count">{progress.done}/{progress.total}</span></h2>
          <Checklist {task} {detail} editable={policy.canWork(task)} />
          <ErrorNote error={detail.checkAction.error} />
        {/if}

        <h2>Kommentare</h2>
        <Comments {task} {detail} />
        <ActivitySection kind="TASK" id={task.id} describe={(e) => (e.action === 'STATUS' && e.detail ? `Status: ${statusLabel(e.detail as TaskStatus)}` : null)} />
      {/if}
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .top-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm) var(--space-lg);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--color-border);
  }
  .assignees {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
    min-width: 0;
  }
  .assignees .label {
    margin-right: var(--space-xs);
    font-size: var(--font-size-small);
  }
  .editing {
    display: contents;
  }
  .count {
    font-weight: normal;
  }
</style>
