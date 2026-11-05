<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import { backStack, bus } from '../lib/container';
  import { CONFIRM, TOAST } from '../channels';
  import { EditSession } from '../lib/detail/DetailController.svelte';
  import type { SettingsDraft } from '../lib/state/SettingsDraft.svelte';
  import Button from './Button.svelte';
  import ErrorNote from './ErrorNote.svelte';

  /**
   * Club-wide values in Einstellungen as one card: title, intro, the fields, and a save bar that appears as soon as something changed
   * ("Verwerfen" / "Speichern"). Leaving with unsaved changes asks first.
   */
  let {
    title,
    intro,
    draft,
    onsave,
    hint,
    children,
  }: {
    title: string;
    intro?: string;
    draft: SettingsDraft<T>;
    onsave: (value: T) => Promise<T>;
    /** Shown in the save bar, e.g. who the change reaches. */
    hint?: string;
    children: Snippet;
  } = $props();

  // Escape discards, closing the page or tab asks first.
  backStack.while(
    () => draft.dirty,
    () => draft.reset(),
    () => !draft.dirty || bus.request(CONFIRM, EditSession.DISCARD),
    () => draft.dirty,
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (await draft.commit(onsave)) bus.publish(TOAST, { text: 'Gespeichert.' });
  }
</script>

<form class="panel stack" onsubmit={submit} novalidate aria-label={title}>
  <header>
    <h2>{title}</h2>
    {#if intro}<p class="muted small">{intro}</p>{/if}
  </header>
  {@render children()}
  {#if draft.dirty || draft.save.error}
    <div class="bar" role="region" aria-label="Änderungen speichern">
      <ErrorNote error={draft.save.error} />
      <span class="muted small">{hint ?? 'Ungespeicherte Änderungen'}</span>
      <div class="row">
        <Button variant="ghost" onclick={() => draft.reset()}>Verwerfen</Button>
        <Button type="submit" variant="primary" busy={draft.save.busy}>Speichern</Button>
      </div>
    </div>
  {/if}
</form>

<style>
  .bar {
    position: sticky;
    bottom: var(--space-sm);
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--color-shadow-popover);
  }
</style>
