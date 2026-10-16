<script lang="ts">
  import { tick } from 'svelte';
  import { bus, commands, keymap, recentRecords, windows } from '../lib/container';
  import { WINDOW_OPEN } from '../channels';
  import type { AvailableCommand } from '../lib/keyboard/CommandRegistry.svelte';
  import { motion } from '../lib/container';
  import Icon from './Icon.svelte';
  import Kbd from './Kbd.svelte';

  /** Searchable list of the recently opened records and every command available right now, with its keys. */
  interface Entry {
    key: string;
    label: string;
    group: string;
    command?: AvailableCommand;
    run: () => void;
  }
  let query = $state('');
  let active = $state(0);
  let input: HTMLInputElement | undefined = $state();
  let opener: HTMLElement | null = null;

  const matches = $derived.by((): Entry[] => {
    if (!commands.paletteOpen) return [];
    const needle = query.trim().toLocaleLowerCase();
    const fits = (text: string) => !needle || text.toLocaleLowerCase().includes(needle);
    const recent = recentRecords.items
      .filter((r) => windows.content(r.kind) && fits(r.title))
      .map((r): Entry => ({ key: `recent:${r.kind}:${r.id}`, label: r.title, group: 'Zuletzt geöffnet', run: () => bus.publish(WINDOW_OPEN, { kind: r.kind, id: r.id }) }));
    const available = commands
      .available()
      .filter((c) => c.id !== 'palette.open' && fits(`${c.label} ${c.group}`))
      .map((c): Entry => ({ key: c.id, label: c.label, group: c.group, command: c, run: c.run }));
    return [...recent, ...available];
  });

  $effect(() => {
    if (commands.paletteOpen) {
      opener = document.activeElement as HTMLElement | null;
      query = '';
      active = 0;
      // After the current frame: a window that just closed may still hand focus back to its opener.
      void tick().then(() => requestAnimationFrame(() => input?.focus()));
    }
  });

  function close() {
    commands.paletteOpen = false;
    opener?.focus?.();
  }

  function run(entry: Entry | undefined) {
    if (!entry) return;
    close();
    entry.run();
  }

  function keydown(event: KeyboardEvent) {
    const handled = ['Escape', 'ArrowDown', 'ArrowUp', 'Enter'].includes(event.key);
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowDown') active = Math.min(active + 1, matches.length - 1);
    else if (event.key === 'ArrowUp') active = Math.max(active - 1, 0);
    else run(matches[active]);
  }

  $effect(() => {
    void query;
    active = 0;
  });
</script>

{#if commands.paletteOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={close} transition:motion.fade></div>
  <div class="palette" role="dialog" aria-modal="true" aria-label="Befehlspalette" transition:motion.pop={{ origin: 'top' }}>
    <label class="query">
    <Icon name="commands" />
    <input
      bind:this={input}
      bind:value={query}
      onkeydown={keydown}
      placeholder="Befehl oder zuletzt geöffneten Eintrag suchen"
      aria-label="Befehl suchen"
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-list"
      aria-activedescendant={matches[active] ? `cmd-${active}` : undefined}
    />
    </label>
    <ul id="palette-list" role="listbox">
      {#each matches as entry, index (entry.key)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li id="cmd-{index}" role="option" aria-selected={index === active} class:active={index === active}
          onclick={() => run(entry)} onmousemove={() => (active = index)}>
          <span class="label">{entry.label}</span>
          <span class="group muted">{entry.group}</span>
          {#if entry.command}<Kbd keys={keymap.keys(entry.command.id)} />{:else}<span></span>{/if}
        </li>
      {:else}
        <li class="empty muted">Kein passender Befehl.</li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--color-backdrop);
  }
  .palette {
    position: fixed;
    top: 12vh;
    left: 50%;
    z-index: 41;
    display: flex;
    flex-direction: column;
    width: min(620px, calc(100vw - 32px));
    max-height: 60vh;
    overflow: hidden;
    border-radius: var(--radius-xl);
    background: var(--color-elevated);
    box-shadow: var(--color-shadow-window);
    translate: -50% 0;
  }
  .query {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 0 var(--space-lg);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-faint);
  }
  /* The palette's field is borderless; beat the base control styles (hover/focus selectors are stronger). */
  .query input {
    height: 52px;
    padding: 0;
    border: 0 !important;
    border-radius: 0;
    background: transparent;
    box-shadow: none !important;
    color: var(--color-text);
    font-size: 15px;
  }
  ul {
    overflow-y: auto;
    padding: var(--space-xs);
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-md);
    min-height: 34px;
    padding: 0 var(--space-md);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--motion-fast);
  }
  li.active {
    background: var(--color-selected);
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group {
    font-size: var(--font-size-small);
  }
  .empty {
    display: block;
    padding: var(--space-md);
    cursor: default;
  }
</style>
