<script lang="ts">
  import { CONFIRM } from '../../channels';
  import { bus, session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import InfoTip from '../../ui/InfoTip.svelte';
  import SettingFilesSection from '../files/SettingFilesSection.svelte';
  import BrandLookView from './BrandLookView.svelte';
  import BrandMailView from './BrandMailView.svelte';

  /** One tab of Einstellungen › Verein › Auftritt › Erscheinungsbild (admin/board): look, e-mails or logos. */
  let { id }: { id: string } = $props();

  const LOGOS = [
    { slot: 'LOGO', label: 'Logo', hint: 'In der Seitenleiste' },
    { slot: 'LOGO_SECONDARY', label: 'Zweitlogo', hint: 'Auf hellen Seiten wie der Anmeldung; sonst das Logo' },
    { slot: 'FAVICON', label: 'Browsersymbol', hint: 'Im Browser-Tab; sonst das Logo' },
    { slot: 'MAIL_LOGO', label: 'E-Mail-Logo', hint: 'PNG oder JPEG; Mailprogramme zeigen kein SVG. Sonst das Logo, wenn es kein SVG ist' },
  ] as const;

  const reset = new Action();
  async function resetBrand() {
    const confirmed = await bus.request(CONFIRM, {
      title: 'Standard wiederherstellen',
      message: 'Farben, Schriften, Ecken, App-Name und E-Mail-Texte gehen für alle auf den Standard zurück. Die Bilder bleiben.',
      confirmLabel: 'Wiederherstellen',
    });
    if (confirmed) await reset.run(() => session.resetBrand());
  }
</script>

{#if id === 'look'}
  <div class="stack">
    <BrandLookView />
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
{:else if id === 'mail'}
  <BrandMailView />
{:else if id === 'logos'}
  <section class="panel stack" aria-label="Logos">
    <header>
      <h2>
        Logos&nbsp;<InfoTip
          text="Aus Dateien gewählt, liegt eine Kopie im geschützten Ordner „Einstellungen“; neue Versionen des Originals werden übernommen. PNG, JPEG oder SVG (nur Zeichnungen, keine Skripte oder Verweise nach außen)."
        />
      </h2>
    </header>
    <SettingFilesSection slots={LOGOS} />
  </section>
{/if}
