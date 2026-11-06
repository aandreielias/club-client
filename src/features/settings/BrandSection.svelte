<script lang="ts">
  import { CONFIRM, TOAST } from '../../channels';
  import { bus, session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import { contrast } from '../../lib/theme/contrast';
  import { BRAND_FONTS } from '../../lib/theme/fonts';
  import { ThemeService } from '../../lib/theme/ThemeService';
  import type { Brand, BrandAssetKind, BrandAssets, BrandFont } from '../../lib/types';
  import { settings } from '../../settings';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';

  /** The club's look for everyone (admin/board): colours, fonts, corners, app name, and the logo images. */
  type BrandForm = Omit<Brand, 'appName'> & { appName: string };

  const formOf = (brand: Brand): BrandForm => ({ ...brand, appName: brand.appName ?? '' });
  const draft = new SettingsDraft<BrandForm>(formOf(session.club!.brand));

  const COLORS: readonly { key: keyof Brand; label: string; hint: string }[] = [
    { key: 'primary', label: 'Hauptfarbe', hint: 'Knöpfe, Links, Auswahl' },
    { key: 'primaryHover', label: 'Hauptfarbe dunkel', hint: 'Knöpfe unter dem Mauszeiger' },
    { key: 'accent', label: 'Akzentfarbe', hint: 'Nur kleine Markierungen, nie Schrift' },
    { key: 'tint', label: 'Fläche', hint: 'Seitenleiste und ruhige Flächen' },
    { key: 'text', label: 'Schrift', hint: 'Fließtext' },
    { key: 'textMuted', label: 'Schrift dezent', hint: 'Nebentexte und Beschriftungen' },
    { key: 'line', label: 'Linien', hint: 'Rahmen und Trennlinien' },
  ];
  const FONTS = (Object.entries(BRAND_FONTS) as [BrandFont, { label: string }][]).map(([value, font]) => ({ value, label: font.label }));
  const ASSETS: readonly { kind: BrandAssetKind; key: keyof BrandAssets; label: string; hint: string }[] = [
    { kind: 'logo', key: 'logo', label: 'Logo', hint: 'In der Seitenleiste' },
    { kind: 'logo-secondary', key: 'logoSecondary', label: 'Zweitlogo', hint: 'Auf hellen Seiten wie der Anmeldung; sonst das Logo' },
    { kind: 'favicon', key: 'favicon', label: 'Browsersymbol', hint: 'Im Browser-Tab; sonst das Logo' },
  ];

  const HEX = /^#[0-9A-Fa-f]{6}$/;
  // While a hex code is half typed, the preview and the warnings keep the saved colour.
  const valid = $derived.by((): Brand => {
    const saved = session.club!.brand;
    const v = draft.value;
    const color = (key: keyof Brand) => (HEX.test(v[key] as string) ? (v[key] as string) : (saved[key] as string));
    return {
      ...v,
      appName: v.appName || null,
      ...Object.fromEntries(COLORS.map(({ key }) => [key, color(key)])),
      radiusSmall: Number.isInteger(v.radiusSmall) ? v.radiusSmall : saved.radiusSmall,
      radiusLarge: Number.isInteger(v.radiusLarge) ? v.radiusLarge : saved.radiusLarge,
    };
  });

  /** Readability on a white page (WCAG 4.5:1 for text). */
  const warnings = $derived<Partial<Record<keyof Brand, string>>>({
    primary: contrast(valid.primary, '#ffffff') < 4.5 ? 'Zu hell für Links und Knopfschrift auf Weiß.' : undefined,
    text: contrast(valid.text, valid.tint) < 4.5 ? 'Auf der Fläche schwer lesbar.' : undefined,
    textMuted: contrast(valid.textMuted, '#ffffff') < 4.5 ? 'Auf Weiß schwer lesbar.' : undefined,
  });

  const preview = $derived.by(() => {
    const theme = ThemeService.branded(settings.theme, valid);
    const c = theme.colors.light;
    return Object.entries({
      'color-accent': c.accent,
      'color-on-accent': c.onAccent,
      'color-highlight': c.highlight,
      'color-text': c.text,
      'color-text-muted': c.textMuted,
      'color-surface': c.surface,
      'color-border': c.border,
      'color-elevated': c.elevated,
      'font-family': theme.font.family,
      'font-display': theme.font.display,
      'font-display-weight': theme.font.displayWeight,
      'font-display-transform': theme.font.displayTransform,
      'font-display-tracking': theme.font.displayTracking,
      'radius-md': theme.radius.md,
      'radius-lg': theme.radius.lg,
    })
      .map(([name, value]) => `--${name}: ${value}`)
      .join('; ');
  });
  // Fonts load on first use, also those only tried out here.
  $effect(() => {
    void BRAND_FONTS[draft.value.headingFont]?.load?.();
    void BRAND_FONTS[draft.value.textFont]?.load?.();
  });

  async function save(value: BrandForm): Promise<BrandForm> {
    await session.updateBrand({ ...value, appName: value.appName.trim() || null });
    return formOf(session.club!.brand);
  }

  const reset = new Action();
  async function resetBrand() {
    const confirmed = await bus.request(CONFIRM, {
      title: 'Standard wiederherstellen',
      message: 'Farben, Schriften, Ecken und App-Name gehen für alle auf den Standard zurück. Die Bilder bleiben.',
      confirmLabel: 'Wiederherstellen',
    });
    if (confirmed && (await reset.run(() => session.resetBrand()))) draft.load(formOf(session.club!.brand));
  }

  const upload = new Action();
  let input = $state<HTMLInputElement>();
  let picking: BrandAssetKind = 'logo';

  function pick(kind: BrandAssetKind) {
    picking = kind;
    input?.click();
  }

  async function picked(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file && (await upload.run(() => session.uploadBrandAsset(picking, file)))) bus.publish(TOAST, { text: 'Bild gespeichert.' });
  }
