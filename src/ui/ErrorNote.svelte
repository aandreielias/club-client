<script lang="ts">
  import { errors } from '../lib/container';

  /** Shows the user-facing text of an error; renders nothing while `error` is empty. */
  let { error }: { error: unknown } = $props();
</script>

{#if error}
  <p class="error" role="alert">{errors.text(error)}</p>
{/if}

<style>
  .error {
    margin: 0;
    color: var(--color-danger);
  }
</style>
