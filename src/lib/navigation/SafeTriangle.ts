export interface Point {
  x: number;
  y: number;
}

/**
 * "Menu aim": while the pointer travels from a menu row to its submenu it may cross other rows. As long as it stays in the
 * triangle between where it left the row and the submenu's near edge (top and bottom corner), it is heading for the submenu,
 * so the submenu stays open and the rows it crosses do not take over.
 */
export class SafeTriangle {
  /** Extra room around the submenu's corners, so a slightly sloppy path still counts. */
  static readonly SLACK = 8;

  constructor(
    private readonly apex: Point,
    private readonly target: DOMRect | { left: number; right: number; top: number; bottom: number },
  ) {}

  contains(p: Point): boolean {
    const near = this.apex.x <= this.target.left ? this.target.left : this.target.right;
    const top = { x: near, y: this.target.top - SafeTriangle.SLACK };
    const bottom = { x: near, y: this.target.bottom + SafeTriangle.SLACK };
    return SafeTriangle.inTriangle(p, this.apex, top, bottom);
  }

  static inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
    const side = (p1: Point, p2: Point, p3: Point) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const d1 = side(p, a, b);
    const d2 = side(p, b, c);
    const d3 = side(p, c, a);
    const negative = d1 < 0 || d2 < 0 || d3 < 0;
    const positive = d1 > 0 || d2 > 0 || d3 > 0;
    return !(negative && positive);
  }
}
