<script lang="ts">
  import type { Action } from '../../lib/state/Action.svelte';
  import type { Hue } from '../../lib/types';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import ColorSwatches from '../../ui/ColorSwatches.svelte';
  import { HUES, type AppointmentTypeInput } from './model';

  /** Form of an appointment type: name, colour in the calendar, car pools and changing cabins. */
  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: {
    form: AppointmentTypeInput;
    action: Action;
    submitLabel: string;
    oncancel: () => void;
    onsubmit: () => void;
  } = $props();

  const HUE_LABELS: Readonly<Record<Hue, string>> = {
    gray: 'Grau',
    brown: 'Braun',
    orange: 'Orange',
    yellow: 'Gelb',
    green: 'Grün',
    blue: 'Blau',
    purple: 'Violett',
    red: 'Rot',
  };
  const HUE_OPTIONS = HUES.map((h) => ({ value: h, label: HUE_LABELS[h] }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} {@attach autofocus}>
  <div class="grid-2">
    <Field label="Bezeichnung">
      <input bind:value={form.label} maxlength="40" required />
    </Field>
    <Field label="Farbe" hint="So steht die Terminart im Kalender.">
      <ColorSwatches label="Farbe" options={HUE_OPTIONS} bind:value={form.hue} />
    </Field>
  </div>
  <label class="check"><input type="checkbox" bind:checked={form.rides} /> Fahrgemeinschaften anbieten</label>
  <label class="check"><input type="checkbox" bind:checked={form.cabins} /> Kabinen für Damen und Herren angeben</label>
  <ErrorNote error={action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={action.busy}>{submitLabel}</Button>
    <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
  </div>
</form>
