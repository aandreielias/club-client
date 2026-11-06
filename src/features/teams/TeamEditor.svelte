<script lang="ts">
  import { settings } from '../../settings';
  import type { Action } from '../../lib/state/Action.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import type { TeamForm } from './TeamForm.svelte';

  /** Form of a team: name and season. */
  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: { form: TeamForm; action: Action; submitLabel: string; oncancel: () => void; onsubmit: () => void } = $props();
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={form}>
  <div class="grid-2">
    <Field label="Name" error={form.error('name')}>
      <input bind:value={form.name} maxlength={settings.teams.nameMaxLength} required />
    </Field>
    <Field label="Saison" hint="z. B. 2026/27" error={form.error('season')}>
      <input bind:value={form.season} required />
    </Field>
  </div>
</EditorForm>
