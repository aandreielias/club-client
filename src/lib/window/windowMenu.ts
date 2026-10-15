import type { MenuEntry } from '../overlay/ContextMenuService.svelte';
import type { Router } from '../router/Router.svelte';
import type { Dock, WindowService } from './WindowService.svelte';

/**
 * The shared context-menu entries for anything that opens in the window (list rows, calendar
 * entries): open in a given placement, as a page, or copy a link to it.
 */
const DOCK_LABELS: readonly [Dock, string][] = [
  ['center', 'In der Mitte öffnen'],
  ['side', 'An der Seite öffnen'],
  ['bottom', 'Unten öffnen'],
];

export function windowMenu(windows: WindowService, router: Router, kind: string, id: string): MenuEntry[] {
  const page = windows.content(kind)?.page?.(id);
  const openDocked = (dock: Dock) => () => {
    windows.setDock(dock);
    windows.open(kind, id);
  };
  const link = page ?? router.withQuery({ open: `${kind}/${encodeURIComponent(id)}` });
  return [
    { label: 'Öffnen', run: () => windows.open(kind, id) },
    // "Öffnen" already uses the current placement; offer the other two.
    ...DOCK_LABELS.filter(([dock]) => dock !== windows.dock).map(([dock, label]) => ({ label, run: openDocked(dock) })),
    ...(page ? [{ label: 'Als Seite öffnen', run: () => router.navigate(page) }] : []),
    { separator: true },
    { label: 'Link kopieren', run: () => void navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${link}`) },
  ];
}
