<script lang="ts">
  import { tooltips } from '../lib/container';
  import Icon from './Icon.svelte';
  import { tooltip } from './tooltip';

  /**
   * ⓘ next to a label or heading: the explanation shows as tooltip on hover and focus, a tap toggles it (touch has no hover).
   * Never inside a <label>: a button there would take the label's control.
   */
  let { text }: { text: string } = $props();

  function toggle(event: MouseEvent) {
    const node = event.currentTarget as HTMLElement;
    if (tooltips.isOwner(node)) return tooltips.hide(node);
    tooltips.show(node, text, true);
    // The next tap anywhere closes it again.
    setTimeout(() => addEventListener('pointerdown', () => tooltips.hide(node), { capture: true, once: true }));
  }
</script>

<button type="button" class="info" aria-label="Hinweis" onclick={toggle} {@attach tooltip(text)}>
  <Icon name="info" small />
</button>

<style>
  .info {
    display: inline-flex;
    align-self: center;
    justify-self: start;
    padding: 2px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-muted);
    cursor: help;
    vertical-align: middle;
  }
  .info:hover,
  .info:focus-visible {
    color: var(--color-accent);
  }
</style>
