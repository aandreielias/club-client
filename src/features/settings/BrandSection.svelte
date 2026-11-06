<script lang="ts">
  import { CONFIRM } from '../../channels';
  import { bus, session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { BRAND_FONTS } from '../../lib/theme/fonts';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { BRAND_PARTS } from './brandForm';

  /** Einstellungen › Erscheinungsbild (admin/board): the club's look for everyone; each entry opens in the window. */
  const brand = $derived(session.club!.brand);
  const logos = $derived(Object.values(session.club!.assets).filter(Boolean).length);
  const details: Record<string, () => string> = {
    look: () => `${BRAND_FONTS[brand.headingFont].label} / ${BRAND_FONTS[brand.textFont].label} · ${brand.primary}`,
    mail: () => (brand.mailGreeting || brand.mailSignOff || brand.mailFooter ? 'Eigene Texte' : 'Standardtexte'),
    logos: () => `${logos} von 4 Bildern`,
  };
  const rows = $derived(Object.entries(BRAND_PARTS).map(([key, label]) => ({ key, label, detail: details[key](), archived: false, inUse: false })));

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

<div class="stack">
  <p class="muted small">So sehen die Website und die E-Mails des Vereins für alle aus.</p>
  <SettingsList {rows} kind="brand" />
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
