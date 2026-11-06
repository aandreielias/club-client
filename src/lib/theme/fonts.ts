import type { BrandFont } from '../types';

/** CSS stack, weight for headings, and the bundled font files of each font a club may pick. */
export const BRAND_FONTS: Record<BrandFont, { label: string; stack: string; headingWeight: string; load?: () => Promise<unknown> }> = {
  INTER: {
    label: 'Inter',
    stack: "'Inter Variable', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    headingWeight: '600',
  },
  ANTON: { label: 'Anton', stack: "'Anton', 'Arial Narrow', Impact, sans-serif", headingWeight: '400', load: () => import('@fontsource/anton') },
  OSWALD: {
    label: 'Oswald',
    stack: "'Oswald Variable', 'Arial Narrow', sans-serif",
    headingWeight: '600',
    load: () => import('@fontsource-variable/oswald'),
  },
  ROBOTO: {
    label: 'Roboto',
    stack: "'Roboto Variable', Roboto, Arial, sans-serif",
    headingWeight: '600',
    load: () => import('@fontsource-variable/roboto'),
  },
  SOURCE_SERIF: {
    label: 'Source Serif',
    stack: "'Source Serif 4 Variable', Georgia, serif",
    headingWeight: '600',
    load: () => import('@fontsource-variable/source-serif-4'),
  },
  SYSTEM: { label: 'Systemschrift', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", headingWeight: '600' },
};
