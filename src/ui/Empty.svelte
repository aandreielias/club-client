<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<p class="empty">{text}</p>

<style>
  .empty {
    margin: 0;
    padding: var(--space-xl) var(--space-lg);
    color: var(--color-text-faint);
    text-align: center;
  }
</style>
