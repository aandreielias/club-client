import { describe, expect, it } from 'vitest';
import { ConfirmService } from './ConfirmService.svelte';

describe('ConfirmService', () => {
  const request = { title: 'Löschen', message: 'Sicher?', confirmLabel: 'Löschen' };

  it('resolves with the answer and closes', async () => {
    const service = new ConfirmService();
    const answer = service.ask(request);
    expect(service.current).toEqual(request);
    service.answer(true);
    expect(await answer).toBe(true);
    expect(service.current).toBeNull();
  });

  it('cancels an open request when a new one arrives', async () => {
    const service = new ConfirmService();
    const first = service.ask(request);
    const second = service.ask({ ...request, title: 'Zweite' });
    expect(await first).toBe(false);
    service.answer(true);
    expect(await second).toBe(true);
  });
});
