<script lang="ts">
  import { bus } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { CALENDAR_SETTINGS_CHANGED } from './events';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import type { CalendarSettings } from './model';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import { calendarApi, calendarSettings } from './services';

  /** Einstellungen › Kalender › Kalender-Regeln (admin/board): cabin labels, item reminder, open answers, car pool seats. */
  const load = new Action();
  const draft = new SettingsDraft<CalendarSettings>({ cabinLabels: [], itemRemindHours: 24, openAnswerDays: 14, maxRideSeats: 8 });
  void load.run(async () => draft.load(await calendarApi.settings()));
  useBus(bus, CALENDAR_SETTINGS_CHANGED, () => void calendarApi.settings().then((s) => draft.refresh(s)));
</script>

<div class="stack">
  <ErrorNote error={load.error} />
  <SettingsForm
    title="Kalender-Regeln"
    intro="Gilt für alle Termine des Vereins."
    {draft}
    onsave={async (value) => {
      const saved = await calendarApi.saveSettings({ ...value, cabinLabels: value.cabinLabels.map((l) => l?.trim()).filter(Boolean) });
      calendarSettings.set(saved);
      return saved;
    }}
  >
    <Field
      label="Kabinen"
      hint="Bis zu vier Bezeichnungen, z. B. Herren und Damen. Termine, deren Art Kabinen anbietet, bekommen je ein Feld. Termine merken sich die Kabinen nach der Reihenfolge; leere Felder entfallen."
    >
      <div class="grid-2">
        {#each [0, 1, 2, 3] as i (i)}
          <input bind:value={draft.value.cabinLabels[i]} maxlength="40" placeholder="Kabine {i + 1}" aria-label="Kabine {i + 1}" />
        {/each}
      </div>
    </Field>
    <Field label="Erinnerung an Mitzubringendes" hint="Wer Material für einen Termin hat, wird so viele Stunden davor erinnert (1 bis 336).">
      <input type="number" min="1" max="336" bind:value={draft.value.itemRemindHours} class="short" />
    </Field>
    <Field label="Offene Antworten" hint="So viele Tage im Voraus listet die Startseite Termine ohne Antwort (7 bis 60).">
      <input type="number" min="7" max="60" bind:value={draft.value.openAnswerDays} class="short" />
    </Field>
    <Field label="Plätze pro Fahrgemeinschaft" hint="Höchstens so viele freie Plätze bietet ein Auto oder Bus an (1 bis 50).">
      <input type="number" min="1" max="50" bind:value={draft.value.maxRideSeats} class="short" />
    </Field>
  </SettingsForm>
</div>
