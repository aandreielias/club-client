<script lang="ts">
  import { tick } from 'svelte';
  import { settings } from '../settings';
  import { contextMenu, keymap } from '../lib/container';
  import { isSeparator, type MenuAction } from '../lib/overlay/ContextMenuService.svelte';
  import { menuPosition } from '../lib/overlay/placement';
  import Icon from './Icon.svelte';
  import Kbd from './Kbd.svelte';

  /**
   * Renders the one context menu (lib/overlay/ContextMenuService) in the top layer; mounted once in
   * App. WAI-ARIA menu: arrows, Home/End and letters move, Enter/Space run, Escape/Tab close.
   */
  let menu: HTMLDivElement | undefined = $state();
  let active = $state(-1);
  let position = $state({ x: -9999, y: -9999 });
  let typed = '';
  let typedTimer: ReturnType<typeof setTimeout> | undefined;

  const entries = $derived(contextMenu.current?.entries ?? []);
  const actions = $derived(entries.map((e, i) => ({ e, i })).filter((x): x is { e: MenuAction; i: number } => !isSeparator(x.e)));

  $effect(() => {
    const current = contextMenu.current;
    if (!current || !menu) return;
    if (!menu.matches(':popover-open')) menu.showPopover();
    position = menuPosition(current, menu.getBoundingClientRect(), { width: innerWidth, height: innerHeight }, settings.overlay.offsetPx);
    active = -1;
    void tick().then(() => menu?.focus());
    const outside = (event: PointerEvent) => !menu?.contains(event.target as Node) && contextMenu.close();
    const away = () => contextMenu.close();
    document.addEventListener('pointerdown', outside, true);
    addEventListener('resize', away);
    addEventListener('blur', away);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      removeEventListener('resize', away);
      removeEventListener('blur', away);
      if (menu?.matches(':popover-open')) menu.hidePopover();
      position = { x: -9999, y: -9999 };
    };
  });

  function run(action: MenuAction) {
    if (action.disabled) return;
    contextMenu.close();
    action.run();
  }

  /** Next enabled action from the active one in `step` direction (wraps). */
  function move(step: 1 | -1, from = active) {
    const enabled = actions.filter((a) => !a.e.disabled).map((a) => a.i);
    if (!enabled.length) return;
    const index = enabled.indexOf(from);
    active = index < 0 ? (step > 0 ? enabled[0] : enabled[enabled.length - 1]) : enabled[(index + step + enabled.length) % enabled.length];
  }

  function typeahead(key: string) {
    clearTimeout(typedTimer);
    typed += key.toLocaleLowerCase();
    typedTimer = setTimeout(() => (typed = ''), 600);
    const match = actions.find((a) => !a.e.disabled && a.e.label.toLocaleLowerCase().startsWith(typed));
    if (match) active = match.i;
  }

  function keydown(event: KeyboardEvent) {
    const current = entries[active];
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Home: () => move(1, -1),
      End: () => move(-1, -1),
      Enter: () => current && !isSeparator(current) && run(current),
      ' ': () => current && !isSeparator(current) && run(current),
      Escape: () => contextMenu.close(),
      Tab: () => contextMenu.close(),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      // The menu owns the keyboard while open (no window close, no list shortcuts).
      event.stopPropagation();
      action();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.stopPropagation();
      typeahead(event.key);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={menu}
  class="menu"
  role="menu"
  tabindex="-1"
  popover="manual"
  aria-label="Kontextmenü"
  aria-activedescendant={active >= 0 ? `context-menu-${active}` : undefined}
  style:left="{position.x}px"
  style:top="{position.y}px"
  onkeydown={keydown}
  oncontextmenu={(e) => e.preventDefault()}
>
  {#each entries as entry, index (index)}
    {#if isSeparator(entry)}
      <div class="separator" role="separator"></div>
    {:else}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        id="context-menu-{index}"
        class="item"
        class:danger={entry.danger}
        class:active={index === active}
        role="menuitem"
        tabindex="-1"
        aria-disabled={entry.disabled}
        onclick={() => run(entry)}
        onpointermove={() => !entry.disabled && (active = index)}
      >
        {#if entry.icon}<Icon name={entry.icon} small />{/if}
        <span class="label">{entry.label}</span>
        {#if entry.command}<Kbd keys={keymap.keys(entry.command)} />{/if}
      </div>
    {/if}
  {/each}
</div>

<style>
  .menu {
    position: fixed;
    inset: auto;
    min-width: 12rem;
    max-width: 20rem;
    margin: 0;
    padding: var(--space-xs);
    border: 0;
    border-radius: var(--radius-lg);
    background: var(--color-elevated);
    color: var(--color-text);
    box-shadow: var(--color-shadow-popover);
    outline: none;
  }
  .menu:popover-open {
    animation: pop-in var(--motion-base) var(--motion-easing);
    transform-origin: top left;
  }
  @keyframes pop-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
  }
  .item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: var(--control-height);
    padding: 0 var(--space-sm);
    border-radius: var(--radius-md);
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--motion-fast);
  }
  .label {
    flex: 1;
    margin-right: var(--space-lg);
  }
  .item :global(.icon) {
    color: var(--color-text-muted);
  }
  .item.danger :global(.icon) {
    color: currentColor;
  }
  .item.active {
    background: var(--color-hover);
  }
  .item.danger {
    color: var(--color-danger);
  }
  .item[aria-disabled='true'] {
    color: var(--color-text-faint);
    cursor: default;
  }
  .separator {
    height: 1px;
    margin: var(--space-xs) calc(-1 * var(--space-xs));
    background: var(--color-border);
  }
</style>
