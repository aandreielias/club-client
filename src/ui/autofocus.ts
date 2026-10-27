import type { Attachment } from 'svelte/attachments';

const FIELD =
  'input:not([type="hidden"], [type="checkbox"], [type="radio"], :disabled), textarea:not(:disabled), select:not(:disabled), [role="combobox"]';

/**
 * Focuses the first field inside the element once it is shown (edit forms, create windows), so
 * typing can start at once. Runs after the window has taken focus for itself.
 */
export const autofocus: Attachment<HTMLElement> = (node) => {
  const frame = requestAnimationFrame(() => node.querySelector<HTMLElement>(FIELD)?.focus({ preventScroll: true }));
  return () => cancelAnimationFrame(frame);
};
