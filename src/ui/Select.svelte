<script lang="ts" module>
  export interface SelectOption<T extends string = string> {
    value: T;
    label: string;
    disabled?: boolean;
  }

  let nextId = 0;
</script>

<script lang="ts" generics="V extends string">
  import { tick } from 'svelte';
  import { tooltip } from './tooltip';

  /**
   * The one dropdown of the app, drawn in the house style (select-only combobox, WAI-ARIA pattern).
   * Keyboard: Enter/Space/Alt+Down open, arrows/Home/End move, letters jump, Enter/Space choose,
   * Escape/Tab close. The list lives in the top layer (popover), so dialogs and windows never clip it.
   */
  let {
    value = $bindable(),
    options,
    placeholder,
    inline = false,
    disabled = false,
    id,
    onchange,
    'aria-label': ariaLabel,
  }: {
    value: V | '';
    options: readonly SelectOption<V>[];
    placeholder?: string;
    inline?: boolean;
    disabled?: boolean;
    id?: string;
    /** Called after the user picked another value. */
    onchange?: (value: V) => void;
    'aria-label'?: string;
  } = $props();

  const listId = `select-list-${nextId++}`;
  let open = $state(false);
  let active = $state(-1);
  let trigger: HTMLButtonElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();
  let typed = '';
  let typedTimer: ReturnType<typeof setTimeout> | undefined;

  const selectedIndex = $derived(options.findIndex((o) => o.value === value));
  const selected = $derived(selectedIndex >= 0 ? options[selectedIndex] : undefined);

  async function show() {
    if (disabled || open || !trigger || !list) return;
    active = selectedIndex >= 0 ? selectedIndex : firstEnabled(0, 1);
    open = true;
    place();
    list.showPopover();
    await tick();
    list.focus();
    scrollActive();
    document.addEventListener('pointerdown', outside, true);
  }

  function hide(focusTrigger = true) {
    if (!open) return;
    open = false;
    if (list?.matches(':popover-open')) list.hidePopover();
    document.removeEventListener('pointerdown', outside, true);
    if (focusTrigger) trigger?.focus();
  }

  function outside(event: PointerEvent) {
    const target = event.target as Node;
    if (!list?.contains(target) && !trigger?.contains(target)) hide(false);
  }

  /** Below the trigger, or above when there is no room; at least as wide as the trigger. */
  function place() {
    if (!trigger || !list) return;
    const rect = trigger.getBoundingClientRect();
    const height = Math.min(list.scrollHeight || 280, 280);
    const below = innerHeight - rect.bottom >= height + 8 || rect.top < height + 8;
    list.style.minWidth = `${rect.width}px`;
    list.style.left = `${Math.min(rect.left, innerWidth - Math.max(rect.width, 160) - 8)}px`;
    list.style.top = below ? `${rect.bottom + 4}px` : `${rect.top - height - 4}px`;
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    const changed = option.value !== value;
    value = option.value;
    hide();
    if (!changed) return;
    onchange?.(option.value);
    // Like a native select: lets surrounding forms notice the edit (unsaved-changes check).
    trigger?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function firstEnabled(from: number, step: 1 | -1): number {
    for (let i = from; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i;
    return -1;
  }

  function moveActive(step: 1 | -1) {
    const next = firstEnabled(active + step, step);
    if (next >= 0) active = next;
    scrollActive();
  }

  function scrollActive() {
    void tick().then(() => list?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }));
  }

  /** Letters jump to the next option starting with what was typed. */
  function typeahead(key: string) {
    clearTimeout(typedTimer);
    typed += key.toLocaleLowerCase();
    typedTimer = setTimeout(() => (typed = ''), 600);
    const start = typed.length === 1 ? active + 1 : Math.max(active, 0);
    const ordered = [...options.keys()].map((i) => (i + start) % options.length);
    const match = ordered.find((i) => !options[i].disabled && options[i].label.toLocaleLowerCase().startsWith(typed));
    if (match !== undefined) {
      active = match;
      scrollActive();
    }
  }

  function triggerKey(event: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      void show();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Typing on the closed field picks directly, like a native select.
      event.preventDefault();
      active = selectedIndex;
      typeahead(event.key);
      if (active >= 0 && active !== selectedIndex) choose(active);
    }
  }

  function listKey(event: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => moveActive(1),
      ArrowUp: () => moveActive(-1),
      Home: () => ((active = firstEnabled(0, 1)), scrollActive()),
      End: () => ((active = firstEnabled(options.length - 1, -1)), scrollActive()),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => hide(),
    };
    if (event.key === 'Tab') {
      hide();
      return;
    }
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      // Escape must not also close the surrounding window or dialog.
      event.stopPropagation();
      action();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      typeahead(event.key);
    }
  }
