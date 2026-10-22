import { describe, expect, it } from 'vitest';
import { SafeTriangle } from './SafeTriangle';

describe('SafeTriangle', () => {
  // Left the row at (100, 50); the submenu spans x 200–350, y 40–240.
  const aim = new SafeTriangle({ x: 100, y: 50 }, { left: 200, right: 350, top: 40, bottom: 240 });

  it('keeps a diagonal path down to the last submenu entry', () => {
    expect(aim.contains({ x: 150, y: 140 })).toBe(true);
    expect(aim.contains({ x: 195, y: 230 })).toBe(true);
  });

  it('lets go when the pointer goes elsewhere', () => {
    expect(aim.contains({ x: 100, y: 120 })).toBe(false); // straight down the sidebar
    expect(aim.contains({ x: 60, y: 50 })).toBe(false); // back to the left
  });
});
