<script lang="ts">
  import { permissions, preferences, windows } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Select from '../../ui/Select.svelte';
  import type { Dock } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Field from '../../ui/Field.svelte';

  const options = <T extends object>(map: T) =>
    (Object.entries(map) as [Extract<keyof T, string>, { label: string }][]).map(([value, option]) => ({ value, label: option.label }));

  const SCHEMES = [
    { value: 'light', label: 'Hell' },
    { value: 'dark', label: 'Dunkel' },
    { value: 'system', label: 'System' },
  ] as const;
  const VIEWS = [
    { value: 'month', label: 'Monat' },
    { value: 'week', label: 'Woche' },
  ] as const;
  const HOURS = Array.from({ length: 25 }, (_, h) => ({ value: String(h), label: `${h} Uhr` }));
  const clubAction = new Action();
  const hasClub = $derived(Object.keys(preferences.club).length > 0);

  const DOCKS: readonly { value: Dock; label: string }[] = [
    { value: 'center', label: 'Mitte' },
    { value: 'side', label: 'Seite' },
    { value: 'bottom', label: 'Unten' },
  ];
</script>

<div class="stack">
  <Field label="Kalender öffnet mit" group>
    <ChoiceGroup
      name="calendar-view-pref"
      label="Kalender öffnet mit"
      options={VIEWS}
      bind:value={() => preferences.values.calendarView, (v) => v && preferences.set('calendarView', v)}
    />
  </Field>

  <Field label="Woche zeigt" hint="Stunden der Wochenansicht; mindestens vier.">
    <div class="row">
      <Select
        aria-label="Von"
        options={HOURS.slice(0, 21)}
        bind:value={
          () => String(preferences.values.weekStartHour),
          (v) => preferences.set('weekStartHour', Math.min(Number(v), preferences.values.weekEndHour - 4))
        }
      />
      <span>bis</span>
      <Select
        aria-label="Bis"
        options={HOURS.slice(4)}
        bind:value={
          () => String(preferences.values.weekEndHour),
          (v) => preferences.set('weekEndHour', Math.max(Number(v), preferences.values.weekStartHour + 4))
        }
      />
    </div>
  </Field>

  <Field label="Farbschema" group>
    <ChoiceGroup
      name="scheme"
      label="Farbschema"
      options={SCHEMES}
      bind:value={() => preferences.values.scheme, (v) => v && preferences.set('scheme', v)}
    />
  </Field>

  <Field label="Schriftgröße" group>
    <ChoiceGroup
      name="font-size"
      label="Schriftgröße"
      options={options(preferences.appearance.fontSizes)}
      bind:value={() => preferences.values.fontSize, (v) => v && preferences.set('fontSize', v)}
    />
  </Field>
  <Field label="Dichte" group>
    <ChoiceGroup
      name="density"
      label="Dichte"
      options={options(preferences.appearance.densities)}
      bind:value={() => preferences.values.density, (v) => v && preferences.set('density', v)}
    />
  </Field>

  <Field label="Fenster öffnen" group>
    <ChoiceGroup name="dock" label="Fenster öffnen" options={DOCKS} bind:value={() => windows.dock, (v) => v && windows.setDock(v)} />
  </Field>

  <label class="check">
    <input type="checkbox" checked={preferences.values.reduceMotion} onchange={(e) => preferences.set('reduceMotion', e.currentTarget.checked)} />
    Animationen reduzieren
  </label>

  <div><Button onclick={() => preferences.reset()}>Darstellung zurücksetzen</Button></div>

  {#if permissions.isManager}
    <Field
      label="Standard für den Verein"
      group
      hint="Startseite, Reihenfolge der Seitenleiste, Kalender- und Dateiansicht so, wie du sie eingestellt hast, für alle, die selbst nichts gewählt haben. Farben und Schriften kommen aus dem Erscheinungsbild."
    >
      <div class="row">
        <Button busy={clubAction.busy} onclick={() => clubAction.run(() => preferences.saveClubDefaults())}>Meine Einstellungen als Standard</Button>
        {#if hasClub}
          <Button busy={clubAction.busy} onclick={() => clubAction.run(() => preferences.removeClubDefaults())}>Standard entfernen</Button>
        {/if}
      </div>
      <ErrorNote error={clubAction.error} />
    </Field>
  {/if}
</div>
