import type { CommandId } from '../../shortcuts';

export interface MenuAction {
  label: string;
  run: () => void;
  disabled?: boolean;
  /** Destructive actions are drawn in the danger colour. */
  danger?: boolean;
  /** Command id from src/shortcuts.ts whose current keys are shown as a hint. */
  command?: CommandId;
}

export interface MenuSeparator {
  separator: true;
}

export type MenuEntry = MenuAction | MenuSeparator;

export interface OpenMenu {
  x: number;
  y: number;
  entries: readonly MenuEntry[];
  /** Element focused before opening; focus returns there on close. */
  returnFocus: HTMLElement | null;
}

export const isSeparator = (entry: MenuEntry): entry is MenuSeparator => 'separator' in entry;

/**
 * The one context menu of the app. Lists and the calendar collect their entries per row or entry;
 * the host (ui/ContextMenuHost) renders, positions and drives it from the keyboard.
 */
export class ContextMenuService {
  current = $state.raw<OpenMenu | null>(null);

  /** Opens at a point; leading, trailing and doubled separators are dropped. Nothing opens without actions. */
  show(x: number, y: number, entries: readonly MenuEntry[], returnFocus: HTMLElement | null = null): boolean {
    const cleaned = ContextMenuService.clean(entries);
    if (!cleaned.some((e) => !isSeparator(e))) return false;
    this.current = { x, y, entries: cleaned, returnFocus };
    return true;
  }

  close(): void {
    const focus = this.current?.returnFocus;
    this.current = null;
    if (focus?.isConnected) focus.focus();
  }

  static clean(entries: readonly MenuEntry[]): MenuEntry[] {
    const out: MenuEntry[] = [];
    for (const entry of entries) {
      if (isSeparator(entry) && (!out.length || isSeparator(out[out.length - 1]))) continue;
      out.push(entry);
    }
    while (out.length && isSeparator(out[out.length - 1])) out.pop();
    return out;
  }
}
