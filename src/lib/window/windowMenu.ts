import type { EventBus } from '../bus';
import type { IconName } from '../../icons';
import type { MenuEntry } from '../overlay/ContextMenuService.svelte';
import type { Router } from '../router/Router.svelte';
import { WINDOW_OPEN, type Dock, type WindowService } from './WindowService.svelte';
import { NAVIGATE } from '../router/Router.svelte';
import { TOAST } from '../notify/ToastService.svelte';
import { APP_ERROR } from '../errors/ErrorReporter';

/**
 * The shared context-menu entries for anything that opens in the window (list rows, calendar
 * entries): open in a given placement, as a page, or copy a link to it.
 */
const DOCK_LABELS: readonly [Dock, string, IconName][] = [
  ['center', 'In der Mitte öffnen', 'dockCenter'],
  ['side', 'An der Seite öffnen', 'dockSide'],
  ['bottom', 'Unten öffnen', 'dockBottom'],
];

export function windowMenu(bus: EventBus, windows: WindowService, router: Router, kind: string, id: string): MenuEntry[] {
  const page = windows.content(kind)?.page?.(id);
  const openDocked = (dock: Dock) => () => bus.publish(WINDOW_OPEN, { kind, id, dock });
  const link = page ?? router.withQuery({ open: `${kind}/${encodeURIComponent(id)}` });
  return [
    { label: 'Öffnen', icon: 'dockCenter', run: () => bus.publish(WINDOW_OPEN, { kind, id }) },
    // "Öffnen" already uses the current placement; offer the other two.
    ...DOCK_LABELS.filter(([dock]) => dock !== windows.dock).map(([dock, label, icon]) => ({ label, icon, run: openDocked(dock) })),
    ...(page ? [{ label: 'Als Seite öffnen', icon: 'page' as const, run: () => bus.publish(NAVIGATE, { path: page }) }] : []),
    { separator: true },
    {
      label: 'Link kopieren',
      icon: 'copy',
      run: () =>
        void navigator.clipboard
          ?.writeText(`${location.origin}${location.pathname}#${link}`)
          .then(() => bus.publish(TOAST, { text: 'Link kopiert.' }), (error) => bus.publish(APP_ERROR, error)),
    },
  ];
}
