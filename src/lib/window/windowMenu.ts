import type { EventBus } from '../bus';
import type { IconName } from '../../icons';
import type { MenuAction } from '../overlay/ContextMenuService.svelte';
import type { Router } from '../router/Router.svelte';
import { WINDOW_OPEN, type Dock, type WindowService } from './WindowService.svelte';
import { NAVIGATE } from '../router/Router.svelte';
import { LinkClipboard } from './LinkClipboard';
import { SPLIT_OPEN } from '../split/SplitView.svelte';

/**
 * The context-menu entries shared by everything that opens in the window: open in a given placement,
 * as a page, in the split view, or copy a link to it. lib/actions/recordMenu adds the record's actions.
 */
const DOCK_LABELS: readonly [Dock, string, IconName][] = [
  ['center', 'In der Mitte öffnen', 'dockCenter'],
  ['side', 'An der Seite öffnen', 'dockSide'],
  ['bottom', 'Unten öffnen', 'dockBottom'],
];

export function openEntries(bus: EventBus, windows: WindowService, kind: string, id: string): MenuAction[] {
  const page = windows.content(kind)?.page?.(id);
  const openDocked = (dock: Dock) => () => bus.publish(WINDOW_OPEN, { kind, id, dock });
  return [
    { label: 'Öffnen', icon: 'dockCenter', run: () => bus.publish(WINDOW_OPEN, { kind, id }) },
    { label: 'In neuem Fenster öffnen', icon: 'add', run: () => bus.publish(WINDOW_OPEN, { kind, id, newWindow: true }) },
    ...DOCK_LABELS.map(([dock, label, icon]) => ({ label, icon, run: openDocked(dock) })),
    ...(page ? [{ label: 'Als Seite öffnen', icon: 'page' as const, run: () => bus.publish(NAVIGATE, { path: page }) }] : []),
    ...(page ? [{ label: 'In geteilter Ansicht öffnen', icon: 'split' as const, run: () => bus.publish(SPLIT_OPEN, { path: page }) }] : []),
  ];
}

export function copyLinkEntry(bus: EventBus, windows: WindowService, router: Router, kind: string, id: string): MenuAction {
  const link = windows.content(kind)?.page?.(id) ?? router.withQuery({ open: `${kind}/${encodeURIComponent(id)}` });
  return { label: 'Link kopieren', icon: 'copy', command: 'record.copyLink', run: () => void LinkClipboard.copy(bus, link) };
}
