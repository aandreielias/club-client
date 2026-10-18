import type { Attachment } from 'svelte/attachments';
import { keyboard, keymap, tooltips } from '../lib/container';
import { KeySpec } from '../lib/keyboard/KeySpec';
import type { CommandId } from '../shortcuts';

/**
 * Custom tooltip for any element: `<button {@attach tooltip('Text')}>`. Hover shows it after the
 * delay from settings.overlay, keyboard focus at once; Escape, leaving or pressing hides it.
 * Use it for supplementary text only; the element needs its own accessible name.
 */
export function tooltip(text: string | null | undefined | (() => string | null | undefined)): Attachment<HTMLElement> {
  return (node) => {
    if (!text) return;
    // A function is read when the tooltip opens, so it follows the element's current state.
    const show = (immediate: boolean) => {
      const value = typeof text === 'function' ? text() : text;
      if (value) tooltips.show(node, value, immediate);
    };
    const enter = () => show(false);
    const focus = () => node.matches(':focus-visible') && show(true);
    const leave = () => tooltips.hide(node);
    // Removing a focused element fires blur during Svelte's teardown, where state writes throw; hide afterwards.
    const later = () => queueMicrotask(leave);
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
      ['input', leave],
      ['focus', focus],
      ['blur', later],
      ['keydown', key as EventListener],
    ];
    events.forEach(([type, listener]) => node.addEventListener(type, listener));
    return () => {
      events.forEach(([type, listener]) => node.removeEventListener(type, listener));
      later();
    };
  };
}

/** Tooltip text with the command's current keys, e.g. "Fenster schließen (Esc)". */
export function withKeys(text: string, command: CommandId): string {
  const keys = keymap.keys(command);
  return keys ? `${text} (${KeySpec.text(keys, keyboard.isMac)})` : text;
}
