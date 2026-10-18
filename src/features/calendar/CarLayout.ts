/** One seat of the car drawing, in viewBox units. */
export interface SeatSpot {
  x: number;
  y: number;
  driver: boolean;
  /** Part of the ride's offered seats; the others are drawn faint (a 5-seater offering 2 still has 5 seats). */
  offered: boolean;
}

export interface CarShape {
  width: number;
  height: number;
  /** Driver first, then the passenger seats front to back, left to right; offered seats come first. */
  seats: SeatSpot[];
}

/**
 * Seat plan of a car seen from above: the driver and one passenger in front, rows of three behind. Always at
 * least a five-seater so it reads as a car; more than four offered seats make a longer car (a van).
 */
export class CarLayout {
  static readonly SEAT_W = 12;
  static readonly SEAT_H = 13;
  static readonly GAP = 4;
  static readonly ROW_GAP = 6;
  static readonly SIDE = 6;
  /** Bonnet and windscreen in front, boot behind. */
  static readonly FRONT = 30;
  static readonly BACK = 16;
  static readonly WIDTH = CarLayout.SIDE * 2 + CarLayout.SEAT_W * 3 + CarLayout.GAP * 2;
  static readonly MIN_PASSENGERS = 4;

  static shape(offered: number): CarShape {
    const { SEAT_W, SEAT_H, GAP, ROW_GAP, SIDE, FRONT, BACK } = CarLayout;
    const passengers = Math.max(CarLayout.MIN_PASSENGERS, offered);
    const back = passengers - 1;
    const rows = 1 + Math.ceil(back / 3);
    const columnX = (column: number) => SIDE + column * (SEAT_W + GAP);
    const rowY = (row: number) => FRONT + row * (SEAT_H + ROW_GAP);
    // Left-hand drive: the driver sits front left, the front passenger front right.
    const seats: SeatSpot[] = [
      { x: columnX(0), y: rowY(0), driver: true, offered: false },
      { x: columnX(2), y: rowY(0), driver: false, offered: offered >= 1 },
    ];
    for (let i = 0; i < back; i++) {
      const row = 1 + Math.floor(i / 3);
      const inRow = Math.min(3, back - (row - 1) * 3);
      // A row of one or two keeps to the sides, like real back seats.
      const column = inRow === 3 ? i % 3 : inRow === 2 ? (i % 3) * 2 : 1;
      seats.push({ x: columnX(column), y: rowY(row), driver: false, offered: i + 2 <= offered });
    }
    return { width: CarLayout.WIDTH, height: rowY(rows) - ROW_GAP + BACK, seats };
  }
}
