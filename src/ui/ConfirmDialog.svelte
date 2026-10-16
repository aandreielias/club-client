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
      <div class="row end">
        <Button variant="ghost" onclick={() => confirmation.answer(false)}>Abbrechen</Button>
        <Button variant={request.danger ? 'danger' : 'primary'} onclick={() => confirmation.answer(true)}
          tooltip="{request.confirmLabel}: {request.title}">{request.confirmLabel}</Button>
      </div>
    </div>
  </Dialog>
{/if}

<style>
  .end {
    justify-content: flex-end;
  }
  p {
    margin: 0;
    color: var(--color-text-muted);
  }
</style>
