import { describe, expect, it } from 'vitest';
import { projected } from './windowDrag';

describe('projected', () => {
  const view = { width: 1000, height: 800 };
  const box = { left: 300, top: 200, width: 400, height: 300 };

  it('leads the box by the velocity', () => {
    expect(projected(box, { x: 1, y: -0.5 }, 150, view)).toEqual({ ...box, left: 450, top: 125 });
  });

  it('stays on the screen', () => {
    expect(projected(box, { x: 10, y: -10 }, 150, view)).toEqual({ ...box, left: 600, top: 0 });
  });

  it('keeps a box at rest where it is', () => {
    expect(projected(box, { x: 0, y: 0 }, 150, view)).toEqual(box);
  });
});
