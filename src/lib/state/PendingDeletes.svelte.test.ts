import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBusBuilder } from '../bus';
import { TOAST, type ToastRequest } from '../notify/ToastService.svelte';
import { APP_ERROR } from '../errors/ErrorReporter';
import { PendingDeletes } from './PendingDeletes.svelte';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const bus = EventBusBuilder.create().build();
  const toasts: ToastRequest[] = [];
  const errors: unknown[] = [];
  bus.subscribe(TOAST, (t) => toasts.push(t));
  bus.subscribe(APP_ERROR, (e) => errors.push(e));
  return { deletes: new PendingDeletes(bus, 5000), toasts, errors };
}

describe('PendingDeletes', () => {
  it('hides at once and deletes after the undo time', async () => {
    const { deletes, toasts } = setup();
    const commit = vi.fn(async () => {});
    deletes.schedule({ ids: ['a'], text: 'Gelöscht.', commit });
    expect(deletes.isHidden('a')).toBe(true);
    expect(toasts[0].action?.label).toBe('Rückgängig');
    await vi.advanceTimersByTimeAsync(4999);
    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(commit).toHaveBeenCalledOnce();
  });

  it('undo keeps the record; a failed delete shows it again with the error', async () => {
    const { deletes, errors, toasts } = setup();
    const commit = vi.fn(async () => {});
    deletes.schedule({ ids: ['a', 'c'], text: 'x', commit });
    toasts.at(-1)!.action!.run();
    expect(deletes.isHidden('c')).toBe(false);
    await vi.advanceTimersByTimeAsync(6000);
    expect(commit).not.toHaveBeenCalled();
    expect(deletes.isHidden('a')).toBe(false);

    deletes.schedule({ ids: ['b'], text: 'y', commit: () => Promise.reject(new Error('nope')) });
    await vi.advanceTimersByTimeAsync(5000);
    expect(deletes.isHidden('b')).toBe(false);
    expect(errors).toHaveLength(1);
  });
});
