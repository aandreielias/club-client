import { describe, expect, it, vi } from 'vitest';
import { isSeparator, type MenuAction } from '../overlay/ContextMenuService.svelte';
import { actionEntries } from './recordMenu';
import type { RecordAction } from './RecordActions';

describe('actionEntries', () => {
  const windows = (closeShowing = vi.fn()) => ({ closeShowing }) as never;

  it('labels from the catalog unless overridden and separates groups', () => {
    const actions: RecordAction[] = [
      { command: 'task.done', label: 'Als erledigt markieren', run: () => true },
      { command: 'record.edit', group: 'edit', run: () => true },
      { command: 'record.delete', group: 'edit', run: () => true },
    ];
    const entries = actionEntries({ bus: { publish: vi.fn() } as never, windows: windows() }, 'task', 't1', actions);
    expect(entries.map((e) => (isSeparator(e) ? '-' : e.label))).toEqual(['-', 'Als erledigt markieren', '-', 'Bearbeiten', 'Löschen']);
  });

  it('closes the window showing the record after a leaving action went through', async () => {
    const closeShowing = vi.fn();
    const deps = { bus: { publish: vi.fn() } as never, windows: windows(closeShowing) };
    const remove: RecordAction = { command: 'record.delete', leaves: true, run: () => undefined };
    const declined: RecordAction = { command: 'record.delete', leaves: true, run: () => false };
    const [, done] = actionEntries(deps, 'task', 't1', [remove]) as MenuAction[];
    await done.run();
    expect(closeShowing).toHaveBeenCalledWith('task', 't1');
    const [, no] = actionEntries(deps, 'task', 't1', [declined]) as MenuAction[];
    await no.run();
    expect(closeShowing).toHaveBeenCalledTimes(1);
  });
});
