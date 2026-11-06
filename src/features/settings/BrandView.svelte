<script lang="ts">
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import SettingFilesSection from '../files/SettingFilesSection.svelte';
  import BrandLookView from './BrandLookView.svelte';
  import BrandMailView from './BrandMailView.svelte';
  import { BRAND_PARTS } from './brandForm';

  /** One entry of Einstellungen › Erscheinungsbild in the window (admin/board): look, e-mails or logos. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  const LOGOS = [
    { slot: 'LOGO', label: 'Logo', hint: 'In der Seitenleiste' },
    { slot: 'LOGO_SECONDARY', label: 'Zweitlogo', hint: 'Auf hellen Seiten wie der Anmeldung; sonst das Logo' },
    { slot: 'FAVICON', label: 'Browsersymbol', hint: 'Im Browser-Tab; sonst das Logo' },
    { slot: 'MAIL_LOGO', label: 'E-Mail-Logo', hint: 'PNG oder JPEG; Mailprogramme zeigen kein SVG. Sonst das Logo, wenn es kein SVG ist' },
  ] as const;

  $effect(() => handle?.setTitle(BRAND_PARTS[id] ?? 'Erscheinungsbild'));
</script>

{#if id === 'look'}
  <BrandLookView />
{:else if id === 'mail'}
  <BrandMailView />
{:else if id === 'logos'}
  <section class="panel stack" aria-label="Logos">
    <header>
      <h2>Logos</h2>
      <p class="muted small">
        Aus Dateien gewählt, liegt eine Kopie im geschützten Ordner „Einstellungen“; neue Versionen des Originals werden übernommen. PNG, JPEG oder
        SVG (nur Zeichnungen, keine Skripte oder Verweise nach außen).
      </p>
    </header>
    <SettingFilesSection slots={LOGOS} />
  </section>
{/if}
