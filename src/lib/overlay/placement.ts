export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** A context menu at the pointer, flipped left/up when it would leave the viewport. */
export function menuPosition(at: Point, menu: Size, viewport: Size, gap: number): Point {
  const x = at.x + menu.width + gap > viewport.width ? Math.max(gap, at.x - menu.width) : at.x;
  const y = at.y + menu.height + gap > viewport.height ? Math.max(gap, at.y - menu.height) : at.y;
  return { x, y };
}

/** A tooltip centred below its anchor, above when there is no room; kept inside the viewport. */
export function tooltipPosition(anchor: DOMRectReadOnly, tip: Size, viewport: Size, gap: number): Point {
  const below = anchor.bottom + gap + tip.height + gap <= viewport.height;
  const y = below ? anchor.bottom + gap : Math.max(gap, anchor.top - gap - tip.height);
  const centred = anchor.left + anchor.width / 2 - tip.width / 2;
  const x = Math.min(Math.max(gap, centred), viewport.width - tip.width - gap);
  return { x, y };
}

/**
 * A dropdown list below its anchor, above when there is no room below (and room above);
 * `x` keeps a list of `minWidth` inside the viewport.
 */
export function dropdownPosition(anchor: DOMRectReadOnly, listHeight: number, minWidth: number, viewport: Size, gap: number): Point {
  const below = viewport.height - anchor.bottom >= listHeight + 2 * gap || anchor.top < listHeight + 2 * gap;
  return {
    x: Math.min(anchor.left, viewport.width - Math.max(anchor.width, minWidth) - 2 * gap),
    y: below ? anchor.bottom + gap : anchor.top - listHeight - gap,
  };
}
