import { describe, expect, it } from 'vitest';
import { CarLayout } from './CarLayout';

const { SEAT, GAP, SIDE } = CarLayout;
const RIGHT = SIDE;
const MIDDLE = SIDE + SEAT + GAP;
const LEFT = SIDE + 2 * (SEAT + GAP);

describe('CarLayout', () => {
  it('drives to the left: wider than tall, driver front left', () => {
    const car = CarLayout.shape(2);
    expect(car.width).toBeGreaterThan(car.height);
    expect(car.seats[0]).toMatchObject({ driver: true, y: LEFT });
    expect(car.seats[0].x).toBe(Math.min(...car.seats.map((s) => s.x)));
  });

  it('fills driver, front passenger, back right, back left, middle last', () => {
    const offered = (n: number) => CarLayout.shape(n).seats.filter((s) => s.offered);
    // 3 places: driver, passenger, back right
    expect(offered(2).map((s) => s.y)).toEqual([LEFT, RIGHT, RIGHT]);
    // 4 places: back left and right, the middle stays free
    expect(offered(3).map((s) => s.y)).toEqual([LEFT, RIGHT, RIGHT, LEFT]);
    expect(CarLayout.shape(3).seats.find((s) => s.y === MIDDLE)?.offered).toBe(false);
    expect(offered(4).at(-1)!.y).toBe(MIDDLE);
  });

  it('adds a third row for 6 and 7 places and three front seats from 8', () => {
    expect(CarLayout.rows(5)).toEqual([2, 3]);
    expect(CarLayout.rows(7)).toEqual([2, 3, 3]);
    expect(CarLayout.rows(8)).toEqual([3, 3, 3]);
    const big = CarLayout.shape(8);
    expect(big.seats).toHaveLength(9);
    expect(big.seats.filter((s) => s.x === big.seats[0].x)).toHaveLength(3);
    // middles last
    expect(big.seats.slice(-3).every((s) => s.y === MIDDLE)).toBe(true);
    const spots = big.seats.map((s) => `${s.x}/${s.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });
});
