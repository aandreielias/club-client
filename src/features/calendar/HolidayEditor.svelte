<script lang="ts">
  import type { Action } from '../../lib/state/Action.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import type { Holiday } from './model';

  /** Form of a holiday: name and the days it covers (both inclusive). */
  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: {
    form: Omit<Holiday, 'id'>;
    action: Action;
    submitLabel: string;
    oncancel: () => void;
    onsubmit: () => void;
  } = $props();

  // Checked by the form itself: errors show after the first save attempt.
  const check = $state({
    submitted: false,
    get valid() {
      return !!form.name.trim() && form.to >= form.from;
    },
  });
  const backwards = $derived(check.submitted && form.to < form.from);
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={check}>
  <Field label="Name" error={check.submitted && !form.name.trim() ? 'Bitte einen Namen angeben.' : undefined}>
    <input bind:value={form.name} maxlength="80" placeholder="Herbstferien" required />
  </Field>
  <div class="grid-2">
    <Field label="Von"><DateInput bind:value={form.from} /></Field>
    <Field label="Bis" error={backwards ? 'Das Ende liegt vor dem Beginn.' : undefined}>
      <DateInput bind:value={form.to} min={form.from} />
    </Field>
  </div>
</EditorForm>
