<script lang="ts">
  import type { NavItem } from '../features/FeatureRegistry';
  import type { LiveStatus } from '../lib/live/LiveUpdates.svelte';
  import { SHORTCUTS, type CommandId } from '../shortcuts';
  import { tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { bus, commands, keyboard, keymap, motion, pageNavigator, preferences } from '../lib/container';
  import { settings } from '../settings';
  import { SPLIT_OPEN } from '../lib/split/SplitView.svelte';
  import { menu } from './contextMenu';
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
  // Icons only (desktop); the phone layout always shows the full overlay.
  const collapsed = $derived(preferences.values.sidebarCollapsed);

  /** From the collapsed sidebar: expand it and put the cursor into the search field. */
  async function keyboardSearch() {
    await tick();
    commands.run('search.focus');
  }

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

  /** A plain left click switches the page in the pane last used and keeps a docked window; other clicks (new tab) stay native. */
  function go(event: MouseEvent, path: string) {
    open = false;
    flyout = null;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    pageNavigator.go(path);
  }

  /** A group row is active while one of its tabs is. */
  const isRowActive = (item: NavItem) => (item.children ? item.children.some((c) => isActive(c.path)) : isActive(item.path));

  // Same breakpoint as ThemeService's data-layout="compact".
  const compact = new MediaQuery(`max-width: ${settings.compactBelowPx - 0.02}px`);

  // Group flyout: opens on hover/focus, closes shortly after the pointer leaves (so it can move into it).
  let flyout = $state<string | null>(null);
  let closing: ReturnType<typeof setTimeout> | undefined;
  function openFlyout(key: string) {
    clearTimeout(closing);
    flyout = key;
  }
  function closeFlyout(delay: number = settings.overlay.flyoutCloseDelayMs) {
    clearTimeout(closing);
    closing = setTimeout(() => (flyout = null), delay);
  }
  function groupKeys(event: KeyboardEvent, item: NavItem) {
    if (event.key === 'ArrowRight' || event.key === ' ') {
      event.preventDefault();
      openFlyout(item.key);
      tick().then(() => document.querySelector<HTMLElement>(`[data-flyout="${item.key}"] a`)?.focus());
    }
  }
  function flyoutKeys(event: KeyboardEvent, item: NavItem) {
    const links = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('a')];
    const index = links.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      links[(index + (event.key === 'ArrowDown' ? 1 : links.length - 1)) % links.length]?.focus();
    } else if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      flyout = null;
      document.querySelector<HTMLElement>(`[data-group="${item.key}"]`)?.focus();
    }
  }
  function leaveFlyout(event: FocusEvent) {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) closeFlyout(0);
  }

  // The active highlight glides between entries (CSS transition on its position).
  let list: HTMLElement | undefined = $state();
  let indicator = $state<{ y: number; height: number } | null>(null);
  $effect(() => {
    void current;
    void items.length;
    const active = list?.querySelector<HTMLElement>(':scope > li > a.active');
    // Measured on the <li>: a group row is positioned (for its flyout), so the link's offsetTop would be 0.
    const row = active?.parentElement;
    indicator = active && row ? { y: row.offsetTop, height: active.offsetHeight } : null;
  });
</script>

