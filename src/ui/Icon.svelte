<script lang="ts">
  import { ICONS, type IconName } from '../icons';

  /** One icon of the house set (src/icons.ts); decorative unless `label` is given. */
  let { name, small = false, label }: { name: IconName; small?: boolean; label?: string } = $props();

  const Glyph = $derived(ICONS[name]);
</script>

<span class="icon" class:small role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  <Glyph size="100%" />
</span>

<style>
  .icon {
    display: inline-flex;
    flex-shrink: 0;
    width: var(--icon-size);
    height: var(--icon-size);
  }
  .small {
    width: var(--icon-size-small);
    height: var(--icon-size-small);
  }
  .icon :global(svg) {
    width: 100%;
    height: 100%;
    stroke-width: var(--icon-stroke);
  }
</style>
