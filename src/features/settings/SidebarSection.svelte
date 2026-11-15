<script lang="ts">
  import { navCatalog, preferences, session } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import SortableList from '../../ui/SortableList.svelte';

  /** Order of the main sidebar rows (tabs and groups; the order inside a group is fixed). */
  const entries = $derived(navCatalog.ordered(preferences.values.navOrder, (...roles) => session.hasRole(...roles)));
</script>

<div class="stack">
  <SortableList items={entries} label="Reihenfolge der Seitenleiste" onreorder={(keys) => preferences.set('navOrder', keys)} />
  <div>
    <Button variant="ghost" disabled={!preferences.values.navOrder.length} onclick={() => preferences.set('navOrder', [])}>Standardreihenfolge</Button
    >
  </div>
</div>
