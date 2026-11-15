<script lang="ts">
  import type { NavItem } from '../features/FeatureRegistry';
  import type { LiveStatus } from '../lib/live/LiveUpdates.svelte';
  import { SHORTCUTS, type CommandId } from '../shortcuts';
  import { tick, untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { bus, commands, keyboard, keymap, motion, pageNavigator, preferences, session } from '../lib/container';
  import { searchSettings, settingsViewer, tabPath, visibleSettings, type SectionId } from '../features/settings/model';
  import { settings } from '../settings';
  import { SPLIT_OPEN } from '../lib/split/SplitView.svelte';
  import { NAVIGATE } from '../lib/router/Router.svelte';
  import { LinkClipboard } from '../lib/window/LinkClipboard';
  import { menu } from './contextMenu';
  import type { IconName } from '../icons';
  import Icon from './Icon.svelte';
  import { KeySpec } from '../lib/keyboard/KeySpec';
  import GlobalSearch from './GlobalSearch.svelte';
  import Kbd from './Kbd.svelte';
  import NavTree from './NavTree.svelte';
  import { SidebarFlyout } from './SidebarFlyout.svelte';
  import { tooltip, withKeys } from './tooltip';

  let {
    title,
    logo = null,
    user,
    items,
    current,
    connection,
    onlogout,
    settingsBack = null,
  }: {
    title: string;
    /** The club's logo; without one the mark shows the first letter. */
    logo?: string | null;
    user: string;
    items: readonly NavItem[];
    current: string;
    connection: LiveStatus;
    onlogout: () => void;
    /** On Einstellungen: the settings tree replaces the app navigation; "Zurück" leads to this path. */
    settingsBack?: string | null;
  } = $props();

  // --- settings mode: the tree of Einstellungen, filtered by the search field ---
  let settingsQuery = $state('');
  const settingsTree = $derived(settingsBack !== null ? visibleSettings(settingsViewer()) : null);
  /** While searching: the matching tabs as a flat list instead of the tree. */
  const settingsFound = $derived(settingsTree && settingsQuery.trim() ? searchSettings(settingsQuery, settingsViewer()) : null);

  // --- groups of both trees: open unless the member closed them; the one holding the current page opens again ---
  const closed = $derived(preferences.values.navClosed);
  const isOpen = (key: string) => !closed.includes(key);
  const toggle = (key: string) => preferences.set('navClosed', isOpen(key) ? [...closed, key] : closed.filter((k) => k !== key));
  const main = $derived(items.filter((i) => !i.footer));

  /** Keys of the groups above the active row, outermost first; null when no row is active. */
  function groupsTo<R extends { key: string; children?: R[] }>(rows: readonly R[], active: (row: R) => boolean): string[] | null {
    for (const row of rows) {
      const below = row.children ? groupsTo(row.children, active) : active(row) ? [] : null;
      if (below) return row.children ? [row.key, ...below] : below;
    }
    return null;
  }
  $effect(() => {
    const above = settingsTree ? groupsTo(settingsTree.tree, (row) => isActive(`/settings/${row.key}`)) : groupsTo(main, (row) => isActive(row.path));
    const shut = untrack(() => preferences.values.navClosed);
    if (above?.some((k) => shut.includes(k)))
      preferences.set(
        'navClosed',
        shut.filter((k) => !above.includes(k)),
      );
  });

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
    flyout.key = null;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    pageNavigator.go(path);
  }

  /** A group row is active while one of its tabs is. */
  const isRowActive = (item: NavItem): boolean => (item.children ? item.children.some(isRowActive) : isActive(item.path));

  // Same breakpoint as ThemeService's data-layout="compact".
  const compact = new MediaQuery(`max-width: ${settings.compactBelowPx - 0.02}px`);

  const flyout = new SidebarFlyout(() => compact.current);
  $effect(() => () => flyout.dispose());

  // The active highlight glides between entries (CSS transition on its position).
  let list: HTMLElement | undefined = $state();
  let indicator = $state<{ x: number; y: number; width: number; height: number } | null>(null);
  /** Off while the highlight appears, so it shows up at its row instead of gliding in from the top. */
  let glide = $state(false);
  function measure() {
    // Any depth of the tree, but not inside a flyout (it highlights itself).
    const active = [...(list?.querySelectorAll<HTMLElement>('a.active') ?? [])].find((a) => !a.closest('.flyout'));
    const box = active?.getBoundingClientRect();
    const frame = list?.getBoundingClientRect();
    const next =
      box && frame && list ? { x: box.left - frame.left, y: box.top - frame.top + list.scrollTop, width: box.width, height: box.height } : null;
    if (next && !untrack(() => indicator)) {
      glide = false;
      requestAnimationFrame(() => (glide = true));
    }
    indicator = next;
  }
  $effect(() => {
    void current;
    void items.length;
    void settingsFound;
    void closed;
    measure();
  });
  /** While a group slides open or closed: the highlight follows its row every frame, and the list shows no scroll bars. */
  let sliding = $state(false);
  let slideUntil = 0;
  function follow() {
    slideUntil = performance.now() + motion.ms('base') + 50;
    if (sliding) return;
    sliding = true;
    const frame = () => {
      measure();
      if (performance.now() < slideUntil) requestAnimationFrame(frame);
      else sliding = false;
    };
    requestAnimationFrame(frame);
  }
  // Rows move without a route change too (fonts loading, badges, search results): measure again.
  $effect(() => {
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  });
</script>

