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

/** Hue (0–360), saturation and lightness (0–1). */
function hsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function toHex([h, s, l]: [number, number, number]): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return `#${[0, 8, 4]
    .map((n) =>
      Math.round(f(n) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/**
 * Raises the lightness of `hex` (hue and saturation kept, so the brand stays recognisable instead of turning grey) until it
 * reaches `ratio` on `background` (dark mode: brand colours on a dark page).
 */
export function readableOn(hex: string, background: string, ratio = 4.5): string {
  if (contrast(hex, background) >= ratio) return hex.toLowerCase();
  const [h, s, l] = hsl(hex);
  for (let light = l; light <= 1; light += 0.02) {
    const candidate = toHex([h, s, light]);
    if (contrast(candidate, background) >= ratio) return candidate;
  }
  return WHITE;
}

/** White or `ink` text on a filled `hex` background, whichever reads better. */
export function textOn(hex: string, ink: string): string {
  return contrast(WHITE, hex) >= contrast(ink, hex) ? WHITE : ink;
}
