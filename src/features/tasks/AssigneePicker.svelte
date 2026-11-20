<script lang="ts">
  import { untrack } from 'svelte';
  import { bus, directory } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { recordDrop } from '../../ui/recordDrop';
  import ChipPicker from '../../ui/ChipPicker.svelte';
  import { audienceOf, hasAudience } from '../../lib/reach';
  import type { TaskForm } from './TaskForm.svelte';
  import { tasksApi } from './services';

  /**
   * Assignees as chips with a name search: the team's roster, the people the audience reaches (asked from the server),
   * or every member for the board's club tasks. Names dragged in are assigned when they may be.
   */
  let { form, error }: { form: TaskForm; error: string | null } = $props();

  let pool = $state.raw<readonly { memberId: string; name: string }[]>([]);
  let loaded = $state(false);
  let sequence = 0;

  async function candidates(): Promise<readonly { memberId: string; name: string }[]> {
    await directory.loadRosters();
    if (!form.forChosen) return directory.candidates(form.teamOrNull);
    const audience = audienceOf(form.audience);
    if (!hasAudience(audience)) return [];
    return (await tasksApi.audienceMembers(audience)).map((memberId) => ({ memberId, name: directory.nameOf(memberId) }));
  }

  $effect(() => {
    void form.teamId;
    void form.audience.length; // entries are only added or removed
    untrack(() => {
      const current = ++sequence;
      loaded = false;
      void candidates().then((found) => {
        if (current !== sequence) return;
        pool = [...found].sort((a, b) => a.name.localeCompare(b.name, 'de'));
        loaded = true;
        form.retainAssignees(found.map((c) => c.memberId));
      });
    });
  });

  const options = $derived(pool.map((p) => ({ value: p.memberId, label: p.name, detail: directory.teamsOf(p.memberId).join(', ') || undefined })));

  function drop(memberId: string) {
    if (!pool.some((c) => c.memberId === memberId)) bus.publish(TOAST, { text: `${directory.nameOf(memberId)} kann diese Aufgabe nicht bekommen.` });
    else if (!form.isAssigned(memberId)) form.toggleAssignee(memberId);
  }
</script>

<fieldset class="stack" {@attach recordDrop(['member'], (ref) => drop(ref.id))}>
  <legend>Zugewiesen</legend>
  <ChipPicker
    label="Zugewiesen"
    value={form.assignees}
    {options}
    onchange={(ids) => (form.assignees = ids)}
    labelOf={(id) => directory.nameOf(id)}
    placeholder="Person suchen"
    emptyText={loaded
      ? form.forChosen && !pool.length
        ? 'Zuerst oben wählen, für wen die Aufgabe ist.'
        : 'Keine passenden Mitglieder.'
      : 'Wird geladen'}
  />
  {#if error}<span class="invalid" role="alert">{error}</span>{/if}
</fieldset>
