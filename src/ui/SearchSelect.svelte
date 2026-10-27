<script lang="ts" module>
  let nextId = 0;
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { AnchoredList } from '../lib/overlay/AnchoredList.svelte';
  import type { SelectOption } from './Select.svelte';

  /**
   * Text field with a suggestion list (WAI-ARIA combobox, list autocomplete) for picking one entry
   * out of many: typing filters, arrows move, Enter picks, Escape closes. `search` may filter
   * locally or ask the server; only the latest answer is shown. The field empties after a pick.
   */
  let {
    search,
    onpick,
    placeholder,
    debounceMs = 0,
    emptyText = 'Keine Treffer.',
    'aria-label': ariaLabel,
  }: {
    search: (query: string) => readonly SelectOption[] | Promise<readonly SelectOption[]>;
    onpick: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
    emptyText?: string;
    'aria-label'?: string;
  } = $props();

  const listId = `search-select-${nextId++}`;
  let query = $state('');
  let options = $state.raw<readonly SelectOption[]>([]);
  let loading = $state(false);
  let failed = $state(false);
  let active = $state(-1);
  let input: HTMLInputElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sequence = 0;
  const popover = new AnchoredList(
    () => input,
    () => list,
    () => hide(),
    'match',
  );

  async function run(text: string) {
    const current = ++sequence;
    loading = true;
    try {
      const result = await search(text);
      if (current !== sequence) return;
      options = result;
      failed = false;
      active = result.length ? 0 : -1;
    } catch {
      if (current === sequence) failed = true;
    } finally {
      if (current === sequence) loading = false;
    }
    await tick();
    popover.place();
  }

  function schedule() {
    clearTimeout(timer);
    show();
    if (debounceMs > 0) timer = setTimeout(() => void run(query), debounceMs);
    else void run(query);
  }

  function show() {
    popover.show();
  }

  function hide() {
    popover.hide();
  }

  function pick(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onpick(option.value);
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    query = '';
    options = options.filter((o) => o.value !== option.value);
    active = Math.min(index, options.length - 1);
    input?.focus();
  }

  function move(step: 1 | -1) {
    if (!options.length) return;
    active = (active + step + options.length) % options.length;
    popover.scrollActive();
  }

  function keydown(event: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => (popover.open ? move(1) : schedule()),
      ArrowUp: () => move(-1),
      Enter: () => popover.open && pick(active),
      Escape: () => hide(),
    };
    const action = keys[event.key];
    if (!action || (event.key === 'Escape' && !popover.open)) {
      if (event.key === 'Tab') hide();
      return;
    }
    event.preventDefault();
    // Escape and Enter must not also reach the surrounding window or form.
    event.stopPropagation();
    action();
  }
</script>

<span class="search-select">
  <input
    bind:this={input}
    bind:value={query}
    type="text"
    role="combobox"
    autocomplete="off"
    {placeholder}
    aria-label={ariaLabel}
    aria-autocomplete="list"
    aria-expanded={popover.open}
    aria-controls={listId}
    aria-activedescendant={popover.open && active >= 0 ? `${listId}-${active}` : undefined}
    oninput={schedule}
    onfocus={schedule}
    onkeydown={keydown}
  />
  <ul bind:this={list} id={listId} popover="manual" role="listbox" aria-label={ariaLabel ?? placeholder}>
    {#each options as option, index (option.value)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        id="{listId}-{index}"
        role="option"
        aria-selected={index === active}
        aria-disabled={option.disabled}
        data-active={index === active}
        onpointerdown={(e) => e.preventDefault()}
        onclick={(e) => (e.preventDefault(), pick(index))}
        onpointermove={() => (active = index)}
      >
        {option.label}
      </li>
    {:else}
      <li class="note" role="presentation">{failed ? 'Suche fehlgeschlagen.' : loading ? 'Suche läuft' : emptyText}</li>
    {/each}
  </ul>
</span>

<style>
  .search-select {
    display: block;
    min-width: 0;
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
  }
  ul:popover-open {
    animation: pop-in var(--motion-base) var(--motion-easing);
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
    min-height: var(--control-height);
    padding: 0 var(--space-sm);
    overflow: hidden;
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  li[data-active='true'] {
    background: var(--color-hover);
  }
  li[aria-disabled='true'],
  .note {
    color: var(--color-text-faint);
    cursor: default;
  }
</style>