</script>

<span class="select" class:inline>
  <button
    bind:this={trigger}
    type="button"
    role="combobox"
    class="trigger"
    {id}
    {disabled}
    aria-label={ariaLabel}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={listId}
    onclick={() => (open ? hide() : void show())}
    onkeydown={triggerKey}
    {@attach tooltip(() => (open ? null : (ariaLabel ?? placeholder)))}
  >
    <span class="value" class:placeholder={!selected}>{selected?.label ?? placeholder ?? ''}</span>
  </button>
  <ul
    bind:this={list}
    id={listId}
    popover="manual"
    role="listbox"
    tabindex="-1"
    aria-label={ariaLabel ?? placeholder}
    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
    onkeydown={listKey}
  >
    {#each options as option, index (option.value)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        id="{listId}-{index}"
        role="option"
        aria-selected={option.value === value}
        aria-disabled={option.disabled}
        data-active={index === active}
        onclick={() => choose(index)}
        onpointermove={() => !option.disabled && (active = index)}
      >
        <span class="tick" aria-hidden="true"></span>
        {option.label}
      </li>
    {/each}
  </ul>
</span>

<style>
  .select {
    display: block;
    min-width: 0;
  }
  .select.inline {
    display: inline-block;
  }
  .trigger {
    display: flex;
    align-items: center;
    width: 100%;
    height: var(--control-height);
    padding: 0 calc(var(--control-padding-x) + 14px) 0 var(--control-padding-x);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    /* Caret from two gradients, as in the base stylesheet: no icon asset. */
    background:
      linear-gradient(45deg, transparent 50%, var(--color-text-muted) 50%) right calc(var(--control-padding-x) + 4px) center / 4px 4px no-repeat,
      linear-gradient(135deg, var(--color-text-muted) 50%, transparent 50%) right var(--control-padding-x) center / 4px 4px no-repeat,
      var(--color-elevated);
    box-shadow: var(--color-shadow-raised);
    color: var(--color-text);
    font-size: var(--font-size-base);
    line-height: 1.3;
    text-align: left;
    cursor: pointer;
    transition:
      border-color var(--motion-fast),
      box-shadow var(--motion-fast),
      transform var(--motion-fast) var(--motion-easing);
  }
  .trigger:active:not(:disabled) {
    transform: scale(0.98);
  }
  .inline .trigger {
    width: auto;
  }
  .trigger:hover:not(:disabled) {
    border-color: var(--color-border-strong);
  }
  .trigger[aria-expanded='true'],
  .trigger:focus-visible {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
  }
  .trigger:disabled {
    color: var(--color-text-faint);
    cursor: not-allowed;
  }
  .value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .placeholder {
    color: var(--color-text-faint);
  }

  ul {
    position: fixed;
    inset: auto;
    max-height: 280px;
    margin: 0;
    padding: var(--space-xs);
    overflow-y: auto;
    border: 0;
    border-radius: var(--radius-lg);
    background: var(--color-elevated);
    color: var(--color-text);
    box-shadow: var(--color-shadow-popover);
    list-style: none;
    outline: none;
  }
  ul:popover-open {
    animation: pop-in var(--motion-base) var(--motion-easing);
    transform-origin: top center;
  }
  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: var(--control-height);
    padding: 0 var(--space-sm) 0 var(--space-xs);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--motion-fast);
  }
  li[data-active='true'] {
    background: var(--color-hover);
  }
  li[aria-disabled='true'] {
    color: var(--color-text-faint);
    cursor: default;
  }
  /* Checkmark of the chosen option ("Hackerl"), drawn with borders like the checkbox. */
  .tick {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    display: grid;
    place-content: center;
  }
  .tick::before {
    content: '';
    width: 8px;
    height: 4px;
    margin-top: -2px;
    border-bottom: 2px solid var(--color-accent);
    border-left: 2px solid var(--color-accent);
    transform: rotate(-45deg) scale(0);
    transition: transform var(--motion-base) var(--motion-easing);
  }
  li[aria-selected='true'] .tick::before {
    transform: rotate(-45deg) scale(1);
  }
</style>
