<script lang="ts" module>
  import type { Hue } from '../lib/types';

  export type TagHue = Hue;
  /** Semantic aliases used across features. */
  export type TagTone = TagHue | 'neutral' | 'success' | 'warning' | 'danger';

  const ALIASES: Record<string, TagHue> = { neutral: 'gray', success: 'green', warning: 'yellow', danger: 'red' };

  export const hueOf = (tone: TagTone): TagHue => ALIASES[tone] ?? (tone as TagHue);
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  let { tone = 'neutral', children }: { tone?: TagTone; children: Snippet } = $props();
</script>

<span class="tag" style:--tag-bg="var(--color-tag-{hueOf(tone)}-bg)" style:--tag-text="var(--color-tag-{hueOf(tone)}-text)">
  {@render children()}
</span>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--radius-sm);
    background: var(--tag-bg);
    color: var(--tag-text);
    font-size: var(--font-size-small);
    line-height: 1;
    white-space: nowrap;
  }
</style>
