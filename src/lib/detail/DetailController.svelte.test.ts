import { describe, expect, it, vi } from 'vitest';
import { EventBusBuilder } from '../bus';
import { APP_ERROR } from '../errors/ErrorReporter';
import { CONFIRM } from '../notify/ConfirmService.svelte';
import { TOAST } from '../notify/ToastService.svelte';
import { Action } from '../state/Action.svelte';
import { DetailController, EditSession } from './DetailController.svelte';

function setup(answer: boolean) {
  const bus = EventBusBuilder.create().build();
  const toasts: string[] = [];
  const errors: unknown[] = [];
  bus.subscribe(TOAST, ({ text }) => toasts.push(text));
  bus.subscribe(APP_ERROR, (error) => errors.push(error));
  bus.handleRequest(CONFIRM, () => answer);
  const close = vi.fn();
  const view = new DetailController(bus, { close, setTitle: vi.fn(), open: vi.fn(), navigate: vi.fn() });
  return { bus, toasts, errors, view, close };
}

const request = { title: 'Löschen', message: 'Sicher?', confirmLabel: 'Löschen' };

describe('DetailController', () => {
  it('runs the write only after confirmation and toasts on success', async () => {
    const yes = setup(true);
    const write = vi.fn(async () => true);
    expect(await yes.view.confirm(request, write, 'Gelöscht.')).toBe(true);
    expect(yes.toasts).toEqual(['Gelöscht.']);

    const no = setup(false);
    const skipped = vi.fn(async () => true);
    expect(await no.view.confirm(request, skipped, 'Gelöscht.')).toBe(false);
    expect(skipped).not.toHaveBeenCalled();
    expect(no.toasts).toEqual([]);
  });

  it('reports the action error of a failed write', async () => {
    const { view, errors } = setup(true);
    const action = new Action();
    const failure = new Error('nope');
    const ok = await view.attempt(action, () => action.run(() => Promise.reject(failure)));
    expect(ok).toBe(false);
    expect(errors).toEqual([failure]);
  });

  it('leaves through the window handle only once', () => {
    const { view, close } = setup(true);
    view.leave();
    view.leave();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('EditSession', () => {
  it('closes the form and toasts after a successful save, keeps it open on failure', async () => {
    const { bus, toasts } = setup(true);
    const edit = new EditSession<{ name: string }>(bus);
    edit.edit({ name: 'Ball' });
    expect(await edit.submit(() => Promise.reject(new Error('x')), 'Gespeichert.')).toBe(false);
    expect(edit.editing).toBe(true);
    expect(edit.save.error).toBeInstanceOf(Error);
    const write = vi.fn(async () => {});
    expect(await edit.submit(write, 'Gespeichert.')).toBe(true);
    expect(write).toHaveBeenCalledWith({ name: 'Ball' });
    expect(edit.editing).toBe(false);
    expect(toasts).toEqual(['Gespeichert.']);
  });
});
