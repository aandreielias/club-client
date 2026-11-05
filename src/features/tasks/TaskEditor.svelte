<script lang="ts">
  import EditorForm from '../../ui/EditorForm.svelte';
  import { REPEAT_OPTIONS } from './model';
  import { settings } from '../../settings';
  import type { Action } from '../../lib/state/Action.svelte';
  import Field from '../../ui/Field.svelte';
  import DateTimeInput from '../../ui/DateTimeInput.svelte';
  import Select from '../../ui/Select.svelte';
  import AssigneePicker from './AssigneePicker.svelte';
  import ChecklistEditor from './ChecklistEditor.svelte';
  import { CLUB_WIDE, type TaskForm } from './TaskForm.svelte';
  import { taskPolicy as policy } from './services';

  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: { form: TaskForm; action: Action; submitLabel: string; oncancel: () => void; onsubmit: () => void } = $props();

  const limits = settings.tasks;
  const teamOptions = $derived([
    ...(policy.canCreateClubWide() || form.teamId === CLUB_WIDE ? [{ value: CLUB_WIDE, label: 'Ganzer Verein' }] : []),
    ...policy.plannableTeams().map((t) => ({ value: t.id, label: t.name })),
  ]);
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={form}>
  <Field label="Titel" error={form.error('title')}>
    <input bind:value={form.title} maxlength={limits.titleMaxLength} required />
  </Field>

  <div class="grid-2">
    <Field label="Für" hint={form.isEdit ? 'Lässt sich nach dem Anlegen nicht mehr ändern.' : undefined}>
      <Select bind:value={form.teamId} options={teamOptions} disabled={form.isEdit} />
    </Field>
    <Field label="Fällig am (optional)" error={form.error('dueAt')}>
      <DateTimeInput bind:value={form.due} />
    </Field>
  </div>
  <Field label="Wiederholen" hint="Ist die Aufgabe erledigt, entsteht die nächste, fällig entsprechend später." error={form.error('repeat')}>
    <Select bind:value={form.repeat} options={REPEAT_OPTIONS} />
  </Field>

  <Field label="Beschreibung" error={form.error('description')}>
    <textarea bind:value={form.description} rows="4" maxlength={limits.descriptionMaxLength}></textarea>
  </Field>

  <AssigneePicker {form} error={form.error('assignees')} />

  <ChecklistEditor {form} error={form.error('checklist')} />
</EditorForm>
