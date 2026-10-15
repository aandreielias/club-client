<script lang="ts">
  import { preferences, windows } from '../../lib/container';
  import type { Preferences } from '../../lib/preferences/PreferencesService.svelte';
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

  const accents = Object.entries(preferences.appearance.accents) as [Preferences['accent'], { label: string; color: string }][];
</script>

<div class="stack section">
  <Field label="Farbschema">
    <ChoiceGroup name="scheme" label="Farbschema" options={SCHEMES}
      bind:value={() => preferences.values.scheme, (v) => v && preferences.set('scheme', v)} />
  </Field>

  <fieldset class="accents">
    <legend>Akzentfarbe</legend>
    <div class="swatches">
      {#each accents as [key, accent] (key)}
        <label class="swatch" class:checked={preferences.values.accent === key}>
          <input type="radio" name="accent" value={key} checked={preferences.values.accent === key}
            onchange={() => preferences.set('accent', key)} />
          <span class="dot" style:background={accent.color} aria-hidden="true"></span>
          {accent.label}
        </label>
      {/each}
    </div>
  </fieldset>

  <div class="grid-2">
    <Field label="Schriftgröße">
      <ChoiceGroup name="font-size" label="Schriftgröße" options={options(preferences.appearance.fontSizes)}
        bind:value={() => preferences.values.fontSize, (v) => v && preferences.set('fontSize', v)} />
    </Field>
    <Field label="Dichte">
      <ChoiceGroup name="density" label="Dichte" options={options(preferences.appearance.densities)}
        bind:value={() => preferences.values.density, (v) => v && preferences.set('density', v)} />
    </Field>
  </div>

  <Field label="Fenster öffnen">
    <ChoiceGroup name="dock" label="Fenster öffnen" options={DOCKS} bind:value={() => windows.dock, (v) => v && windows.setDock(v)} />
  </Field>

  <label class="check">
    <input type="checkbox" checked={preferences.values.reduceMotion} onchange={(e) => preferences.set('reduceMotion', e.currentTarget.checked)} />
    Animationen reduzieren
  </label>

  <div><Button variant="ghost" onclick={() => preferences.reset()}>Darstellung zurücksetzen</Button></div>
</div>

<style>
  .accents {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .swatch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    min-height: var(--control-height);
    padding: 0 var(--control-padding-x);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .swatch.checked {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-accent);
  }
  .swatch:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .swatch input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
</style>
