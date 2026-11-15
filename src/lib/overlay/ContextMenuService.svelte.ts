import type { IconName } from '../../icons';
import type { CommandId } from '../../shortcuts';

export interface MenuAction {
  label: string;
  run: () => void;
  disabled?: boolean;
  /** Destructive actions are drawn in the danger colour. */
  danger?: boolean;
  /** Command id from src/shortcuts.ts whose current keys are shown as a hint. */
  command?: CommandId;
  icon?: IconName;
}

export interface MenuSeparator {
  separator: true;
}

export type MenuEntry = MenuAction | MenuSeparator;

/** Entries known at once plus, optionally, the full list once loaded (record actions need the record). */
export type MenuSource = readonly MenuEntry[] | { now: readonly MenuEntry[]; later: Promise<readonly MenuEntry[]> };

/** Adds entries after a menu's (also after its loaded ones). */
export function extendMenu(source: MenuSource, extra: readonly MenuEntry[]): MenuSource {
  if (!('now' in source)) return [...source, ...extra];
  return { now: [...source.now, ...extra], later: source.later.then((entries) => [...entries, ...extra]) };
}

export interface OpenMenu {
  /** Changes with every opening (not when loaded entries arrive), so the host re-positions and re-focuses only then. */
  id: number;
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
const LOADING: MenuAction = { label: '…', disabled: true, run: () => undefined };

export class ContextMenuService {
  current = $state.raw<OpenMenu | null>(null);
  #opened = 0;

  /**
   * Opens at a point; leading, trailing and doubled separators are dropped. Nothing opens without actions.
   * With `later`, a placeholder row stands in until the loaded entries replace the first ones.
   */
  show(x: number, y: number, source: MenuSource, returnFocus: HTMLElement | null = null): boolean {
    const { now, later } = 'now' in source ? source : { now: source, later: null };
    const cleaned = ContextMenuService.clean(now);
    if (!later && !cleaned.some((e) => !isSeparator(e))) return false;
    const opened = { id: ++this.#opened, x, y, entries: later ? [...cleaned, LOADING] : cleaned, returnFocus };
    this.current = opened;
    later?.then(
      (entries) => this.replace(opened, entries),
      () => this.replace(opened, now),
    );
    return true;
  }

  /** Swaps in loaded entries while the same menu is still open; closes it when nothing is left. */
  private replace(opened: OpenMenu, entries: readonly MenuEntry[]): void {
    if (this.current?.id !== opened.id) return;
    const cleaned = ContextMenuService.clean(entries);
    if (cleaned.some((e) => !isSeparator(e))) this.current = { ...opened, entries: cleaned };
    else this.close();
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
