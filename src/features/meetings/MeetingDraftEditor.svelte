<script lang="ts">
  import { session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import DateTimeInput from '../../ui/DateTimeInput.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { MeetingForm } from './MeetingForm.svelte';
  import type { MeetingModel } from './MeetingModel.svelte';
  import type { Meeting } from './model';
  import { meetingTypes } from './services';

  /** A draft's title, urgency and time; after the invitation the time is fixed. */
  let { meeting, model, onclose }: { meeting: Meeting; model: MeetingModel; onclose: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = MeetingForm.of(meeting, meetingTypes.get(meeting.kind) ?? null, session.clock);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid && (await model.save(form.toPatch()))) onclose();
  }
</script>

<form class="stack editor" onsubmit={submit} novalidate>
  <Field label="Titel" error={form.error('title')}>
    <input bind:value={form.title} maxlength="120" required />
  </Field>
  {#if form.type?.needsReason}
    <Field label="Grund der Dringlichkeit" hint="Steht in der Einladung." error={form.error('urgency')}>
      <textarea bind:value={form.urgency} rows="2" maxlength="1000"></textarea>
    </Field>
  {/if}
  <div class="grid-2">
    <Field label="Beginn" error={form.error('start')}>
      <DateTimeInput bind:value={() => form.start, (v) => form.setStart(v)} required />
    </Field>
    <Field label="Ende" error={form.error('end')}>
      <DateTimeInput bind:value={form.end} min={form.start} required />
    </Field>
  </div>
  <ErrorNote error={model.action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={model.action.busy}>Speichern</Button>
    <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
  </div>
</form>

<style>
  .editor {
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
</style>
