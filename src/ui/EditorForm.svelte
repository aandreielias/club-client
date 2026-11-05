<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Action } from '../lib/state/Action.svelte';
  import { autofocus } from './autofocus';
  import Button from './Button.svelte';
  import ErrorNote from './ErrorNote.svelte';

  /**
   * The frame of every record editor: fields, the save error, save and cancel. With `validate`, the form checks itself
   * (`submitted` shows the errors, `valid` gates the save) instead of the browser.
   */
  let {
    action,
    submitLabel,
    oncancel,
    onsubmit,
    validate,
    children,
  }: {
    action: Action;
    submitLabel: string;
    oncancel: () => void;
    onsubmit: () => void;
    validate?: { submitted: boolean; readonly valid: boolean };
    children: Snippet;
  } = $props();

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (validate) {
      validate.submitted = true;
      if (!validate.valid) return;
    }
    onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} novalidate={!!validate} {@attach autofocus}>
  {@render children()}
  <ErrorNote error={action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={action.busy}>{submitLabel}</Button>
    <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
  </div>
</form>