{#snippet link(path: string, label: string, icon: IconName | undefined, tip: string)}
  <a
    href="#{path}"
    class:active={isActive(path)}
    aria-current={isActive(path) ? 'page' : undefined}
    {@attach tooltip(tip)}
    onclick={(e) => go(e, path)}
  >
    {#if icon}<Icon name={icon} />{/if}
    <span class="label">{label}</span>
  </a>
{/snippet}

{#snippet tab(item: NavItem)}
  <a
    href="#{item.path}"
    class:active={isActive(item.path)}
    aria-current={isActive(item.path) ? 'page' : undefined}
    {@attach tooltip(`Zu ${item.label}${navKeys(item.path)}`)}
    onclick={(e) => go(e, item.path)}
    {@attach menu(() => [
      { label: 'Öffnen', run: () => bus.publish(NAVIGATE, { path: item.path }) },
      { label: 'In geteilter Ansicht öffnen', icon: 'split', run: () => bus.publish(SPLIT_OPEN, { path: item.path }) },
      { separator: true },
      { label: 'Link kopieren', icon: 'copy', run: () => void LinkClipboard.copy(bus, item.path) },
    ])}
  >
    {#if item.icon}<Icon name={item.icon} />{/if}
    <span class="label">{item.label}</span>
    {#if item.badge}<span class="badge">{item.badge}<span class="visually-hidden"> neu</span></span>{/if}
  </a>
{/snippet}

<button
  class="toggle"
  aria-expanded={open}
  aria-controls="sidebar"
  onclick={() => (open = !open)}
  {@attach tooltip(() => (open ? 'Navigation schließen' : 'Navigation öffnen'))}
>
  <Icon name={open ? 'close' : 'menu'} />
  <span class="visually-hidden">{open ? 'Schließen' : 'Menü'}</span>
  {#if !open && pending}<span class="badge toggle-badge">{pending}<span class="visually-hidden"> neu</span></span>{/if}
</button>
{#if open}<button
    class="scrim"
    aria-label="Navigation schließen"
    tabindex="-1"
    onclick={() => (open = false)}
    {@attach tooltip('Navigation schließen')}
  ></button>{/if}

<nav id="sidebar" class:open class:collapsed aria-label="Hauptnavigation">
  <div class="title">
    {#if logo}<img class="logo" src={logo} alt="" />{:else}<span class="mark" aria-hidden="true">{title.slice(0, 1)}</span>{/if}
    <span class="name" {title}>{title}</span>
    <button
      class="icon-button collapse"
      onclick={() => preferences.set('sidebarCollapsed', !collapsed)}
      aria-label={collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
      {@attach tooltip(() => withKeys(collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen', 'sidebar.toggle'))}
    >
      <Icon name="sidebar" />
    </button>
  </div>
  {#if settingsTree}
    <!-- Einstellungen: the settings tree takes the place of the app navigation. -->
    <a class="back" href="#{settingsBack}" onclick={(e) => go(e, settingsBack!)} {@attach tooltip('Zurück zur App')}>
      <Icon name="back" />
      <span class="label">Einstellungen</span>
    </a>
    <div class="search settings-search">
      <input type="search" bind:value={settingsQuery} placeholder="Einstellungen durchsuchen" aria-label="Einstellungen durchsuchen" />
    </div>
    <ul bind:this={list} class="tree settings-tree" class:sliding aria-label="Einstellungen">
      <!-- Always the first row, so showing it never changes which row comes first (and the layout). -->
      <li
        class="indicator"
        aria-hidden="true"
        style:visibility={indicator ? null : 'hidden'}
        style:transition={glide && !sliding ? null : 'none'}
        style:transform="translateY({indicator?.y ?? 0}px)"
        style:left="{indicator?.x ?? 0}px"
        style:width="{indicator?.width ?? 0}px"
        style:height="{indicator?.height ?? 0}px"
      ></li>
      {#if settingsFound}
        {#each settingsFound as tab (tab.id)}
          <li>{@render link(`/settings/${tab.id}`, tab.label, tab.icon, tabPath(tab.id))}</li>
        {:else}
          <li class="none muted">Nichts gefunden.</li>
        {/each}
      {:else}
        <NavTree items={settingsTree.tree} {isOpen} ontoggle={toggle} onslide={follow}>
          {#snippet leaf(entry)}
            {@render link(`/settings/${entry.key}`, entry.label, entry.icon, entry.tab?.hint ?? tabPath(entry.key as SectionId))}
          {/snippet}
        </NavTree>
      {/if}
    </ul>
  {:else}
    <!-- Collapsed (desktop): a search icon that expands the sidebar; the phone overlay always shows the field. -->
    <button
      class="link search-icon"
      onclick={() => (preferences.set('sidebarCollapsed', false), keyboardSearch())}
      aria-label="Suchen"
      {@attach tooltip(() => withKeys('Suchen', 'search.focus'))}><Icon name="search" /></button
    >
    <div class="search"><GlobalSearch /></div>
    <ul bind:this={list} class="tree" class:sliding>
      <!-- Always the first row, so showing it never changes which row comes first (and the layout). -->
      <li
        class="indicator"
        aria-hidden="true"
        style:visibility={indicator ? null : 'hidden'}
        style:transition={glide && !sliding ? null : 'none'}
        style:transform="translateY({indicator?.y ?? 0}px)"
        style:left="{indicator?.x ?? 0}px"
        style:width="{indicator?.width ?? 0}px"
        style:height="{indicator?.height ?? 0}px"
      ></li>
      {#if collapsed && !compact.current}
        <!-- Icons only: a group opens its tree in a flyout to the right while hovered or focused. -->
        {#each main as item (item.key)}
          {#if item.children}
            <li
              class="group"
              onpointerenter={() => flyout.show(item.key)}
              onpointerleave={(e) => flyout.leaveGroup(e, item.key)}
              onfocusout={(e) => flyout.leaveFocus(e)}
            >
              <a
                href="#{item.path}"
                data-group={item.key}
                class:active={isRowActive(item)}
                aria-haspopup="true"
                aria-expanded={flyout.key === item.key}
                onclick={(e) => go(e, item.path)}
                onkeydown={(e) => flyout.groupKeys(e, item.key)}
              >
                {#if item.icon}<Icon name={item.icon} />{/if}
                <span class="label">{item.label}</span>
                {#if item.badge}<span class="badge">{item.badge}<span class="visually-hidden"> neu</span></span>{/if}
                <span class="chevron"><Icon name="next" small /></span>
              </a>
              {#if flyout.key === item.key}
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions (arrow keys between the links inside, which bubble here) -->
                <ul
                  class="flyout"
                  data-flyout={item.key}
                  aria-label={item.label}
                  onkeydown={(e) => flyout.flyoutKeys(e, item.key)}
                  transition:motion.pop={{ origin: 'left' }}
                >
                  <li class="flyout-title" aria-hidden="true">{item.label}</li>
                  <NavTree items={item.children}>
                    {#snippet leaf(child)}{@render tab(child)}{/snippet}
                  </NavTree>
                </ul>
              {/if}
            </li>
          {:else}
            <li>{@render tab(item)}</li>
          {/if}
        {/each}
      {:else}
        <NavTree items={main} {isOpen} ontoggle={toggle} onslide={follow}>
          {#snippet leaf(item)}{@render tab(item)}{/snippet}
          {#snippet closed(group)}{#if group.badge}<span class="badge">{group.badge}<span class="visually-hidden"> neu</span></span>{/if}{/snippet}
        </NavTree>
      {/if}
    </ul>
  {/if}
  <div class="foot">
    {#if connection === 'reconnecting'}
      <span class="connection" role="status"><span class="pulse" aria-hidden="true"></span>Verbindung unterbrochen</span>
    {/if}
    <button
      class="link"
      onclick={() => ((open = false), (commands.paletteOpen = true))}
      {@attach tooltip(() => withKeys('Alle Befehle durchsuchen und ausführen', 'palette.open'))}
    >
      <Icon name="commands" />
      <span class="label">Befehle</span>
      <Kbd keys={keymap.keys('palette.open')} />
    </button>
    {#each items.filter((i) => i.footer && !(settingsTree && i.path === '/settings')) as item (item.path)}
      {@render link(item.path, item.label, item.icon, `Zu ${item.label}${navKeys(item.path)}`)}
    {/each}
    <div class="user">
      <a
        class="profile"
        href="#/account"
        class:active={isActive('/account')}
        aria-current={isActive('/account') ? 'page' : undefined}
        {@attach tooltip(`Mein Konto${navKeys('/account')}`)}
        onclick={(e) => go(e, '/account')}
      >
        <span class="avatar" aria-hidden="true"
          >{user
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)}</span
        >
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
  .logo {
    width: 22px;
    height: 22px;
    flex: none;
    object-fit: contain;
  }
  /* Long club names wrap to a second line before they are cut. */
  .name {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    font-family: var(--font-display);
    font-weight: var(--font-display-weight);
    letter-spacing: var(--font-display-tracking);
    text-transform: var(--font-display-transform);
  }
  .name {
    min-width: 0;
    overflow: hidden;
  }
  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .search {
    padding: 0 var(--space-xxs) var(--space-md);
  }
  .back {
    margin-bottom: var(--space-sm);
    color: var(--color-text);
    font-weight: var(--font-weight-bold);
  }
  /* Long trees scroll inside the sidebar; the icon-only sidebar keeps its flyouts visible instead. */
  nav:not(.collapsed) .tree {
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }
  nav:not(.collapsed) .tree.sliding {
    overflow-y: hidden;
  }
  .none {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--font-size-small);
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
  /* The brand's second colour marks the active entry. */
  .indicator::before {
    position: absolute;
    inset: 7px auto 7px 0;
    width: 3px;
    border-radius: var(--radius-full);
    background: var(--color-highlight);
    content: '';
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
    font-size: var(--font-size-tiny);
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
  /* The group arrow sits at the edge, so the icon stays centred like the other rows. */
  :global(:root:not([data-layout='compact'])) .collapsed .chevron {
    position: absolute;
    right: 0;
  }
  /* The flyout keeps its labels: icons only would leave it wider than its content. */
  :global(:root:not([data-layout='compact'])) .collapsed .flyout .label {
    display: block;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .flyout a {
    justify-content: flex-start;
    padding: 0 var(--space-sm);
  }
  :global(:root:not([data-layout='compact'])) .collapsed .flyout .badge {
    position: static;
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
  .search-icon {
    display: none;
    margin-bottom: var(--space-md);
  }
  :global(:root:not([data-layout='compact'])) .collapsed .search-icon {
    display: flex;
  }
  /* Icons only, Einstellungen: group headings keep their icon, the levels are not indented. */
  :global(:root:not([data-layout='compact'])) .collapsed .settings-tree :global(.head) {
    justify-content: center;
    padding: 0;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .settings-tree :global(.head .label),
  :global(:root:not([data-layout='compact'])) .collapsed .settings-tree :global(.head .chevron) {
    display: none;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .settings-tree :global(.branch > ul) {
    padding-left: 0;
  }
  :global(:root:not([data-layout='compact'])) .collapsed .settings-search,
  :global(:root:not([data-layout='compact'])) .collapsed .none,
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
