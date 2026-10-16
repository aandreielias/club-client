import { describe, expect, it } from 'vitest';
import { EventBusBuilder } from '../bus';
import { CONFIRM, ConfirmService } from './ConfirmService.svelte';

const bus = () => EventBusBuilder.create().build();

describe('ConfirmService', () => {
  const request = { title: 'Löschen', message: 'Sicher?', confirmLabel: 'Löschen' };

  it('resolves with the answer and closes', async () => {
    const service = new ConfirmService(bus());
    const answer = service.ask(request);
    expect(service.current).toEqual(request);
    service.answer(true);
    expect(await answer).toBe(true);
    expect(service.current).toBeNull();
  });

  it('cancels an open request when a new one arrives', async () => {
    const service = new ConfirmService(bus());
    const first = service.ask(request);
    const second = service.ask({ ...request, title: 'Zweite' });
    expect(await first).toBe(false);
    service.answer(true);
    expect(await second).toBe(true);
  });

  it('answers CONFIRM requests on the bus without a timeout', async () => {
    const events = bus();
    const service = new ConfirmService(events);
    const answer = events.request(CONFIRM, request);
    await Promise.resolve();
    expect(service.current).toEqual(request);
    service.answer(false);
    expect(await answer).toBe(false);
  });
});
