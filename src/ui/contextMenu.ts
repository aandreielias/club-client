import type { Attachment } from 'svelte/attachments';
import { contextMenu } from '../lib/container';
import type { MenuEntry } from '../lib/overlay/ContextMenuService.svelte';

/**
 * Custom right-click menu for an element: `<tr {@attach menu(() => entries)}>`. The context-menu key
 * and Shift+F10 open it at the element. Without actions the browser's own menu stays; the innermost
 * element with a menu wins (a calendar chip inside a day cell).
 */
export function menu(entries: () => readonly MenuEntry[]): Attachment<HTMLElement> {
  return (node) => {
    const open = (event: MouseEvent) => {
      // Keyboard-opened context menus carry no pointer position.
      const keyboard = event.clientX === 0 && event.clientY === 0;
      if (keyboard ? openMenuAt(node, entries()) : contextMenu.show(event.clientX, event.clientY, entries(), focused())) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    node.addEventListener('contextmenu', open);
    return () => node.removeEventListener('contextmenu', open);
  };
}

/** Opens the menu below the start of an element (keyboard commands). */
export function openMenuAt(element: Element, entries: readonly MenuEntry[]): boolean {
  const box = element.getBoundingClientRect();
  return contextMenu.show(box.left + 8, box.top + Math.min(box.height, 32), entries, focused());
}

function focused(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
