<script lang="ts">
  import { navCatalog, preferences, session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import SortableList from '../../ui/SortableList.svelte';

  /** Order of the main sidebar entries. */
  const entries = $derived(
    navCatalog.ordered(preferences.values.navOrder, (...roles) => session.hasRole(...roles)).map((e) => ({ key: e.path, label: e.label })),
  );
</script>

<div class="stack section">
  <p class="muted">
    Einträge an die gewünschte Stelle ziehen. Mit der Tastatur: Eintrag auswählen, Leertaste, Pfeiltasten, Leertaste.
    Einstellungen und Abmelden bleiben unten.
  </p>
  <SortableList items={entries} label="Reihenfolge der Seitenleiste" onreorder={(paths) => preferences.set('navOrder', paths)} />
  <div>
    <Button variant="ghost" disabled={!preferences.values.navOrder.length} onclick={() => preferences.set('navOrder', [])}>Standardreihenfolge</Button>
  </div>
</div>

<style>
  p {
    margin: 0;
  }
</style>
