<script lang="ts">
  import { settings } from '../../settings';
  import { bus, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import type { TaskDetailModel } from './TaskDetailModel.svelte';
  import TaskDue from './TaskDue.svelte';
  import type { Task } from './model';

  /** Due date property, editable in place for members who manage the task. */
  let { task, detail, editable }: { task: Task; detail: TaskDetailModel; editable: boolean } = $props();

  let editing = $state(false);
  let value = $state('');

  function start() {
    const { clock } = session;
    value = task.dueAt ? clock.toLocal(task.dueAt) : `${clock.today()}T${settings.tasks.defaultDueTime}`;
    detail.dueAction.reset();
    editing = true;
  }

  async function clear() {
    if (await detail.setDue(null)) bus.publish(TOAST, { text: 'Fälligkeit entfernt.' });
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!value) return;
    if (await detail.setDue(session.clock.toInstant(value))) {
      editing = false;
      bus.publish(TOAST, { text: 'Fälligkeit gespeichert.' });
    }
  }
</script>

{#if editing}
  <form class="stack" onsubmit={save}>
    <div class="row">
      <!-- svelte-ignore a11y_autofocus -->
      <input class="when" type="datetime-local" bind:value aria-label="Fällig am" autofocus required />
      <Button type="submit" variant="primary" busy={detail.dueAction.busy}>Speichern</Button>
      <Button variant="ghost" onclick={() => (editing = false)}>Abbrechen</Button>
    </div>
    <ErrorNote error={detail.dueAction.error} />
  </form>
{:else}
  <span class="row">
    <TaskDue {task} />
    {#if editable}
      <Button variant="ghost" onclick={start}>{task.dueAt ? 'Ändern' : 'Festlegen'}</Button>
      {#if task.dueAt}<Button variant="ghost" busy={detail.dueAction.busy} onclick={clear} tooltip="Fälligkeit entfernen">Entfernen</Button>{/if}
    {/if}
  </span>
  {#if editable}<ErrorNote error={detail.dueAction.error} />{/if}
{/if}

<style>
  .when {
    width: auto;
  }
</style>
