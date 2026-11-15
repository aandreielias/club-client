import type { Attachment } from 'svelte/attachments';
import { bus, contextMenu, recordActions, router, windows } from '../lib/container';
import { recordMenuSource, type RecordMenuOptions } from '../lib/actions/recordMenu';
import type { MenuSource } from '../lib/overlay/ContextMenuService.svelte';
import { settings } from '../settings';

/**
 * Custom right-click menu for an element: `<tr {@attach menu(() => entries)}>`. The context-menu key
 * and Shift+F10 open it at the element, a long press on touch screens too (iOS has no contextmenu event).
 * Without actions the browser's own menu stays; the innermost element with a menu wins (a calendar chip inside a day cell).
 */
export function menu(entries: () => MenuSource): Attachment<HTMLElement> {
  return (node) => {
    let press: ReturnType<typeof setTimeout> | undefined;
    let start = { x: 0, y: 0 };
    const cancel = () => clearTimeout(press);
    const open = (event: MouseEvent) => {
      cancel();
      // Text fields and selected text keep the browser's menu (copy, paste, spelling).
      if (editable(event.target) || document.getSelection()?.toString()) return;
      // Keyboard-opened context menus carry no pointer position.
      const keyboard = event.clientX === 0 && event.clientY === 0;
      if (keyboard ? openMenuAt(node, entries()) : contextMenu.show(event.clientX, event.clientY, entries(), focused())) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      start = { x: event.clientX, y: event.clientY };
      cancel();
      press = setTimeout(() => {
        if (!contextMenu.show(start.x, start.y, entries(), focused())) return;
        // The finger lifting after a long press must not also open the row.
        addEventListener('click', (e) => (e.preventDefault(), e.stopPropagation()), { capture: true, once: true });
      }, settings.overlay.longPressMs);
    };
    const move = (event: PointerEvent) => Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10 && cancel();
    const events: [string, EventListener][] = [
      ['contextmenu', open as EventListener],
      ['pointerdown', down as EventListener],
      ['pointermove', move as EventListener],
      ['pointerup', cancel],
      ['pointercancel', cancel],
    ];
    events.forEach(([type, listener]) => node.addEventListener(type, listener));
    return () => {
      cancel();
      events.forEach(([type, listener]) => node.removeEventListener(type, listener));
    };
  };
}

/** Opens the menu below the start of an element (keyboard commands). */
export function openMenuAt(element: Element, entries: MenuSource): boolean {
  const box = element.getBoundingClientRect();
  return contextMenu.show(box.left + 8, box.top + Math.min(box.height, 32), entries, focused());
}

/** The menu of a record wherever it appears (list row, link, calendar entry): open it, its actions, copy a link. */
export function recordMenu(kind: string, id: string, options: RecordMenuOptions = {}): MenuSource {
  return recordMenuSource({ bus, windows, router, actions: recordActions }, kind, id, options);
}

function editable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select'));
}

function focused(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
