<script lang="ts">
  import { settings } from '../../settings';
  import { SHORTCUTS, type CommandId } from '../../shortcuts';
  import { keyboard, keymap } from '../../lib/container';
  import { KeySpec } from '../../lib/keyboard/KeySpec';
  import Button from '../../ui/Button.svelte';
  import Dialog from '../../ui/Dialog.svelte';
  import Kbd from '../../ui/Kbd.svelte';

  /**
   * Records new keys for one command: one combo, or two plain keys in a row (a sequence).
   * Shows clashes with other commands and lets the user take the keys over from them.
   */
  let { id, onclose }: { id: CommandId; onclose: () => void } = $props();

  let steps = $state<string[]>([]);
  let waiting = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const spec = $derived(steps.join(' '));
  // svelte-ignore state_referenced_locally
  const label = SHORTCUTS[id].label;
  const conflicts = $derived(spec ? keymap.conflicts(id, spec) : []);

  $effect(() => {
    keyboard.enabled = false;
    return () => {
      keyboard.enabled = true;
      clearTimeout(timer);
    };
  });

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Tab' || event.key === 'Escape') return; // keep focus moving and closing possible
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON' && (event.key === 'Enter' || event.key === ' ')) return;
    const combo = KeySpec.fromEvent(event, keyboard.isMac);
    if (!combo) return;
    event.preventDefault();
    clearTimeout(timer);
    if (waiting && steps.length === 1) {
      steps = [steps[0], combo];
      waiting = false;
      return;
    }
    steps = [combo];
    // A plain key may start a sequence: wait briefly for a second one.
    waiting = !KeySpec.hasCommandModifier(combo) && combo.length === 1;
    if (waiting) timer = setTimeout(() => (waiting = false), settings.keyboard.recordSequenceMs);
  }

  function save() {
    for (const other of conflicts) keymap.clear(other);
    keymap.set(id, spec);
    onclose();
  }
</script>

<Dialog open title="Tastenkürzel ändern" {onclose}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="stack" onkeydown={keydown}>
    <p>{label}</p>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="capture" tabindex="0" aria-live="polite" aria-label="Neue Tasten drücken">
      {#if spec}
        <Kbd keys={spec} />
        {#if waiting}<span class="muted small">Weitere Taste für eine Folge möglich …</span>{/if}
      {:else}
        <span class="muted">Jetzt die neuen Tasten drücken</span>
      {/if}
    </div>
    {#if conflicts.length}
      <p class="warning small" role="alert">
        Schon belegt durch {conflicts.map((c) => `„${SHORTCUTS[c].label}“`).join(', ')}. Beim Speichern verliert
        {conflicts.length === 1 ? 'dieser Befehl seine' : 'diese Befehle ihre'} Tasten.
      </p>
    {/if}
    <div class="row">
      <Button variant="primary" disabled={!spec || waiting} onclick={save}>{conflicts.length ? 'Trotzdem speichern' : 'Speichern'}</Button>
      <Button variant="ghost" onclick={onclose}>Abbrechen</Button>
    </div>
  </div>
</Dialog>

<style>
  p {
    margin: 0;
  }
  .capture {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    min-height: 56px;
    padding: var(--space-md);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-field);
  }
  .capture:focus-visible {
    outline: 2px solid var(--color-accent);
  }
  .warning {
    color: var(--color-warning);
  }
</style>
