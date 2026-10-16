<script lang="ts">
  import { homeSections, preferences, session } from '../../lib/container';
  import { HomeSections } from '../../lib/home/HomeSections';
  import Button from '../../ui/Button.svelte';
  import SortableList from '../../ui/SortableList.svelte';

  /** Which sections the start page shows and in which order. */
  const sections = $derived(homeSections.ordered(preferences.values.homeOrder, (...roles) => session.hasRole(...roles)));
  const items = $derived(sections.map((s) => ({ key: s.id, label: s.label })));

  function shown(id: string): boolean {
    const section = sections.find((s) => s.id === id);
    return !!section && HomeSections.isShown(section, preferences.values.homeShown);
  }

  function toggle(id: string, on: boolean) {
    preferences.set('homeShown', { ...preferences.values.homeShown, [id]: on });
  }

  const customised = $derived(preferences.values.homeOrder.length > 0 || Object.keys(preferences.values.homeShown).length > 0);
</script>

<div class="stack section">
  <p class="muted">Abschnitte der Startseite ein- und ausschalten und an die gewünschte Stelle ziehen. Jeder Bereich der Seitenleiste hat einen Abschnitt.</p>
  <SortableList {items} label="Abschnitte der Startseite" onreorder={(ids) => preferences.set('homeOrder', ids)}>
    {#snippet extra(item)}
      <label class="check">
        <input type="checkbox" checked={shown(item.key)} onchange={(e) => toggle(item.key, e.currentTarget.checked)} />
        Anzeigen
      </label>
    {/snippet}
  </SortableList>
  <div>
    <Button variant="ghost" disabled={!customised} onclick={() => (preferences.set('homeOrder', []), preferences.set('homeShown', {}))}>
      Standard wiederherstellen
    </Button>
  </div>
</div>

<style>
  p {
    margin: 0;
  }
  .check {
    font-size: var(--font-size-small);
  }
</style>
