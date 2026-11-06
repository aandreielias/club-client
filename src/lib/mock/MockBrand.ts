// server: platform.club.BrandSettings / Brand / SvgCheck. The mock club wears the SDG brand (brand guide 2026).
import type { Brand, BrandAssetKind, BrandAssets, BrandFont } from '../types';
import { MockServer } from './MockServer';
import { MockTable } from './MockTable';
import faviconUrl from './brand/favicon.svg?url';
import logoSecondaryUrl from './brand/sdg-logo-secondary.svg?url';
import logoUrl from './brand/sdg-logo.svg?url';

const fail = MockServer.fail;

/** server: club.yml `club.brand` (the look without a saved brand). */
export const DEFAULT_BRAND: Brand = {
  primary: '#5E6AD2',
  primaryHover: '#5762C1',
  accent: '#5E6AD2',
  text: '#1B1C21',
  textMuted: '#6B6E78',
  tint: '#F5F5F7',
  line: '#E6E6EA',
  headingFont: 'INTER',
  textFont: 'INTER',
  headingCaps: false,
  radiusSmall: 4,
  radiusLarge: 10,
  appName: null,
  mailGreeting: null,
  mailSignOff: null,
  mailFooter: null,
};

/** What the SDG Vorstand saved: colours, Anton in capitals, 4/8 px corners (sdg-markenrichtlinien.pdf). */
export const SDG_BRAND: Brand = {
  primary: '#57263C',
  primaryHover: '#431C2E',
  accent: '#A8862F',
  text: '#1E1A1D',
  textMuted: '#6B5F66',
  tint: '#F5F0F2',
  line: '#E4DDE1',
  headingFont: 'ANTON',
  textFont: 'INTER',
  headingCaps: true,
  radiusSmall: 4,
  radiusLarge: 8,
  appName: 'SDG',
  mailGreeting: null,
  mailSignOff: null,
  mailFooter: null,
};

const FONTS: readonly BrandFont[] = ['INTER', 'ANTON', 'OSWALD', 'ROBOTO', 'SOURCE_SERIF', 'SYSTEM'];
const KINDS: readonly BrandAssetKind[] = ['logo', 'logo-secondary', 'favicon'];
const MAX_ASSET_BYTES = 512 * 1024;
const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** server: SvgCheck - a plain drawing: no DTD, scripts, handlers, embedded documents, animation or outside references. */
export function isSafeSvg(text: string): boolean {
  if (!/^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return false;
  if (/<!(DOCTYPE|ENTITY)/i.test(text)) return false;
  if (/<\s*(script|foreignObject|iframe|embed|object|handler|listener|animate\w*|set|discard)\b/i.test(text)) return false;
  if (/\son\w+\s*=/i.test(text)) return false;
  if (/href\s*=\s*["'](?!#)/i.test(text)) return false;
  if (/url\(\s*["']?(?!#)/i.test(text) || /@import/i.test(text)) return false;
  return true;
}

export class MockBrand {
  /** server: platform_brand; null = club.yml defaults. */
  readonly saved = new MockTable<{ brand: Brand | null }>('brand', () => ({ brand: SDG_BRAND }));
  /** server: platform_brand_asset, here as URLs (data: URLs for uploads). */
  readonly images = new MockTable<BrandAssets>('brand-assets', () => ({ logo: logoUrl, logoSecondary: logoSecondaryUrl, favicon: faviconUrl }));

  brand(): Brand {
    return this.saved.data.brand ?? DEFAULT_BRAND;
  }

  assets(): BrandAssets {
    return { ...this.images.data };
  }

  /** server: Brand.checked - hex colours (upper case), listed fonts, radius ranges, short single-line texts. */
  save(body: Record<string, unknown>): void {
    const color = (key: keyof Brand): string => {
      const value = body[key];
      return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : fail(400, 'brand.invalid');
    };
    const font = (key: keyof Brand): BrandFont => (FONTS.includes(body[key] as BrandFont) ? (body[key] as BrandFont) : fail(400, 'brand.invalid'));
    const radius = (key: keyof Brand, max: number): number => {
      const value = body[key];
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max ? (value as number) : fail(400, 'brand.invalid');
    };
    const text = (key: keyof Brand, max: number, lines = false): string | null => {
      const raw = body[key];
      if (raw == null) return null;
      if (typeof raw !== 'string') return fail(400, 'brand.invalid');
      const value = raw.replace(/\r\n/g, '\n').trim();
      // eslint-disable-next-line no-control-regex
      const control = lines ? /[\u0000-\u0009\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
      if (value.length > max || control.test(value)) return fail(400, 'brand.invalid');
      return value || null;
    };
    this.saved.data.brand = {
      primary: color('primary'),
      primaryHover: color('primaryHover'),
      accent: color('accent'),
      text: color('text'),
      textMuted: color('textMuted'),
      tint: color('tint'),
      line: color('line'),
      headingFont: font('headingFont'),
      textFont: font('textFont'),
      headingCaps: body.headingCaps === true,
      radiusSmall: radius('radiusSmall', 12),
      radiusLarge: radius('radiusLarge', 24),
      appName: text('appName', 30),
      mailGreeting: text('mailGreeting', 100),
      mailSignOff: text('mailSignOff', 200),
      mailFooter: text('mailFooter', 500, true),
    };
    this.saved.save();
  }

  reset(): void {
    this.saved.data.brand = null;
    this.saved.save();
  }

  /** server: BrandSettings.saveAsset - at most 512 KB, virus scan, PNG by its signature or a plain SVG. */
  async saveAsset(kind: string, file: unknown): Promise<void> {
    const key = MockBrand.key(kind);
    if (!(file instanceof Blob)) return fail(400, 'request.invalid');
    if (file.size > MAX_ASSET_BYTES) fail(400, 'brand.asset-too-large');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    if (text.includes(EICAR)) fail(400, 'file.infected');
    const png = PNG.every((b, i) => bytes[i] === b);
    if (!png && !isSafeSvg(text)) fail(400, 'brand.asset-invalid');
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    this.images.data[key] = `data:${png ? 'image/png' : 'image/svg+xml'};base64,${btoa(binary)}`;
    this.images.save();
  }

  deleteAsset(kind: string): void {
    this.images.data[MockBrand.key(kind)] = null;
    this.images.save();
  }

  private static key(kind: string): keyof BrandAssets {
    if (!KINDS.includes(kind as BrandAssetKind)) return fail(404, 'brand.asset-not-found');
    return kind === 'logo-secondary' ? 'logoSecondary' : (kind as 'logo' | 'favicon');
  }
}
