/** WCAG contrast of #RRGGBB colours, used to keep brand colours readable. */

const WHITE = '#ffffff';

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1 (same) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `share` (0–1) of `other` mixed into `hex`. */
export function mix(hex: string, other: string, share: number): string {
  const a = channels(hex);
  const b = channels(other);
  return `#${a
    .map((c, i) =>
      Math.round(c + (b[i] - c) * share)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Lightens `hex` towards white until it reaches `ratio` on `background` (dark mode: brand colours on a dark page). */
export function readableOn(hex: string, background: string, ratio = 4.5): string {
  for (let share = 0; share <= 1; share += 0.05) {
    const candidate = mix(hex, WHITE, share);
    if (contrast(candidate, background) >= ratio) return candidate;
  }
  return WHITE;
}

/** White or `ink` text on a filled `hex` background, whichever reads better. */
export function textOn(hex: string, ink: string): string {
  return contrast(WHITE, hex) >= contrast(ink, hex) ? WHITE : ink;
}
