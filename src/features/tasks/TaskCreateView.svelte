<script lang="ts">
  import { directory, permissions, session, toasts } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Detail from '../../ui/Detail.svelte';
  import TaskEditor from './TaskEditor.svelte';
  import { TaskForm } from './TaskForm.svelte';
  import { taskPolicy as policy, tasksApi } from './services';

  /** New task in the window; `id` is the preselected team id or '-' for none. After saving the window shows the task. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  const save = new Action();
  $effect(() => handle.setTitle('Neue Aufgabe'));

  const form = new Resource<TaskForm>(async () => {
    if (permissions.isManager) await directory.loadTeams().catch(() => {});
    await directory.loadRosters();
    return TaskForm.blank(session.clock, defaultTeam());
  });
  void form.load();

  /** Requested team if plannable; club-wide only for members allowed to plan it, else their first team. */
  function defaultTeam(): string | null {
    const teams = policy.plannableTeams();
    if (teams.some((t) => t.id === id)) return id;
    return policy.canCreateClubWide() ? null : (teams[0]?.id ?? null);
  }

  async function submit(value: TaskForm) {
    let created = '';
    if (await save.run(async () => (created = (await tasksApi.create(value.toNew())).id))) {
      toasts.show('Aufgabe angelegt.');
      handle.open('task', created);
    }
  }
</script>

<AsyncView resource={form}>
  {#snippet children(value)}
    <Detail title="Neue Aufgabe">
      <TaskEditor form={value} action={save} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={() => submit(value)} />
    </Detail>
  {/snippet}
</AsyncView>
