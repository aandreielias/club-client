<script lang="ts">
  import Icon from './Icon.svelte';

  let { text }: { text: string } = $props();
</script>

<div class="empty enter">
  <span class="glyph"><Icon name="empty" /></span>
  <p>{text}</p>
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    gap: var(--space-sm);
    padding: var(--space-xxl) var(--space-lg);
    color: var(--color-text-muted);
    text-align: center;
  }
  .glyph {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
    background: var(--color-hover);
    color: var(--color-text-faint);
  }
  p {
    margin: 0;
  }
</style>
