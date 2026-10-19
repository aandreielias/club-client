<script lang="ts">
  import { navCatalog, preferences, session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import SortableList from '../../ui/SortableList.svelte';

  /** Order of the main sidebar rows (tabs and groups; the order inside a group is fixed). */
  const entries = $derived(navCatalog.ordered(preferences.values.navOrder, (...roles) => session.hasRole(...roles)));
</script>

<div class="stack section">
  <p class="muted">
    Einträge an die gewünschte Stelle ziehen. Mit der Tastatur: Eintrag auswählen, Leertaste, Pfeiltasten, Leertaste.
    Gruppen wie „Verein“ ziehen sich als Ganzes mit. Einstellungen und Abmelden bleiben unten.
  </p>
  <SortableList items={entries} label="Reihenfolge der Seitenleiste" onreorder={(keys) => preferences.set('navOrder', keys)} />
  <div>
    <Button variant="ghost" disabled={!preferences.values.navOrder.length} onclick={() => preferences.set('navOrder', [])}>Standardreihenfolge</Button>
  </div>
</div>

<style>
  p {
    margin: 0;
  }
</style>