</script>

<div class="stack">
  <SettingsForm
    title="Erscheinungsbild"
    intro="So sieht die Website für alle aus. Im dunklen Modus werden die Farben automatisch aufgehellt, bis sie lesbar sind."
    {draft}
    onsave={save}
    hint="Gilt sofort für alle Mitglieder"
  >
    <h3>Farben</h3>
    <div class="grid-2">
      {#each COLORS as color (color.key)}
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

    <h3>Vorschau</h3>
    <div class="preview" style={preview} aria-hidden="true">
      <div class="nav"><span class="entry active">Kalender</span><span class="entry">Aufgaben</span></div>
      <div class="content">
        <h1>Training Damen 1</h1>
        <p>Mittwoch, 18:00 <span class="soft">· Turnhalle Nord</span></p>
        <span class="button">Zusagen</span>
      </div>
    </div>
  </SettingsForm>

  <section class="panel stack" aria-label="Bilder">
    <header>
      <h2>Bilder</h2>
      <p class="muted small">SVG oder PNG, höchstens 512 KB. SVGs dürfen nur Zeichnungen enthalten (keine Skripte oder Verweise nach außen).</p>
    </header>
    <input bind:this={input} type="file" accept="image/svg+xml,image/png,.svg,.png" onchange={picked} hidden />
    {#each ASSETS as asset (asset.kind)}
      {@const url = session.club!.assets[asset.key]}
      <div class="asset">
        <span class="thumb"
          >{#if url}<img src={url} alt="" />{/if}</span
        >
        <span class="stack-tight">
          <strong>{asset.label}</strong>
          <span class="muted small">{asset.hint}</span>
        </span>
        <span class="row">
          <Button icon="upload" busy={upload.busy} onclick={() => pick(asset.kind)}>Hochladen</Button>
          {#if url}
            <Button
              variant="danger"
              icon="delete"
              tooltip="{asset.label} entfernen"
              onclick={() => upload.run(() => session.deleteBrandAsset(asset.kind))}
            />
          {/if}
        </span>
      </div>
    {/each}
    <ErrorNote error={upload.error} />
  </section>

  <div class="row">
    <Button
      variant="ghost"
      busy={reset.busy}
      tooltip="Farben, Schriften, Ecken und App-Name auf den Standard zurücksetzen; die Bilder bleiben"
      onclick={resetBrand}>Standard wiederherstellen</Button
    >
    <ErrorNote error={reset.error} />
  </div>
</div>

<style>
  h3 {
    margin: var(--space-sm) 0 0;
  }
  .color {
    display: flex;
    gap: var(--space-xs);
  }
  .color input[type='color'] {
    width: var(--control-height);
    flex: none;
    padding: 2px;
  }
  .preview {
    display: grid;
    grid-template-columns: 140px 1fr;
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
  }
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
    display: grid;
    justify-items: start;
    gap: var(--space-xs);
    padding: var(--space-md);
  }
  .content h1 {
    margin: 0;
  }
  .content p {
    margin: 0;
  }
  .soft {
    color: var(--color-text-muted);
  }
  .button {
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: var(--font-weight-medium);
  }
  .asset {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    align-items: center;
    gap: var(--space-md);
  }
  .thumb {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
  .thumb img {
    max-width: 40px;
    max-height: 40px;
  }
  .stack-tight {
    display: grid;
  }
</style>
