<script lang="ts">
  import EditorForm from '../../ui/EditorForm.svelte';
  import { REPEAT_OPTIONS, TASK_PRIORITIES } from './model';
  import { Resource } from '../../lib/state/Resource.svelte';
  import ChipPicker from '../../ui/ChipPicker.svelte';
  import OptionList from '../../ui/OptionList.svelte';
  import { settings } from '../../settings';
  import type { Action } from '../../lib/state/Action.svelte';
  import Field from '../../ui/Field.svelte';
  import DateTimeInput from '../../ui/DateTimeInput.svelte';
  import Select from '../../ui/Select.svelte';
  import AssigneePicker from './AssigneePicker.svelte';
  import AudiencePicker from '../../ui/AudiencePicker.svelte';
  import ChecklistEditor from './ChecklistEditor.svelte';
  import { BOARD_ONLY, CLUB_WIDE, FOR_CHOSEN, type TaskForm } from './TaskForm.svelte';
  import { directory } from '../../lib/container';
  import { taskLabels, taskPolicy as policy, tasksApi } from './services';

  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: { form: TaskForm; action: Action; submitLabel: string; oncancel: () => void; onsubmit: () => void } = $props();

  const limits = settings.tasks;
  /** Open tasks the member sees, for parent and "wartet auf". */
  const others = new Resource(() => tasksApi.list({ mine: false, teamId: null, includeDone: false }));
  void others.load();
  const self = $derived(form.original?.id);
  const candidates = $derived((others.value?.items ?? []).filter((t) => t.id !== self));
  // One level: a task with subtasks has no parent, and only tasks without a parent can be one.
  const parentOptions = $derived([
    { value: '', label: 'Keine' },
    ...(form.original?.parent ? [{ value: form.original.parent.id, label: form.original.parent.title }] : []),
    ...candidates.filter((t) => !t.parent && t.id !== form.original?.parent?.id).map((t) => ({ value: t.id, label: t.title })),
  ]);
  const blockerTitle = (id: string) => form.original?.blockedBy.find((t) => t.id === id)?.title ?? 'Aufgabe';
  /** Team tasks and the board's own club tasks keep whom they are for; the others switch between the two choices. */
  const fixed = $derived(form.isEdit && (form.teamOrNull !== null || form.teamId === BOARD_ONLY));
  const teamOptions = $derived(
    form.teamOrNull && form.isEdit
      ? [{ value: form.teamId, label: directory.teamName(form.teamOrNull) ?? 'Team' }]
      : form.teamId === BOARD_ONLY
        ? [{ value: BOARD_ONLY, label: 'Nur Vorstand' }]
        : [
            ...(policy.canCreateClubWide() || form.teamId === CLUB_WIDE ? [{ value: CLUB_WIDE, label: 'Ganzer Verein' }] : []),
            ...(policy.canCreateForChosen() || form.forChosen ? [{ value: FOR_CHOSEN, label: 'Bestimmte Personen und Gruppen' }] : []),
          ],
  );
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={form}>
  <Field label="Titel" error={form.error('title')}>
    <input bind:value={form.title} maxlength={limits.titleMaxLength} required />
  </Field>

  <div class="grid-2">
    <Field
      label="Für"
      hint={fixed
        ? 'Lässt sich nach dem Anlegen nicht mehr ändern.'
        : 'Ganzer Verein: alle Mitglieder sehen sie. Eine einzelne Mannschaft allein ergibt eine Mannschaftsaufgabe.'}
    >
      <Select bind:value={form.teamId} options={teamOptions} disabled={fixed} />
    </Field>
    <Field label="Fällig am (optional)" error={form.error('dueAt')}>
      <DateTimeInput bind:value={form.due} />
    </Field>
  </div>
  {#if form.forChosen}
    <AudiencePicker
      value={form.audience}
      onchange={(v) => (form.audience = v)}
      error={form.error('audience')}
      hint="Wer eine der gewählten Rollen, Funktionen, Teams oder Mitgliedsarten hat oder genannt ist, sieht die Aufgabe und kann sie bekommen."
    />
  {/if}
  <Field label="Wiederholen" hint="Ist die Aufgabe erledigt, entsteht die nächste, fällig entsprechend später." error={form.error('repeat')}>
    <Select bind:value={form.repeat} options={REPEAT_OPTIONS} />
  </Field>

  <Field label="Beschreibung" error={form.error('description')}>
    <textarea bind:value={form.description} rows="4" maxlength={limits.descriptionMaxLength}></textarea>
  </Field>

  <AssigneePicker {form} error={form.error('assignees')} />

  <ChecklistEditor {form} error={form.error('checklist')} />

  <div class="grid-2">
    <Field label="Priorität">
      <Select bind:value={form.priority} options={TASK_PRIORITIES} />
    </Field>
    {#if !form.original?.subtasks.length}
      <Field label="Teil von" hint="Macht diese Aufgabe zur Unteraufgabe einer anderen.">
        <Select bind:value={form.parentId} options={parentOptions} />
      </Field>
    {/if}
  </div>
  {#if taskLabels.options(form.labels).length}
    <OptionList label="Labels" options={taskLabels.options(form.labels)} bind:value={form.labels} />
  {/if}
  <Field group label="Wartet auf" hint="Nur ein Hinweis: die Aufgabe lässt sich trotzdem erledigen.">
    <ChipPicker
      label="Wartet auf"
      value={form.blockedBy}
      options={candidates.map((t) => ({ value: t.id, label: t.title }))}
      onchange={(ids) => (form.blockedBy = ids)}
      labelOf={blockerTitle}
      placeholder="Aufgabe suchen"
      emptyText={others.value ? 'Keine passenden Aufgaben.' : 'Wird geladen'}
    />
  </Field>
</EditorForm>
