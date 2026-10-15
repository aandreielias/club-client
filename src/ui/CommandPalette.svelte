<script lang="ts">
  import { tick } from 'svelte';
  import { commands, keymap } from '../lib/container';
  import type { AvailableCommand } from '../lib/keyboard/CommandRegistry.svelte';
  import Kbd from './Kbd.svelte';

  /** Searchable list of every command available right now, with its keys. */
  let query = $state('');
  let active = $state(0);
  let input: HTMLInputElement | undefined = $state();
  let opener: HTMLElement | null = null;

  const matches = $derived.by(() => {
    if (!commands.paletteOpen) return [] as AvailableCommand[];
    const needle = query.trim().toLocaleLowerCase();
    return commands
      .available()
      .filter((c) => c.id !== 'palette.open' && (!needle || `${c.label} ${c.group}`.toLocaleLowerCase().includes(needle)));
  });

  $effect(() => {
    if (commands.paletteOpen) {
      opener = document.activeElement as HTMLElement | null;
      query = '';
      active = 0;
      void tick().then(() => input?.focus());
    }
  });

  function close() {
    commands.paletteOpen = false;
    opener?.focus?.();
  }

  function run(command: AvailableCommand | undefined) {
    if (!command) return;
    close();
    command.run();
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
  <div class="backdrop" onclick={close}></div>
  <div class="palette" role="dialog" aria-modal="true" aria-label="Befehlspalette">
    <input
      bind:this={input}
      bind:value={query}
      onkeydown={keydown}
      placeholder="Befehl suchen"
      aria-label="Befehl suchen"
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-list"
      aria-activedescendant={matches[active] ? `cmd-${matches[active].id}` : undefined}
    />
    <ul id="palette-list" role="listbox">
      {#each matches as command, index (command.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li id="cmd-{command.id}" role="option" aria-selected={index === active} class:active={index === active}
          onclick={() => run(command)} onmousemove={() => (active = index)}>
          <span class="label">{command.label}</span>
          <span class="group muted">{command.group}</span>
          <Kbd keys={keymap.keys(command.id)} />
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
    border-radius: var(--radius-lg);
    background: var(--color-background);
    box-shadow: var(--color-shadow-window);
    translate: -50% 0;
  }
  input {
    min-height: 48px;
    padding: 0 var(--space-lg);
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    font-size: 16px;
  }
  input:focus {
    border-color: var(--color-border);
    box-shadow: none;
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
  }
  li.active {
    background: var(--color-hover);
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
