<script lang="ts">
  import { session } from '../../lib/container';
  import EditorForm from '../../ui/EditorForm.svelte';
  import type { Action } from '../../lib/state/Action.svelte';
  import type { Hue } from '../../lib/types';
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
  /** Off club-wide, the type's own switch has no effect; it stays as saved for when the club turns car pools on again. */
  const clubRides = $derived(session.club?.ridesEnabled !== false);
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit}>
  <div class="grid-2">
    <Field label="Bezeichnung">
      <input bind:value={form.label} maxlength="40" required />
    </Field>
    <Field group label="Farbe" hint="So steht die Terminart im Kalender.">
      <ColorSwatches label="Farbe" options={HUE_OPTIONS} bind:value={form.hue} />
    </Field>
  </div>
  {#if clubRides}
    <label class="check"><input type="checkbox" bind:checked={form.rides} /> Fahrgemeinschaften anbieten</label>
  {:else}
    <Field group label="Fahrgemeinschaften" hint="Im Verein ausgeschaltet (Einstellungen › Termine, oben).">
      <label class="check"><input type="checkbox" checked={form.rides} disabled /> Fahrgemeinschaften anbieten</label>
    </Field>
  {/if}
  <label class="check"><input type="checkbox" bind:checked={form.cabins} /> Kabinen für Damen und Herren angeben</label>
  <Field label="An Antwort erinnern" hint="Stunden vor Beginn; wer noch nicht zu- oder abgesagt hat, bekommt eine Erinnerung. Leer: nie.">
    <input
      type="number"
      min="1"
      max="336"
      class="short"
      placeholder="nie"
      bind:value={() => form.remindHours ?? '', (v) => (form.remindHours = v === '' || v == null ? null : Math.round(Number(v)))}
    />
  </Field>
</EditorForm>

<style>
  .short {
    width: 6rem;
  }
</style>
