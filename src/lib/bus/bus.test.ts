import { describe, expect, it, vi } from 'vitest';
import { defineEvent, defineRequest, EventBus } from './index';

const SAVED = defineEvent<string>('ui/saved');
const ASK = defineRequest<string, boolean>('ui/ask');

describe('EventBus', () => {
  it('delivers to exact subscribers until they unsubscribe, isolating failures', () => {
    const bus = new EventBus();
    const seen: string[] = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    bus.subscribe(SAVED, () => {
      throw new Error('broken handler');
    });
    const sub = bus.subscribe(SAVED, (text) => seen.push(text));
    bus.subscribe(defineEvent<string>('ui'), (text) => seen.push(`parent ${text}`));
    bus.publish(SAVED, 'a');
    sub.unsubscribe();
    bus.publish(SAVED, 'b');
    expect(seen).toEqual(['a']);
    expect(bus.subscribers(SAVED)).toBe(1);
  });

  it('answers requests through the one responder and rejects without one', async () => {
    const bus = new EventBus();
    await expect(bus.request(ASK, 'x')).rejects.toThrow('No responder');
    const responder = bus.handleRequest(ASK, async (q) => q === 'yes');
    expect(await bus.request(ASK, 'yes')).toBe(true);
    responder.unsubscribe();
    await expect(bus.request(ASK, 'yes')).rejects.toThrow();
  });
});
