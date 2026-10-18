import { describe, expect, it } from 'vitest';
import { CarLayout } from './CarLayout';

describe('CarLayout', () => {
  it('draws at least a five-seater: driver front left, offered seats first', () => {
    const one = CarLayout.shape(1);
    expect(one.seats).toHaveLength(5);
    expect(one.seats[0]).toMatchObject({ driver: true, offered: false });
    expect(one.seats.filter((s) => s.offered)).toHaveLength(1);
    expect(one.seats[1]).toMatchObject({ offered: true, y: one.seats[0].y });
    expect(one.seats[1].x).toBeGreaterThan(one.seats[0].x);
    expect(one.height).toBeGreaterThan(one.width); // reads as a car from above
  });

  it('grows into a van for more than four seats, without overlaps', () => {
    const eight = CarLayout.shape(8);
    expect(eight.seats).toHaveLength(9);
    expect(eight.seats.filter((s) => s.offered)).toHaveLength(8);
    expect(eight.height).toBeGreaterThan(CarLayout.shape(4).height);
    const spots = eight.seats.map((s) => `${s.x}/${s.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });

  it('keeps a back row of two at the sides', () => {
    const [left, right] = CarLayout.shape(6).seats.slice(-2);
    expect(left.x).toBe(CarLayout.SIDE);
    expect(right.x).toBe(CarLayout.WIDTH - CarLayout.SIDE - CarLayout.SEAT_W);
  });
});
