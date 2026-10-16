<script lang="ts">
  import { settings } from '../settings';
  import { bus, commands, router } from '../lib/container';
  import { NAVIGATE } from '../channels';
  import { useCommands } from '../lib/keyboard/useCommands.svelte';
  import { tooltip, withKeys } from './tooltip';

  /**
   * The search field of the sidebar. Typing shows the results on /search (updated in place while
   * there); Enter searches at once, Escape leaves the field.
   */
  const PATH = '/search';
  let input: HTMLInputElement | undefined = $state();
  let value = $state(router.path === PATH ? (router.query.get('q') ?? '') : '');
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Follow the URL (Back/Forward, links) when the field is not being edited.
  $effect(() => {
    const q = router.path === PATH ? (router.query.get('q') ?? '') : '';
    if (document.activeElement !== input) value = q;
  });

  useCommands(commands, { 'search.focus': { run: () => (input?.focus(), input?.select()) } });

  function go() {
    clearTimeout(timer);
    const q = value.trim();
    if (!q && router.path !== PATH) return;
    const target = q ? `${PATH}?q=${encodeURIComponent(q)}` : PATH;
    // While on the results, update in place so Back leaves the search in one step.
    if (router.path === PATH) bus.publish(NAVIGATE, { path: target, replace: true });
    else bus.publish(NAVIGATE, { path: target });
  }

  function typed() {
    clearTimeout(timer);
    timer = setTimeout(go, settings.search.debounceMs);
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      go();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      input?.blur();
    }
  }
</script>

<input
  bind:this={input}
  bind:value
  class="search"
  type="search"
  placeholder="Suchen"
  aria-label="Alles durchsuchen"
  maxlength={settings.search.maxQueryLength}
  oninput={typed}
  onkeydown={keydown}
  {@attach tooltip(() => withKeys('Termine, Aufgaben, Mitglieder, Teams, Inventar und Dateien durchsuchen', 'search.focus'))}
/>

<style>
  .search {
    width: 100%;
  }
</style>
