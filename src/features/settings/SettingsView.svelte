<script lang="ts">
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import NavTree from '../../ui/NavTree.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { preferences } from '../../lib/container';
  import { settingsViewer } from './model';
  import { SECTION_PROPS, SETTINGS_SECTIONS as COMPONENTS } from './sections';
  import { tabPath, visibleSettings, type SectionId, type SettingsEntry } from './settingsTree';

  /** Settings in the window, with their own tree; on the page the sidebar holds the tree (SettingsPage). `id`: the section shown first. */
  let { id, handle }: { id: string; handle?: WindowHandle } = $props();

  const { tree, tabs } = visibleSettings(settingsViewer());

  // svelte-ignore state_referenced_locally
  let current = $state<SectionId>(tabs.some((t) => t.id === id) ? (id as SectionId) : 'appearance');
  // Groups closed in the sidebar's settings tree stay closed here too.
  const closed = $derived(preferences.values.navClosed);
  const isOpen = (key: string) => !closed.includes(key);
  const toggle = (key: string) => preferences.set('navClosed', isOpen(key) ? [...closed, key] : closed.filter((k) => k !== key));

  $effect(() => handle?.setTitle(`Einstellungen: ${tabPath(current)}`));

  /** Up and down walk the shown tabs; left closes the group of the focused tab. */
  function keydown(event: KeyboardEvent) {
    const nav = event.currentTarget as HTMLElement;
    const shown = [...nav.querySelectorAll<HTMLElement>('[data-tab]')];
    const index = shown.findIndex((b) => b.dataset.tab === current);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = shown[(index + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length];
      current = next.dataset.tab as SectionId;
      next.focus();
    } else if (event.key === 'ArrowLeft') {
      const branch = shown[index]?.closest<HTMLElement>('[data-branch]');
      if (!branch) return;
      event.preventDefault();
      toggle(branch.dataset.branch!);
      nav.querySelector<HTMLElement>(`[data-head="${branch.dataset.branch}"]`)?.focus();
    }
  }
</script>

{#snippet tab(entry: SettingsEntry)}
  <button
    data-tab={entry.key}
    aria-current={current === entry.key ? 'page' : undefined}
    tabindex={current === entry.key ? 0 : -1}
    class:active={current === entry.key}
    onclick={() => (current = entry.key as SectionId)}
    {@attach tooltip(entry.tab?.hint ?? `Einstellungen für ${entry.label} anzeigen`)}
  >
    {entry.label}
  </button>
{/snippet}

<Detail title="Einstellungen">
  <div class="layout">
    <!-- Arrow keys bubble up from the tab buttons. -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <nav class="tabs" aria-label="Bereiche" onkeydown={keydown}>
      <ul>
        <NavTree items={tree} {isOpen} ontoggle={toggle} leaf={tab} />
      </ul>
    </nav>
    <section id="settings-panel" aria-label={tabPath(current)}>
      {#key current}{@const Section = COMPONENTS[current]}<Section {...SECTION_PROPS[current]} />{/key}
    </section>
  </div>
</Detail>

<style>
  .layout {
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr);
    gap: var(--space-xl);
    align-items: start;
  }
  .tabs {
    position: sticky;
    top: 0;
  }
  .tabs > ul {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
  }
  .tabs button {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 30px;
    padding: 0 var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    text-align: left;
    cursor: pointer;
  }
  .tabs button:hover {
    background: var(--color-hover);
  }
  .tabs button.active {
    background: var(--color-selected);
    color: var(--color-text);
  }
  :global([data-layout='compact']) .layout,
  :global(:root[data-window='side']) .layout {
    grid-template-columns: 1fr;
  }
  :global([data-layout='compact']) .tabs,
  :global(:root[data-window='side']) .tabs {
    position: static;
  }
</style>
