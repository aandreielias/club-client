import type { EventBus } from '../bus';
import type { MenuAction, MenuEntry, MenuSource } from '../overlay/ContextMenuService.svelte';
import type { Router } from '../router/Router.svelte';
import { copyLinkEntry, openEntries } from '../window/windowMenu';
import { WINDOW_CLOSE, type WindowService } from '../window/WindowService.svelte';
import { actionLabel, type RecordAction, type RecordActionRegistry } from './RecordActions';

export interface RecordMenuDeps {
  bus: EventBus;
  windows: WindowService;
  router: Router;
  actions: RecordActionRegistry;
}

export interface RecordMenuOptions {
  /** The menu of the open window itself: no "open" entries. */
  inWindow?: boolean;
  /** The record as the caller already has it (a mail row: loading the mail would mark it read). */
  record?: unknown;
}

/**
 * The context menu of a record: open entries at once, its actions once the record has loaded
 * (only those the member may take), then "Link kopieren". Kinds without actions get the first and last.
 */
export function recordMenuSource(deps: RecordMenuDeps, kind: string, id: string, options: RecordMenuOptions = {}): MenuSource {
  const opening: MenuEntry[] = options.inWindow ? [] : openEntries(deps.bus, deps.windows, kind, id);
  const copy = copyLinkEntry(deps.bus, deps.windows, deps.router, kind, id);
  const now = [...opening, { separator: true } as const, copy];
  const provider = deps.actions.provider(kind);
  if (!provider) return now;
  const later = (options.record !== undefined ? Promise.resolve(options.record) : provider.load(id)).then((record) => [
    ...opening,
    ...actionEntries(deps, kind, id, provider.actions(record)),
    { separator: true } as const,
    copy,
  ]);
  return { now, later };
}

/** Menu rows of actions, a line between groups; a leaving action closes the window when it shows the record. */
export function actionEntries(
  deps: Pick<RecordMenuDeps, 'bus' | 'windows'>,
  kind: string,
  id: string,
  actions: readonly RecordAction[],
): MenuEntry[] {
  const entries: MenuEntry[] = [];
  let group: string | undefined = '\0';
  for (const action of actions) {
    if (action.group !== group) entries.push({ separator: true });
    group = action.group;
    const entry: MenuAction = {
      label: actionLabel(action),
      command: action.command,
      run: async () => {
        const ok = await action.run();
        const shown = deps.windows.current?.kind === kind && deps.windows.current.id === id;
        if (action.leaves && ok !== false && shown) deps.bus.publish(WINDOW_CLOSE);
      },
      ...(action.icon ? { icon: action.icon } : {}),
      ...(action.danger ? { danger: true } : {}),
    };
    entries.push(entry);
  }
  return entries;
}
