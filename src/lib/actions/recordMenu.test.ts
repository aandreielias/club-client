import { describe, expect, it, vi } from 'vitest';
import { isSeparator, type MenuAction } from '../overlay/ContextMenuService.svelte';
import { actionEntries } from './recordMenu';
import type { RecordAction } from './RecordActions';

describe('actionEntries', () => {
  const windows = (shown: string | null) => ({ current: shown ? { kind: 'task', id: shown } : null }) as never;

  it('labels from the catalog unless overridden and separates groups', () => {
    const actions: RecordAction[] = [
      { command: 'task.done', label: 'Als erledigt markieren', run: () => true },
      { command: 'record.edit', group: 'edit', run: () => true },
      { command: 'record.delete', group: 'edit', run: () => true },
    ];
    const entries = actionEntries({ bus: { publish: vi.fn() } as never, windows: windows(null) }, 'task', 't1', actions);
    expect(entries.map((e) => (isSeparator(e) ? '-' : e.label))).toEqual(['-', 'Als erledigt markieren', '-', 'Bearbeiten', 'Löschen']);
  });

  it('closes the window showing the record after a leaving action went through', async () => {
    const publish = vi.fn();
    const remove: RecordAction = { command: 'record.delete', leaves: true, run: () => undefined };
    const declined: RecordAction = { command: 'record.delete', leaves: true, run: () => false };
    const [, shown] = actionEntries({ bus: { publish } as never, windows: windows('t1') }, 'task', 't1', [remove]) as MenuAction[];
    await shown.run();
    expect(publish).toHaveBeenCalledTimes(1);
    const [, no] = actionEntries({ bus: { publish } as never, windows: windows('t1') }, 'task', 't1', [declined]) as MenuAction[];
    await no.run();
    const [, elsewhere] = actionEntries({ bus: { publish } as never, windows: windows('t2') }, 'task', 't1', [remove]) as MenuAction[];
    await elsewhere.run();
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
