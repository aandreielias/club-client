import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../lib/bus';
import { PendingDeletes } from '../../lib/state/PendingDeletes.svelte';
import { FolderActions, type FolderActionsDeps } from './FolderActions.svelte';
import type { Folder, StoredFile } from './model';

const file = (id: string, mine: boolean) => ({ id, name: `${id}.pdf`, mine }) as unknown as StoredFile & { mine: boolean };

function setup() {
  const bus = new EventBus();
  const files = [file('a', true), file('b', false), file('c', true)];
  const deletes = new PendingDeletes(bus, 5000);
  const schedule = vi.spyOn(deletes, 'schedule');
  const actions = new FolderActions({
    bus,
    deletes,
    contents: { files: { value: files } },
    folder: () => ({ id: 'f' }) as Folder,
    policy: { canModify: (f: StoredFile & { mine: boolean }) => f.mine },
    reload: () => {},
  } as unknown as FolderActionsDeps);
  return { actions, files, schedule };
}

describe('FolderActions', () => {
  it('drags the whole selection when a selected file is dragged', () => {
    const { actions } = setup();
    actions.toggle('a');
    actions.toggle('c');
    expect(actions.dragged('a')).toEqual(['a', 'c']);
    expect(actions.dragged('b')).toEqual(['b']);
    actions.toggle('a');
    expect(actions.dragged('c')).toEqual(['c']);
  });

  it('deletes only what the member may modify, in one undoable step', () => {
    const { actions, files, schedule } = setup();
    files.forEach((f) => actions.toggle(f.id));
    actions.remove(files);
    expect(schedule).toHaveBeenCalledOnce();
    expect(schedule.mock.calls[0][0].ids).toEqual(['a', 'c']);
    expect([...actions.selected]).toEqual(['b']);
  });
});
