<script lang="ts">
  import { Action } from '../../lib/state/Action.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import Field from '../../ui/Field.svelte';
  import { meetingsApi } from './services';

  /** A Beschluss added to an invited or open meeting: title and motion; it goes to the end of the agenda (server: same rules). */
  let { meetingId, onclose }: { meetingId: string; onclose: (added: boolean) => void } = $props();

  const action = new Action();
  let title = $state('');
  let text = $state('');

  async function submit() {
    const motion = { title: title.trim(), text: text.trim() || null, majority: null, assigneeIds: [], implementDue: null };
    if (await action.run(() => meetingsApi.createResolution(meetingId, motion))) onclose(true);
  }
</script>

<EditorForm {action} submitLabel="Anlegen" oncancel={() => onclose(false)} onsubmit={submit}>
  <Field label="Titel">
    <input bind:value={title} maxlength="200" required />
  </Field>
  <Field label="Antrag (optional)">
    <textarea bind:value={text} rows="4"></textarea>
  </Field>
</EditorForm>
