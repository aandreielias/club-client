<script lang="ts">
  import { settings } from '../../settings';
  import EditorForm from '../../ui/EditorForm.svelte';
  import type { Action } from '../../lib/state/Action.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import ColorSwatches from '../../ui/ColorSwatches.svelte';
  import { HUES, HUE_LABELS, type AppointmentTypeInput, type ExpectAnswers } from './model';

  /** Form of an appointment type: name, colour, car pools, cabins, result and plan blocks, defaults and answer rules. */
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

  const HUE_OPTIONS = HUES.map((h) => ({ value: h, label: HUE_LABELS[h], hue: h }));
  const EXPECT_OPTIONS: readonly { value: ExpectAnswers; label: string }[] = [
    { value: 'TEAM', label: 'Die Mannschaft' },
    { value: 'CLUB', label: 'Alle Mitglieder (vereinsweite Termine)' },
    { value: 'NONE', label: 'Niemand (keine Zu- und Absagen)' },
  ];
  const hours = (v: unknown) => (v === '' || v == null ? null : Math.round(Number(v)));
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
  <div class="grid-2">
    <Field label="Bezeichnung" error={submitted && !form.label.trim() ? 'Bezeichnung mit 1 bis 40 Zeichen angeben.' : null}>
      <input bind:value={form.label} maxlength={settings.calendar.typeLabelMaxLength} required />
    </Field>
    <Field group label="Farbe" hint="So steht die Terminart im Kalender.">
      <ColorSwatches label="Farbe" options={HUE_OPTIONS} bind:value={form.hue} />
    </Field>
  </div>
  <label class="check"><input type="checkbox" bind:checked={form.rides} /> Fahrgemeinschaften anbieten</label>
  <label class="check"><input type="checkbox" bind:checked={form.cabins} /> Kabinen angeben</label>
  <Field label="An Antwort erinnern" hint="Stunden vor Beginn; wer noch nicht zu- oder abgesagt hat, bekommt eine Erinnerung. Leer: nie.">
    <input
      type="number"
      min="1"
      max={settings.calendar.maxRemindHours}
      class="short"
      placeholder="nie"
      bind:value={() => form.remindHours ?? '', (v) => (form.remindHours = hours(v))}
    />
  </Field>
  <Field label="Nochmals erinnern" hint="Stunden vor Beginn, weniger als bei der ersten Erinnerung. Leer: keine zweite Erinnerung.">
    <input
      type="number"
      min="1"
      max={form.remindHours ? form.remindHours - 1 : 1}
      class="short"
      placeholder="nie"
      disabled={!form.remindHours}
      bind:value={() => form.remindAgainHours ?? '', (v) => (form.remindAgainHours = hours(v))}
    />
  </Field>
  <label class="check"><input type="checkbox" bind:checked={form.hasResult} /> Ergebnis eintragen (Gegner, Heim/Auswärts, Sätze)</label>
  <Field label="Überschrift für Inhalt" hint="Etwa „Trainingsinhalt“: ein Textblock im Termin. Leer: keiner.">
    <input
      maxlength={settings.calendar.typeLabelMaxLength}
      placeholder="keiner"
      bind:value={() => form.planLabel ?? '', (v) => (form.planLabel = v.trim() ? v : null)}
    />
  </Field>
  <div class="grid-3">
    <Field label="Beginn" hint="Neue Termine dieser Art beginnen um diese Uhrzeit."
      ><input type="time" bind:value={form.defaultStart} required /></Field
    >
    <Field label="Dauer (Minuten)"
      ><input type="number" min="5" max={form.maxDays * 24 * 60} class="short" bind:value={form.defaultMinutes} required /></Field
    >
    <Field label="Höchstens Tage" hint="So lange darf ein Termin dieser Art dauern."
      ><input type="number" min="1" max={settings.calendar.maxDurationDays} class="short" bind:value={form.maxDays} required /></Field
    >
  </div>
  <Field label="Antwortschluss" hint="Stunden vor Beginn, ab denen niemand mehr zu- oder absagen kann. 0: bis zum Beginn.">
    <input type="number" min="0" max={settings.calendar.maxRemindHours} class="short" bind:value={form.answerDeadlineHours} required />
  </Field>
  <label class="check"><input type="checkbox" bind:checked={form.allowMaybe} /> „Vielleicht“ anbieten</label>
  <label class="check"><input type="checkbox" bind:checked={form.reasonOnNo} /> Absage nur mit Begründung</label>
  <Field
    label="Wer sagt zu oder ab"
    hint="Wer als offen gilt und erinnert wird. Alle Mitglieder: bei vereinsweiten Terminen, Eltern antworten für ihre Kinder."
  >
    <Select options={EXPECT_OPTIONS} bind:value={form.expectAnswers} />
  </Field>
  <label class="check"><input type="checkbox" bind:checked={form.notifyChanges} /> Neue Zeit oder neuen Ort mitteilen</label>
  <Field label="Verschiebung ab Minuten" hint="Kleinere Verschiebungen werden nicht mitgeteilt; Zusagen bleiben bestätigt.">
    <input
      type="number"
      min="0"
      max={settings.calendar.maxShiftMinutes}
      class="short"
      disabled={!form.notifyChanges}
      bind:value={form.minShiftMinutes}
      required
    />
  </Field>
  <label class="check"><input type="checkbox" bind:checked={form.selfCheckIn} /> Selbst einchecken (während des Termins)</label>
</EditorForm>
