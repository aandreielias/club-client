import { describe, expect, it, vi } from 'vitest';
import { CONFIRM } from '../../channels';
import { EventBus } from '../bus';
import { removeRecord } from './removeRecord';

describe('removeRecord', () => {
  it('deletes an unused type and archives a used one, only after asking', async () => {
    const bus = new EventBus();
    let answer = true;
    bus.handleRequest(CONFIRM, () => answer);
    const ops = () => ({ delete: vi.fn(async () => {}), archive: vi.fn(async () => {}), reload: vi.fn(async () => {}) });

    const unused = ops();
    expect(await removeRecord(bus, { label: 'Klausur', inUse: false }, 'Sitzungsart', unused)).toBe(true);
    expect(unused.delete).toHaveBeenCalled();
    expect(unused.archive).not.toHaveBeenCalled();

    const used = ops();
    expect(await removeRecord(bus, { label: 'Training', inUse: true }, 'Terminart', used)).toBe(true);
    expect(used.archive).toHaveBeenCalledWith(true);
    expect(used.delete).not.toHaveBeenCalled();

    answer = false;
    const kept = ops();
    expect(await removeRecord(bus, { label: 'X', inUse: false }, 'Mitgliedsart', kept)).toBe(false);
    expect(kept.delete).not.toHaveBeenCalled();
  });
});
