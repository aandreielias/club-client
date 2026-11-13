<script lang="ts">
  import { settings } from '../../settings';
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
  let submitted = $state(false);
  const check = {
    get submitted() {
      return submitted;
    },
    set submitted(value: boolean) {
      submitted = value;
    },
    get valid() {
      return !!form.label.trim();
    },
  };
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={check}>
  <Field label="Bezeichnung" error={submitted && !form.label.trim() ? 'Bezeichnung mit 1 bis 40 Zeichen angeben.' : null}>
    <input bind:value={form.label} maxlength={settings.members.kindLabelMaxLength} required />
  </Field>
  <label class="check"><input type="checkbox" bind:checked={form.votes} /> Stimmrecht in der Mitgliederversammlung</label>
  <label class="check"><input type="checkbox" bind:checked={form.eligible} /> Kann in eine Funktion gewählt werden</label>
</EditorForm>
