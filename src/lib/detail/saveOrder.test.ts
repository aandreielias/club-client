import { describe, expect, it } from 'vitest';
import { saveOrder } from './saveOrder';

describe('saveOrder', () => {
  it('numbers the new order in tens and writes only what changed', async () => {
    const records = [
      { key: 'a', sort: 10 },
      { key: 'b', sort: 20 },
      { key: 'c', sort: 30 },
    ];
    const written: string[] = [];
    await saveOrder(['a', 'c', 'b'], records, async (r, sort) => void written.push(`${r.key}=${sort}`));
    expect(written).toEqual(['c=20', 'b=30']);
  });
});
