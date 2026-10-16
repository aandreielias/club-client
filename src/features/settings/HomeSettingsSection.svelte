<script lang="ts">
  import { homeSections, preferences, session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import SortableList from '../../ui/SortableList.svelte';

  /** Which sections the start page shows and in which order. */
  const items = $derived(
    homeSections.ordered(preferences.values.homeOrder, (...roles) => session.hasRole(...roles)).map((s) => ({ key: s.id, label: s.label })),
  );

  function toggle(id: string, shown: boolean) {
    const hidden = preferences.values.homeHidden.filter((h) => h !== id);
    preferences.set('homeHidden', shown ? hidden : [...hidden, id]);
  }

  const customised = $derived(preferences.values.homeOrder.length > 0 || preferences.values.homeHidden.length > 0);
</script>

<div class="stack section">
  <p class="muted">Abschnitte der Startseite ein- und ausschalten und an die gewünschte Stelle ziehen.</p>
  <SortableList {items} label="Abschnitte der Startseite" onreorder={(ids) => preferences.set('homeOrder', ids)}>
    {#snippet extra(item)}
      <label class="check">
        <input type="checkbox" checked={!preferences.values.homeHidden.includes(item.key)} onchange={(e) => toggle(item.key, e.currentTarget.checked)} />
        Anzeigen
      </label>
    {/snippet}
  </SortableList>
  <div>
    <Button variant="ghost" disabled={!customised} onclick={() => (preferences.set('homeOrder', []), preferences.set('homeHidden', []))}>
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
