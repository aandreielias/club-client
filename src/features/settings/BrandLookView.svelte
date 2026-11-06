<script lang="ts">
  import { session } from '../../lib/container';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import { contrast } from '../../lib/theme/contrast';
  import { BRAND_FONTS } from '../../lib/theme/fonts';
  import { ThemeService } from '../../lib/theme/ThemeService';
  import type { Brand, BrandFont } from '../../lib/types';
  import { settings } from '../../settings';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { BRAND_COLORS, brandOf, formOf, validBrand, type BrandForm } from './brandForm';

  /** Erscheinungsbild › Farben, Schrift und Ecken: the form and a preview made of the real components in the draft's look. */
  const draft = new SettingsDraft<BrandForm>(formOf(session.club!.brand));
  const FONTS = (Object.entries(BRAND_FONTS) as [BrandFont, { label: string }][]).map(([value, font]) => ({ value, label: font.label }));

  const valid = $derived(validBrand(draft.value, session.club!.brand));

  /** Readability on a white page (WCAG 4.5:1 for text). */
  const warnings = $derived<Partial<Record<keyof Brand, string>>>({
    primary: contrast(valid.primary, '#ffffff') < 4.5 ? 'Zu hell für Links und Knopfschrift auf Weiß.' : undefined,
    text: contrast(valid.text, valid.tint) < 4.5 ? 'Auf der Fläche schwer lesbar.' : undefined,
    textMuted: contrast(valid.textMuted, '#ffffff') < 4.5 ? 'Auf Weiß schwer lesbar.' : undefined,
  });

  let scheme = $state<'light' | 'dark'>('light');
  const SCHEMES = [
    { value: 'light', label: 'Hell' },
    { value: 'dark', label: 'Dunkel' },
  ] as const;
  const style = $derived(ThemeService.vars(ThemeService.branded(settings.theme, valid), scheme === 'dark'));

  // Fonts load on first use, also those only tried out here.
  $effect(() => {
    void BRAND_FONTS[draft.value.headingFont]?.load?.();
    void BRAND_FONTS[draft.value.textFont]?.load?.();
  });

  async function save(value: BrandForm): Promise<BrandForm> {
    await session.updateBrand(brandOf(value));
    return formOf(session.club!.brand);
  }

  // Preview controls only; nothing is stored.
  let answer = $state<'yes' | 'maybe' | 'no'>('yes');
  let team = $state<'d1' | 'h1'>('d1');
  let remind = $state(true);
</script>

<SettingsForm
  title="Farben, Schrift und Ecken"
  intro="So sieht die Website für alle aus. Im dunklen Modus werden die Farben automatisch aufgehellt, bis sie lesbar sind."
  {draft}
  onsave={save}
  hint="Gilt sofort für alle Mitglieder"
