<script lang="ts">
  import { preferences, windows } from '../../lib/container';
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
  const DOCKS: readonly { value: Dock; label: string }[] = [
    { value: 'center', label: 'Mitte' },
    { value: 'side', label: 'Seite' },
    { value: 'bottom', label: 'Unten' },
  ];
</script>

<div class="stack">
  <Field label="Farbschema" group>
    <ChoiceGroup
      name="scheme"
      label="Farbschema"
      options={SCHEMES}
      bind:value={() => preferences.values.scheme, (v) => v && preferences.set('scheme', v)}
    />
  </Field>

  <div class="grid-2">
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
  </div>

  <Field label="Fenster öffnen" group>
    <ChoiceGroup name="dock" label="Fenster öffnen" options={DOCKS} bind:value={() => windows.dock, (v) => v && windows.setDock(v)} />
  </Field>

  <label class="check">
    <input type="checkbox" checked={preferences.values.reduceMotion} onchange={(e) => preferences.set('reduceMotion', e.currentTarget.checked)} />
    Animationen reduzieren
  </label>

  <div><Button variant="ghost" onclick={() => preferences.reset()}>Darstellung zurücksetzen</Button></div>
</div>
