<script lang="ts">
  import EditorForm from '../../ui/EditorForm.svelte';
  import type { Action } from '../../lib/state/Action.svelte';
  import Field from '../../ui/Field.svelte';
  import type { MembershipKindInput } from './MembersApi';

  /** Form of a membership kind: name, voting in the general meeting, being elected into an office. */
  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: {
    form: MembershipKindInput;
    action: Action;
    submitLabel: string;
    oncancel: () => void;
    onsubmit: () => void;
  } = $props();
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit}>
  <Field label="Bezeichnung">
    <input bind:value={form.label} maxlength="40" required />
  </Field>
  <label class="check"><input type="checkbox" bind:checked={form.votes} /> Stimmrecht in der Mitgliederversammlung</label>
  <label class="check"><input type="checkbox" bind:checked={form.eligible} /> Kann in eine Funktion gewählt werden</label>
</EditorForm>
