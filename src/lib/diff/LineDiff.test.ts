import { describe, expect, it } from 'vitest';
import { LineDiff } from './LineDiff';

describe('LineDiff', () => {
  it('marks changed, added and removed lines', () => {
    const diff = LineDiff.lines(['a', 'b ab 17:00', 'c', 'd'], ['a', 'b ab 17:30', 'c', 'neu', 'd']);
    expect(diff).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b ab 17:00' },
      { kind: 'added', text: 'b ab 17:30' },
      { kind: 'same', text: 'c' },
      { kind: 'added', text: 'neu' },
      { kind: 'same', text: 'd' },
    ]);
  });

  it('folds long unchanged runs but keeps context', () => {
    const before = ['1', '2', '3', '4', '5', '6', 'x'];
    const after = ['1', '2', '3', '4', '5', '6', 'y'];
    expect(LineDiff.fold(LineDiff.lines(before, after), 1)).toEqual([
      { kind: 'folded', count: 5 },
      { kind: 'same', text: '6' },
      { kind: 'removed', text: 'x' },
      { kind: 'added', text: 'y' },
    ]);
  });
});