{#snippet tab(item: NavItem)}
  <a href="#{item.path}" class:active={isActive(item.path)} aria-current={isActive(item.path) ? 'page' : undefined}
    {@attach tooltip(`Zu ${item.label}${navKeys(item.path)}`)} onclick={(e) => go(e, item.path)}
    {@attach menu(() => [{ label: 'In geteilter Ansicht öffnen', icon: 'split', run: () => bus.publish(SPLIT_OPEN, { path: item.path }) }])}>
    {#if item.icon}<Icon name={item.icon} />{/if}
    <span class="label">{item.label}</span>
    {#if item.badge}<span class="badge">{item.badge}<span class="visually-hidden"> neu</span></span>{/if}
  </a>
{/snippet}

<button class="toggle" aria-expanded={open} aria-controls="sidebar" onclick={() => (open = !open)}
  {@attach tooltip(() => (open ? 'Navigation schließen' : 'Navigation öffnen'))}>
  <Icon name={open ? 'close' : 'menu'} />
  <span class="visually-hidden">{open ? 'Schließen' : 'Menü'}</span>
  {#if !open && pending}<span class="badge toggle-badge">{pending}<span class="visually-hidden"> neu</span></span>{/if}
</button>
{#if open}<button class="scrim" aria-label="Navigation schließen" tabindex="-1" onclick={() => (open = false)} {@attach tooltip('Navigation schließen')}></button>{/if}

<nav id="sidebar" class:open class:collapsed aria-label="Hauptnavigation">
  <div class="title">
    <span class="mark" aria-hidden="true">{title.slice(0, 1)}</span>
    <span class="name">{title}</span>
    <button class="icon-button collapse" onclick={() => preferences.set('sidebarCollapsed', !collapsed)} aria-label={collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
      {@attach tooltip(() => withKeys(collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen', 'sidebar.toggle'))}>
      <Icon name="sidebar" />
    </button>
  </div>
  <!-- Collapsed (desktop): a search icon that expands the sidebar; the phone overlay always shows the field. -->
  <button class="link search-icon" onclick={() => (preferences.set('sidebarCollapsed', false), keyboardSearch())} aria-label="Suchen"
    {@attach tooltip(() => withKeys('Suchen', 'search.focus'))}><Icon name="search" /></button>
  <div class="search"><GlobalSearch /></div>
  <ul bind:this={list}>
    {#if indicator}
      <li class="indicator" aria-hidden="true" style:transform="translateY({indicator.y}px)" style:height="{indicator.height}px"></li>
    {/if}
    {#each items.filter((i) => !i.footer) as item (item.key)}
      {#if item.children}
        <li class="group" onpointerenter={() => openFlyout(item.key)} onpointerleave={() => closeFlyout()} onfocusout={leaveFlyout}>
          <a href="#{item.path}" data-group={item.key} class:active={isRowActive(item)} aria-haspopup="true" aria-expanded={flyout === item.key}
            onclick={(e) => go(e, item.path)} onkeydown={(e) => groupKeys(e, item)}>
            {#if item.icon}<Icon name={item.icon} />{/if}
            <span class="label">{item.label}</span>
            {#if item.badge}<span class="badge">{item.badge}<span class="visually-hidden"> neu</span></span>{/if}
            <span class="chevron"><Icon name="next" small /></span>
          </a>
          <!-- Desktop: flyout to the right while hovered or focused. Compact (no hover): the tabs stay listed below the group. -->
          {#if flyout === item.key || compact.current}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions (arrow keys between the links inside, which bubble here) -->
            <ul class="flyout" data-flyout={item.key} aria-label={item.label} onkeydown={(e) => flyoutKeys(e, item)} transition:motion.pop={{ origin: 'left' }}>
              <li class="flyout-title" aria-hidden="true">{item.label}</li>
              {#each item.children as child, i (child.path)}
                <li in:motion.rise={{ delay: motion.stagger(i), distance: 3 }}>{@render tab(child)}</li>
              {/each}
            </ul>
          {/if}
        </li>
      {:else}
        <li>{@render tab(item)}</li>
      {/if}
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
        {@attach tooltip(`Zu ${item.label}${navKeys(item.path)}`)} onclick={(e) => go(e, item.path)}>
        {#if item.icon}<Icon name={item.icon} />{/if}
        <span class="label">{item.label}</span>
      </a>
    {/each}
    <div class="user">
      <a class="profile" href="#/account" class:active={isActive('/account')} aria-current={isActive('/account') ? 'page' : undefined}
        {@attach tooltip(`Mein Konto${navKeys('/account')}`)} onclick={(e) => go(e, '/account')}>
        <span class="avatar" aria-hidden="true">{user.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
        <span class="label">{user}</span>
      </a>
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
    z-index: 3; /* above the page, so group flyouts are not covered */
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
    gap: var(--space-xxs);
    margin-top: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-small);
  }
  .user .profile {
    flex: 1;
    min-width: 0;
    min-height: 34px;
    padding: 0 var(--space-xs);
    color: var(--color-text);
  }
  .user .profile.active {
    background: var(--color-selected);
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
  nav {
    transition: width var(--motion-window) var(--motion-easing);
  }
  .collapse {
    margin-left: auto;
  }
  :global(:root:not([data-layout='compact'])) nav.collapsed {
    width: var(--layout-sidebar-collapsed-width);
  }
  :global(:root:not([data-layout='compact'])) .collapsed .name,
  :global(:root:not([data-layout='compact'])) .collapsed .label,
  :global(:root:not([data-layout='compact'])) .collapsed .connection,
  :global(:root:not([data-layout='compact'])) .collapsed .foot :global(.keys) {
    display: none;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .title {
    flex-direction: column;
    padding-inline: 0;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .collapse {
    margin: 0;
  }
  :global(:root:not([data-layout='compact'])) .collapsed a,
  :global(:root:not([data-layout='compact'])) .collapsed .link {
    justify-content: center;
    padding: 0;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .badge {
    position: absolute;
    top: 0;
    right: 2px;
    min-width: 16px;
    line-height: 16px;
    font-size: 10px;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .user {
    flex-direction: column;
    padding-inline: 0;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .user .profile {
    justify-content: center;
  }
  .group {
    position: relative;
  }
  .chevron {
    display: grid;
    opacity: 0.5;
    transition: transform var(--motion-fast) var(--motion-easing);
  }
  .group:hover .chevron,
  a[aria-expanded='true'] .chevron {
    transform: translateX(2px);
    opacity: 0.9;
  }
  .flyout {
    position: absolute;
    top: calc(-1 * var(--space-xs));
    left: calc(100% + var(--space-sm));
    z-index: 1;
    display: grid;
    gap: 1px;
    min-width: 11rem;
    padding: var(--space-xs);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-raised);
  }
  /* Bridges the gap to the group row, so the pointer can cross it without closing the flyout. */
  .flyout::before {
    content: '';
    position: absolute;
    inset: 0 100% 0 calc(-1 * var(--space-sm) - 1px);
  }
  .flyout-title {
    padding: var(--space-xxs) var(--space-sm) var(--space-xs);
    color: var(--color-text-muted);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  .flyout a.active {
    background: var(--color-selected);
  }
  :global([data-layout='compact']) .flyout {
    position: static;
    padding: 0 0 0 var(--space-lg);
    border: 0;
    background: none;
    box-shadow: none;
  }
  :global([data-layout='compact']) .flyout-title,
  :global([data-layout='compact']) .chevron {
    display: none;
  }
  .search-icon {
    display: none;
    margin-bottom: var(--space-md);
  }
  :global(:root:not([data-layout='compact'])) .collapsed .search-icon {
    display: flex;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .search {
    display: none;
  }
  :global([data-layout='compact']) .collapse,
  :global([data-layout='compact']) .search-icon {
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
