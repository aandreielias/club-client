<script lang="ts">
  import { CONFIRM, TOAST } from '../../channels';
  import { bus, session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import { contrast } from '../../lib/theme/contrast';
  import { BRAND_FONTS } from '../../lib/theme/fonts';
  import { ThemeService } from '../../lib/theme/ThemeService';
  import type { Brand, BrandFont } from '../../lib/types';
  import { settings } from '../../settings';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import SettingFilesSection from '../files/SettingFilesSection.svelte';

  /** The club's look for everyone (admin/board): colours, fonts, corners, app name, e-mails, and the logo images. */
  type Texts = 'appName' | 'mailGreeting' | 'mailSignOff' | 'mailFooter';
  type BrandForm = Omit<Brand, Texts> & Record<Texts, string>;

  const formOf = (brand: Brand): BrandForm => ({
    ...brand,
    appName: brand.appName ?? '',
    mailGreeting: brand.mailGreeting ?? '',
    mailSignOff: brand.mailSignOff ?? '',
    mailFooter: brand.mailFooter ?? '',
  });
  const brandOf = (form: BrandForm): Brand => ({
    ...form,
    appName: form.appName.trim() || null,
    mailGreeting: form.mailGreeting.trim() || null,
    mailSignOff: form.mailSignOff.trim() || null,
    mailFooter: form.mailFooter.trim() || null,
  });
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
  const LOGOS = [
    { slot: 'LOGO', label: 'Logo', hint: 'In der Seitenleiste' },
    { slot: 'LOGO_SECONDARY', label: 'Zweitlogo', hint: 'Auf hellen Seiten wie der Anmeldung; sonst das Logo' },
    { slot: 'FAVICON', label: 'Browsersymbol', hint: 'Im Browser-Tab; sonst das Logo' },
  ] as const;

  const HEX = /^#[0-9A-Fa-f]{6}$/;
  // While a hex code is half typed, the preview and the warnings keep the saved colour.
  const valid = $derived.by((): Brand => {
    const saved = session.club!.brand;
    const v = draft.value;
    const color = (key: keyof Brand) => (HEX.test(v[key] as string) ? (v[key] as string) : (saved[key] as string));
    return {
      ...brandOf(v),
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
    await session.updateBrand(brandOf(value));
    return formOf(session.club!.brand);
  }

  const reset = new Action();
  async function resetBrand() {
    const confirmed = await bus.request(CONFIRM, {
      title: 'Standard wiederherstellen',
      message: 'Farben, Schriften, Ecken, App-Name und E-Mail-Texte gehen für alle auf den Standard zurück. Die Bilder bleiben.',
      confirmLabel: 'Wiederherstellen',
    });
    if (confirmed && (await reset.run(() => session.resetBrand()))) draft.load(formOf(session.club!.brand));
  }

  // The sample e-mail follows the draft, a moment after typing stops; a refused draft keeps the last preview.
  let mail = $state('');
  const mailError = new Action();
  $effect(() => {
    const brand = $state.snapshot(valid);
    const timer = setTimeout(() => {
      void mailError.run(async () => (mail = (await session.mailPreview(brand)).html));
    }, settings.brand.mailPreviewDebounceMs);
    return () => clearTimeout(timer);
  });

  const testMail = new Action();
  async function sendTestMail() {
    if (await testMail.run(() => session.sendTestMail(valid))) bus.publish(TOAST, { text: 'Testmail an deine Adresse gesendet.' });
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

    <h3>E-Mails</h3>
    <p class="muted small">Benachrichtigungen per E-Mail tragen Logo, Hauptfarbe und diese Texte.</p>
    <div class="grid-2">
      <Field label="Anrede" hint="{'{vorname}'} wird zum Vornamen; leer = „Hallo Vorname,“">
        <input bind:value={draft.value.mailGreeting} maxlength="100" placeholder="Hallo {'{vorname}'}," />
      </Field>
      <Field label="Grußformel" hint="Darunter steht der Vereinsname; leer = „Viele Grüße“">
        <input bind:value={draft.value.mailSignOff} maxlength="200" placeholder="Viele Grüße" />
      </Field>
    </div>
    <Field label="Fußzeile" hint="Z. B. Adresse oder Registernummer; bis 500 Zeichen">
      <textarea bind:value={draft.value.mailFooter} maxlength="500" rows="3"></textarea>
    </Field>
    <iframe class="mail" title="Vorschau der E-Mail" sandbox="" srcdoc={mail}></iframe>
    <div class="row">
      <Button busy={testMail.busy} tooltip="Diese Beispiel-E-Mail an deine eigene Adresse senden" onclick={sendTestMail}>Testmail senden</Button>
      <ErrorNote error={testMail.error ?? mailError.error} />
    </div>
    <p class="muted small">Einladungs- und Passwort-E-Mails kommen vom Anmeldedienst und werden dort gestaltet.</p>

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
      <p class="muted small">
        Aus Dateien gewählt, liegt eine Kopie im geschützten Ordner „Einstellungen“; neue Versionen des Originals werden übernommen. PNG, JPEG oder
        SVG (nur Zeichnungen, keine Skripte oder Verweise nach außen).
      </p>
    </header>
    <SettingFilesSection slots={LOGOS} />
  </section>

  <div class="row">
    <Button
      variant="ghost"
      busy={reset.busy}
      tooltip="Farben, Schriften, Ecken, App-Name und E-Mail-Texte auf den Standard zurücksetzen; die Bilder bleiben"
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
  .mail {
    width: 100%;
    height: 420px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: #fff;
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
</style>