>
  <h3>Farben</h3>
  <div class="grid-2">
    {#each BRAND_COLORS as color (color.key)}
      <Field label={color.label} hint={warnings[color.key] ?? color.hint}>
        <span class="color">
          <input type="color" bind:value={draft.value[color.key] as string} aria-label="{color.label} wählen" />
          <input class="mono" bind:value={draft.value[color.key] as string} maxlength="7" pattern="#[0-9A-Fa-f]{6}" />
        </span>
      </Field>
    {/each}
  </div>

  <h3>Schrift und Ecken</h3>
  <div class="grid-2">
    <Field label="Überschriften">
      <Select bind:value={draft.value.headingFont} options={FONTS} aria-label="Schrift der Überschriften" />
    </Field>
    <Field label="Text">
      <Select bind:value={draft.value.textFont} options={FONTS} aria-label="Schrift des Texts" />
    </Field>
  </div>
  <label class="check">
    <input type="checkbox" bind:checked={draft.value.headingCaps} />
    Überschriften in Großbuchstaben
  </label>
  <div class="grid-2">
    <Field label="Ecken klein (px)" hint="Felder, Knöpfe; 0 bis 12">
      <input type="number" bind:value={draft.value.radiusSmall} min="0" max="12" step="1" />
    </Field>
    <Field label="Ecken groß (px)" hint="Karten, Fenster; 0 bis 24">
      <input type="number" bind:value={draft.value.radiusLarge} min="0" max="24" step="1" />
    </Field>
  </div>

  <h3>Browser</h3>
  <Field label="App-Name" hint="Im Browser-Tab; leer = Vereinsname">
    <input bind:value={draft.value.appName} maxlength="30" />
  </Field>

  <div class="row between">
    <h3>Vorschau</h3>
    <ChoiceGroup name="brand-scheme" label="Farbschema der Vorschau" options={SCHEMES} bind:value={scheme} size="sm" />
  </div>
  <div class="preview" {style}>
    <nav class="nav" aria-label="Vorschau Seitenleiste">
      <span class="entry active">Kalender</span>
      <span class="entry">Aufgaben</span>
      <span class="entry">Dateien</span>
    </nav>
    <div class="content stack">
      <h1>Training Damen 1</h1>
      <p>Mittwoch, 18:00 <span class="muted">· Turnhalle Nord</span> · <a href="#vorschau" onclick={(e) => e.preventDefault()}>Wegbeschreibung</a></p>
      <div class="row">
        <Tag tone="success">Zugesagt</Tag>
        <Tag tone="warning">Vielleicht</Tag>
        <Tag tone="danger">Abgesagt</Tag>
        <Tag>Training</Tag>
      </div>
      <ChoiceGroup
        name="brand-preview-answer"
        label="Antwort"
        options={[
          { value: 'yes', label: 'Ja' },
          { value: 'maybe', label: 'Vielleicht' },
          { value: 'no', label: 'Nein' },
        ]}
        bind:value={answer}
      />
      <div class="grid-2">
        <Field label="Notiz">
          <input placeholder="Komme etwas später" />
        </Field>
        <Field label="Team">
          <Select
            bind:value={team}
            options={[
              { value: 'd1', label: 'Damen 1' },
              { value: 'h1', label: 'Herren 1' },
            ]}
            aria-label="Team"
          />
        </Field>
      </div>
      <label class="check"><input type="checkbox" bind:checked={remind} /> Erinnern</label>
      <div class="row">
        <Button variant="primary" type="button" tooltip="Nur Vorschau">Zusagen</Button>
        <Button type="button">Bearbeiten</Button>
        <Button variant="ghost" type="button">Abbrechen</Button>
        <Button variant="danger" type="button">Löschen</Button>
      </div>
    </div>
  </div>
</SettingsForm>

<style>
  .color {
    display: flex;
    gap: var(--space-xs);
  }
  .color input[type='color'] {
    width: var(--control-height);
    flex: none;
    padding: 2px;
  }
  .between {
    justify-content: space-between;
    align-items: center;
  }
  .between h3 {
    margin: 0;
  }
  .preview {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-elevated);
    color: var(--color-text);
    font-family: var(--font-family);
  }
  .nav {
    display: grid;
    align-content: start;
    gap: var(--space-xxs);
    padding: var(--space-sm);
    background: var(--color-surface);
    color: var(--color-text-muted);
  }
  .entry {
    position: relative;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-md);
    cursor: default;
  }
  .entry:hover,
  .entry.active {
    background: color-mix(in srgb, var(--color-text) 7%, transparent);
    color: var(--color-text);
  }
  .entry.active::before {
    position: absolute;
    inset: 6px auto 6px 0;
    width: 3px;
    border-radius: var(--radius-full);
    background: var(--color-highlight);
    content: '';
  }
  .content {
    padding: var(--space-md);
  }
  .content h1,
  .content p {
    margin: 0;
  }
  :global([data-layout='compact']) .preview {
    grid-template-columns: 1fr;
  }
</style>
