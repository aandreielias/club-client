import type { Attachment } from 'svelte/attachments';
import { keyboard, keymap, tooltips } from '../lib/container';
import { KeySpec } from '../lib/keyboard/KeySpec';
import type { CommandId } from '../shortcuts';

/**
 * Custom tooltip for any element: `<button {@attach tooltip('Text')}>`. Hover shows it after the
 * delay from settings.overlay, keyboard focus at once; Escape, leaving or pressing hides it.
 * Use it for supplementary text only; the element needs its own accessible name.
 */
export function tooltip(text: string | null | undefined): Attachment<HTMLElement> {
  return (node) => {
    if (!text) return;
    const enter = () => tooltips.show(node, text);
    const focus = () => node.matches(':focus-visible') && tooltips.show(node, text, true);
    const leave = () => tooltips.hide(node);
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !tooltips.isOwner(node)) return;
      // The first Escape only dismisses the tooltip, not the window or dialog around it.
      event.stopPropagation();
      tooltips.hide(node);
    };
    const events: [string, EventListener][] = [
      ['pointerenter', enter],
      ['pointerleave', leave],
      ['pointerdown', leave],
      ['focus', focus],
      ['blur', leave],
      ['keydown', key as EventListener],
    ];
    events.forEach(([type, listener]) => node.addEventListener(type, listener));
    return () => {
      events.forEach(([type, listener]) => node.removeEventListener(type, listener));
      tooltips.hide(node);
    };
  };
}

/** Tooltip text with the command's current keys, e.g. "Fenster schließen (Esc)". */
export function withKeys(text: string, command: CommandId): string {
  const keys = keymap.keys(command);
  return keys ? `${text} (${KeySpec.text(keys, keyboard.isMac)})` : text;
}
