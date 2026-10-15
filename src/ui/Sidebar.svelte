<script lang="ts">
  import type { NavItem } from '../features/FeatureRegistry';
  import type { LiveStatus } from '../lib/live/LiveUpdates.svelte';
  import { SHORTCUTS, type CommandId } from '../shortcuts';
  import { commands, keyboard, keymap } from '../lib/container';
  import { KeySpec } from '../lib/keyboard/KeySpec';
  import GlobalSearch from './GlobalSearch.svelte';
  import Kbd from './Kbd.svelte';
  import { tooltip, withKeys } from './tooltip';

  let {
    title,
    user,
    items,
    current,
    connection,
    onlogout,
  }: {
    title: string;
    user: string;
    items: readonly NavItem[];
    current: string;
    connection: LiveStatus;
    onlogout: () => void;
  } = $props();

  let open = $state(false);

  /** Keys of the navigation command that opens a path, for the tooltip. */
  function navKeys(path: string): string {
    const id = (Object.keys(SHORTCUTS) as CommandId[]).find((key) => (SHORTCUTS[key] as { path?: string }).path === path);
    const keys = id ? keymap.keys(id) : '';
    return keys ? ` (${KeySpec.text(keys, keyboard.isMac)})` : '';
  }
  /** Sum of all badges, shown on the menu button while the sidebar is collapsed. */
  const pending = $derived(items.reduce((sum, item) => sum + (item.badge ?? 0), 0));

  /** A nav item is active on its own path and on its sub-paths ('/calendar/42' → '/calendar'). */
  function isActive(path: string): boolean {
    return path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`);
  }
</script>

<button class="toggle" aria-expanded={open} aria-controls="sidebar" onclick={() => (open = !open)}
  {@attach tooltip(() => (open ? 'Navigation schließen' : 'Navigation öffnen'))}>
  {open ? 'Schließen' : 'Menü'}{#if !open && pending}<span class="badge toggle-badge">{pending}<span class="visually-hidden"> neu</span></span>{/if}
</button>

<nav id="sidebar" class:open aria-label="Hauptnavigation">
  <div class="title">{title}</div>
  <div class="search"><GlobalSearch /></div>
  <ul>
    {#each items.filter((i) => !i.footer) as item (item.path)}
      <li>
        <a href="#{item.path}" class:active={isActive(item.path)} aria-current={isActive(item.path) ? 'page' : undefined}
          {@attach tooltip(`Zu ${item.label}${navKeys(item.path)}`)} onclick={() => (open = false)}>
          <span>{item.label}</span>
          {#if item.badge}<span class="badge">{item.badge}<span class="visually-hidden"> neu</span></span>{/if}
        </a>
      </li>
    {/each}
  </ul>
  <div class="foot">
    {#if connection === 'reconnecting'}
      <span class="connection" role="status">Verbindung unterbrochen, Aktualisierung pausiert</span>
    {/if}
    <span class="muted user">{user}</span>
    <button class="link commands" onclick={() => ((open = false), (commands.paletteOpen = true))}
      {@attach tooltip(() => withKeys('Alle Befehle durchsuchen und ausführen', 'palette.open'))}>
      <span>Befehle</span>
      <Kbd keys={keymap.keys('palette.open')} />
    </button>
    {#each items.filter((i) => i.footer) as item (item.path)}
      <a href="#{item.path}" class:active={isActive(item.path)} aria-current={isActive(item.path) ? 'page' : undefined}
        {@attach tooltip(`Zu ${item.label}${navKeys(item.path)}`)} onclick={() => (open = false)}>
        <span>{item.label}</span>
      </a>
    {/each}
    <button class="link" onclick={onlogout} {@attach tooltip('Auf diesem Gerät abmelden')}>Abmelden</button>
  </div>
</nav>

<style>
  .search {
    padding: 0 var(--space-sm) var(--space-sm);
  }
  nav {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: var(--layout-sidebar-width);
    height: 100dvh;
    padding: var(--space-md) var(--space-sm);
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
  }
  .title {
    padding: var(--space-sm) var(--space-sm) var(--space-lg);
    font-weight: var(--font-weight-bold);
  }
  ul {
    display: grid;
    gap: 1px;
  }
  a,
  .link {
    display: block;
    width: 100%;
    min-height: 28px;
    padding: 0 var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }
  a {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm);
  }
  .badge {
    min-width: 1.5em;
    padding: 0 var(--space-xs);
    border-radius: var(--radius-sm);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-size: var(--font-size-small);
    text-align: center;
  }
  .toggle-badge {
    margin-left: var(--space-xs);
  }
  .commands {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .connection {
    padding: 0 var(--space-sm);
    color: var(--color-warning);
    font-size: var(--font-size-small);
  }
  a:hover,
  .link:hover {
    background: var(--color-hover);
  }
  a.active {
    background: var(--color-selected);
    color: var(--color-text);
    font-weight: var(--font-weight-medium);
  }
  .foot {
    display: grid;
    gap: var(--space-xs);
    margin-top: auto;
  }
  .user {
    padding: 0 var(--space-sm);
    overflow: hidden;
    font-size: var(--font-size-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toggle {
    display: none;
  }
  :global([data-layout='compact']) nav {
    position: fixed;
    z-index: 5;
    translate: -100% 0;
    transition: translate var(--motion-fast) ease;
  }
  :global([data-layout='compact']) nav.open {
    translate: 0 0;
  }
  :global([data-layout='compact']) .toggle {
    display: block;
    position: fixed;
    top: var(--space-sm);
    right: var(--space-sm);
    z-index: 6;
    padding: var(--space-xs) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-background);
  }
</style>
