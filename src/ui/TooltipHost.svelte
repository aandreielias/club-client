<script lang="ts">
  import { settings } from '../settings';
  import { tooltips } from '../lib/container';
  import { tooltipPosition } from '../lib/overlay/placement';

  /** Renders the one tooltip (lib/overlay/TooltipService) in the top layer; mounted once in App. */
  let tip: HTMLDivElement | undefined = $state();
  let position = $state({ x: -9999, y: -9999 });

  $effect(() => {
    const current = tooltips.current;
    if (!current || !tip) return;
    if (!tip.matches(':popover-open')) tip.showPopover();
    position = tooltipPosition(current.anchor, tip.getBoundingClientRect(), { width: innerWidth, height: innerHeight }, settings.overlay.offsetPx);
    return () => {
      if (tip?.matches(':popover-open')) tip.hidePopover();
      position = { x: -9999, y: -9999 };
    };
  });

  // The anchor moved away under a static tooltip: hide instead of pointing at the wrong place.
  $effect(() => {
    if (!tooltips.current) return;
    const hide = () => tooltips.hide();
    addEventListener('scroll', hide, true);
    addEventListener('resize', hide);
    return () => {
      removeEventListener('scroll', hide, true);
      removeEventListener('resize', hide);
    };
  });
</script>

<div
  bind:this={tip}
  id={tooltips.current?.id}
  class="tooltip"
  role="tooltip"
  popover="manual"
  style:left="{position.x}px"
  style:top="{position.y}px"
  style:max-width="{settings.overlay.tooltipMaxWidthPx}px"
>
  {tooltips.current?.text ?? ''}
</div>

<style>
  .tooltip {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 4px var(--space-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--color-text);
    color: var(--color-background);
    box-shadow: var(--color-shadow-popover);
    font-weight: var(--font-weight-medium);
    font-size: var(--font-size-small);
    line-height: 1.4;
    white-space: pre-line;
    overflow-wrap: anywhere;
    pointer-events: none;
  }
  .tooltip:popover-open {
    animation: tip-in var(--motion-fast) var(--motion-easing);
  }
  @keyframes tip-in {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
  }
</style>
