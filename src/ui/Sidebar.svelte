<script lang="ts">
  import type { NavItem } from '../features/FeatureRegistry';
  import type { LiveStatus } from '../lib/live/LiveUpdates.svelte';
  import { SHORTCUTS, type CommandId } from '../shortcuts';
  import { commands, keyboard, keymap } from '../lib/container';
  import Icon from './Icon.svelte';
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

  // The active highlight glides between entries (CSS transition on its position).
  let list: HTMLElement | undefined = $state();
  let indicator = $state<{ y: number; height: number } | null>(null);
  $effect(() => {
    void current;
    void items.length;
    const active = list?.querySelector<HTMLElement>('a.active');
    indicator = active ? { y: active.offsetTop, height: active.offsetHeight } : null;
  });
</script>

<button class="toggle" aria-expanded={open} aria-controls="sidebar" onclick={() => (open = !open)}
  {@attach tooltip(() => (open ? 'Navigation schließen' : 'Navigation öffnen'))}>
  <Icon name={open ? 'close' : 'menu'} />
  <span class="visually-hidden">{open ? 'Schließen' : 'Menü'}</span>
  {#if !open && pending}<span class="badge toggle-badge">{pending}<span class="visually-hidden"> neu</span></span>{/if}
</button>
{#if open}<button class="scrim" aria-label="Navigation schließen" tabindex="-1" onclick={() => (open = false)} {@attach tooltip('Navigation schließen')}></button>{/if}

<nav id="sidebar" class:open aria-label="Hauptnavigation">
  <div class="title">
    <span class="mark" aria-hidden="true">{title.slice(0, 1)}</span>
    <span class="name">{title}</span>
  </div>
  <div class="search"><GlobalSearch /></div>
  <ul bind:this={list}>
    {#if indicator}
      <li class="indicator" aria-hidden="true" style:transform="translateY({indicator.y}px)" style:height="{indicator.height}px"></li>
    {/if}
    {#each items.filter((i) => !i.footer) as item (item.path)}
      <li>
        <a href="#{item.path}" class:active={isActive(item.path)} aria-current={isActive(item.path) ? 'page' : undefined}
          {@attach tooltip(`Zu ${item.label}${navKeys(item.path)}`)} onclick={() => (open = false)}>
          {#if item.icon}<Icon name={item.icon} />{/if}
          <span class="label">{item.label}</span>
          {#if item.badge}<span class="badge">{item.badge}<span class="visually-hidden"> neu</span></span>{/if}
        </a>
      </li>
    {/each}
  </ul>
  <div class="foot">
    {#if connection === 'reconnecting'}
      <span class="connection" role="status"><span class="pulse" aria-hidden="true"></span>Verbindung unterbrochen</span>
    {/if}
    <button class="link" onclick={() => ((open = false), (commands.paletteOpen = true))}
      {@attach tooltip(() => withKeys('Alle Befehle durchsuchen und ausführen', 'palette.open'))}>
      <Icon name="commands" />
      <span class="label">Befehle</span>
      <Kbd keys={keymap.keys('palette.open')} />
    </button>
    {#each items.filter((i) => i.footer) as item (item.path)}
      <a href="#{item.path}" class:active={isActive(item.path)} aria-current={isActive(item.path) ? 'page' : undefined}
        {@attach tooltip(`Zu ${item.label}${navKeys(item.path)}`)} onclick={() => (open = false)}>
        {#if item.icon}<Icon name={item.icon} />{/if}
        <span class="label">{item.label}</span>
      </a>
    {/each}
    <div class="user">
      <span class="avatar" aria-hidden="true">{user.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
      <span class="label">{user}</span>
      <button class="icon-button" onclick={onlogout} aria-label="Abmelden" {@attach tooltip('Auf diesem Gerät abmelden')}>
        <Icon name="logout" />
      </button>
    </div>
  </div>
</nav>

<style>
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
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm) var(--space-md);
    font-weight: var(--font-weight-bold);
  }
  .mark {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-size: var(--font-size-small);
  }
  .name,
  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .search {
    padding: 0 var(--space-xxs) var(--space-md);
  }
  ul {
    position: relative;
    display: grid;
    gap: 1px;
  }
  .indicator {
    position: absolute;
    inset: 0 0 auto;
    border-radius: var(--radius-md);
    background: var(--color-selected);
    pointer-events: none;
    transition:
      transform var(--motion-slow) var(--motion-easing),
      height var(--motion-slow) var(--motion-easing);
  }
  a,
  .link {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 30px;
    padding: 0 var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    font-weight: var(--font-weight-medium);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition:
      background var(--motion-fast),
      color var(--motion-fast);
  }
  .label {
    flex: 1;
  }
  a:hover,
  .link:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }
  a.active {
    color: var(--color-text);
  }
  /* The gliding indicator paints the main list; footer entries highlight themselves. */
  ul a.active,
  ul a.active:hover {
    background: none;
  }
  .foot a.active {
    background: var(--color-selected);
  }
  a :global(.icon),
  .link :global(.icon) {
    opacity: 0.8;
  }
  a.active :global(.icon) {
    opacity: 1;
    color: var(--color-accent);
  }
  .badge {
    min-width: 18px;
    padding: 0 5px;
    border-radius: var(--radius-full);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-size: 11px;
    font-weight: var(--font-weight-bold);
    line-height: 18px;
    text-align: center;
    animation: badge-in var(--motion-slow) var(--motion-easing);
  }
  @keyframes badge-in {
    from {
      transform: scale(0.4);
      opacity: 0;
    }
  }
  .connection {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    color: var(--color-warning);
    font-size: var(--font-size-small);
  }
  .pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
  .foot {
    display: grid;
    gap: 1px;
    margin-top: auto;
    padding-top: var(--space-sm);
  }
  .user {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
    padding: var(--space-sm) var(--space-xs) 0 var(--space-sm);
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .avatar {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-selected);
    color: var(--color-text-muted);
    font-size: 10.5px;
    font-weight: var(--font-weight-bold);
  }
  .icon-button {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
      background var(--motion-fast),
      color var(--motion-fast);
  }
  .icon-button:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }
  .toggle,
  .scrim {
    display: none;
  }
  :global([data-layout='compact']) nav {
    position: fixed;
    z-index: 5;
    translate: -100% 0;
    box-shadow: none;
    transition:
      translate var(--motion-window) var(--motion-easing),
      box-shadow var(--motion-window);
  }
  :global([data-layout='compact']) nav.open {
    translate: 0 0;
    box-shadow: var(--color-shadow-window);
  }
  :global([data-layout='compact']) .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 4;
    border: 0;
    background: var(--color-backdrop);
    animation: fade-in var(--motion-base) both;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  :global([data-layout='compact']) .toggle {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    position: fixed;
    top: var(--space-sm);
    right: var(--space-sm);
    z-index: 6;
    height: 34px;
    padding: 0 var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-raised);
    cursor: pointer;
  }
</style>
