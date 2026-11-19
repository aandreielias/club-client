<script lang="ts">
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import { calls } from './services';

  /** Joins an online meeting's video call; the call itself runs in its own floating window (CallWindow). */
  let { meeting }: { meeting: { id: string; title: string } } = $props();

  const action = new Action();
  const inThis = $derived(calls.active && calls.meeting?.id === meeting.id);
</script>

<div>
  <Button
    size="sm"
    icon="camera"
    busy={action.busy}
    tooltip={inThis ? 'Videokonferenz wieder anzeigen' : 'Mit Kamera und Mikrofon an der Videokonferenz teilnehmen'}
    onclick={() => action.run(() => calls.join(meeting))}>{inThis ? 'Zur Videokonferenz' : 'Beitreten'}</Button
  >
  <ErrorNote error={action.error} />
</div>
