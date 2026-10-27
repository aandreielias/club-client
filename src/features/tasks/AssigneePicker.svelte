<script lang="ts">
  import { untrack } from 'svelte';
  import { bus, directory, store } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { recordDrop } from '../../ui/recordDrop';
  import { PersonListModel } from '../../lib/directory/PersonListModel.svelte';
  import PeoplePicker from '../../ui/PeoplePicker.svelte';
  import type { TaskForm } from './TaskForm.svelte';

  /**
   * Possible assignees in the standard people list: the team's roster, or every member for club
   * tasks (admin/board only; the server may ask for the PIN first).
   */
  let { form, error }: { form: TaskForm; error: string | null } = $props();

  // svelte-ignore state_referenced_locally
  const list = new PersonListModel(
    async () => {
      await directory.loadRosters();
      return directory.candidates(form.teamOrNull);
    },
    directory,
    (id) => form.isAssigned(id),
    store,
    'task-assignees',
  );

  $effect(() => {
    void form.teamOrNull; // reload when the team changes
    untrack(() => list.load().then(() => form.retainAssignees((list.data.value ?? []).map((c) => c.memberId))));
  });

  /** A member dragged in (a name, a list row): assigned when they may be. */
  function drop(memberId: string) {
    if (!(list.data.value ?? []).some((c) => c.memberId === memberId))
      bus.publish(TOAST, { text: `${directory.nameOf(memberId)} kann diese Aufgabe nicht bekommen.` });
    else if (!form.isAssigned(memberId)) form.toggleAssignee(memberId);
  }
</script>

<fieldset class="stack" {@attach recordDrop(['member'], (ref) => drop(ref.id))}>
  <legend>Zugewiesen</legend>
  <PeoplePicker {list} chosen={form.assignees} ontoggle={(id) => form.toggleAssignee(id)} emptyText="Keine passenden Mitglieder." />
  {#if error}<span class="error" role="alert">{error}</span>{/if}
</fieldset>

<style>
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .error {
    color: var(--color-danger);
    font-size: var(--font-size-small);
  }
</style>
