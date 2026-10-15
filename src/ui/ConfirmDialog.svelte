<script lang="ts">
  import { confirmation } from '../lib/container';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
</script>

{#if confirmation.current}
  {@const request = confirmation.current}
  <Dialog open title={request.title} onclose={() => confirmation.answer(false)}>
    <div class="stack">
      <p>{request.message}</p>
      <div class="row">
        <Button variant={request.danger ? 'danger' : 'primary'} onclick={() => confirmation.answer(true)}
          tooltip="{request.confirmLabel}: {request.title}">{request.confirmLabel}</Button>
        <Button variant="ghost" onclick={() => confirmation.answer(false)}>Abbrechen</Button>
      </div>
    </div>
  </Dialog>
{/if}
