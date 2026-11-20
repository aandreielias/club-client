<script lang="ts">
  import { bus, directory, permissions, session } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Detail from '../../ui/Detail.svelte';
  import TaskEditor from './TaskEditor.svelte';
  import { TaskForm } from './TaskForm.svelte';
  import { taskPolicy as policy, tasksApi } from './services';

  /** New task in the window; `id` is the preselected team id or '-' for none. After saving the window shows the task. */
  let { id, handle }: { id: string; handle: WindowHandle } = $props();

  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neue Aufgabe');

  const form = new Resource<TaskForm>(async () => {
    if (permissions.isManager) await directory.loadTeams().catch(() => {});
    await directory.loadRosters();
    const team = policy.plannableTeams().some((t) => t.id === id) ? id : null;
    return TaskForm.blank(session.clock, team, policy.canCreateClubWide());
  });
  void form.load();

  const submit = (value: TaskForm) => create.submit(async () => (await tasksApi.create(value.toNew())).id, 'task', 'Aufgabe angelegt.');
</script>

<AsyncView resource={form}>
  {#snippet children(value)}
    <Detail title="Neue Aufgabe">
      <TaskEditor form={value} action={create.save} submitLabel="Anlegen" oncancel={() => handle.close()} onsubmit={() => submit(value)} />
    </Detail>
  {/snippet}
</AsyncView>
