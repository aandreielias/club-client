/** One seat of the car drawing, in viewBox units. */
export interface SeatSpot {
  x: number;
  y: number;
  driver: boolean;
  /** Part of the ride (driver and offered seats); the others are drawn faint. */
  offered: boolean;
}

export interface CarShape {
  width: number;
  height: number;
  /** In filling order: driver, then the outer seats front to back (right before left), then the middle seats. */
  seats: SeatSpot[];
}

/**
 * Seat plan of a car seen from above, driving to the left (front on the left). Rows are columns here; the car's
 * right side is at the top, the driver sits front left (bottom). Up to 5 places: 2 in front, 3 behind; up to 7
 * a third row; 8 or more places have 3 in front. Middle seats are taken last.
 */
export class CarLayout {
  static readonly SEAT = 12;
  static readonly GAP = 4;
  static readonly ROW_GAP = 6;
  static readonly SIDE = 6;
  /** Bonnet and windscreen on the left, boot on the right. */
  static readonly FRONT = 30;
  static readonly BACK = 16;
  static readonly HEIGHT = CarLayout.SIDE * 2 + CarLayout.SEAT * 3 + CarLayout.GAP * 2;

  /** Rows (front to back) and their size for `places` = driver plus offered seats. */
  static rows(places: number): number[] {
    if (places <= 5) return [2, 3];
    if (places <= 7) return [2, 3, 3];
    return [3, 3, 3];
  }

  static shape(offered: number): CarShape {
    const { SEAT, GAP, ROW_GAP, SIDE, FRONT, BACK, HEIGHT } = CarLayout;
    const places = offered + 1;
    const rows = CarLayout.rows(places);
    const x = (row: number) => FRONT + row * (SEAT + ROW_GAP);
    const y = { right: SIDE, middle: SIDE + SEAT + GAP, left: SIDE + 2 * (SEAT + GAP) };
    // Filling order: driver, the outer seats row by row (right, then left), the middle seats last.
    const order: { x: number; y: number; driver: boolean }[] = [{ x: x(0), y: y.left, driver: true }];
    rows.forEach((_, row) => {
      order.push({ x: x(row), y: y.right, driver: false });
      if (row > 0) order.push({ x: x(row), y: y.left, driver: false });
    });
    rows.forEach((size, row) => size === 3 && order.push({ x: x(row), y: y.middle, driver: false }));
    return {
      width: x(rows.length) - ROW_GAP + BACK,
      height: HEIGHT,
      seats: order.map((seat, i) => ({ ...seat, offered: i < places })),
    };
  }
}
