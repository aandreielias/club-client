import { describe, expect, it } from 'vitest';
import { RecordDrag } from './RecordDrag';

/** Minimal DataTransfer (jsdom has none). */
function transfer(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => void data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    effectAllowed: 'uninitialized',
  };
}
const event = (dataTransfer: ReturnType<typeof transfer>) => ({ dataTransfer }) as unknown as DragEvent;

describe('RecordDrag', () => {
  it('carries a record and its kind', () => {
    const e = event(transfer());
    RecordDrag.set(e, { kind: 'member', id: 'm1', title: 'Clara Trainer' });
    expect(RecordDrag.carries(e)).toBe(true);
    expect(RecordDrag.carries(e, ['item', 'member'])).toBe(true);
    expect(RecordDrag.carries(e, ['item'])).toBe(false);
    expect(RecordDrag.get(e)).toEqual({ kind: 'member', id: 'm1', title: 'Clara Trainer' });
    expect(e.dataTransfer!.effectAllowed).toBe('copy');
  });

  it('allows moving too when the row already carries its own payload', () => {
    const e = event(transfer({ 'application/x-club-files': 'f1' }));
    RecordDrag.set(e, { kind: 'file', id: 'd1:f1', title: 'Plan.pdf' });
    expect(e.dataTransfer!.effectAllowed).toBe('copyMove');
  });

  it('ignores foreign and malformed data', () => {
    expect(RecordDrag.get(event(transfer({ 'text/plain': 'x' })))).toBeNull();
    expect(RecordDrag.get(event(transfer({ [RecordDrag.TYPE]: '{oops' })))).toBeNull();
    expect(RecordDrag.get(event(transfer({ [RecordDrag.TYPE]: '{"kind":"team","id":""}' })))).toBeNull();
  });
});
