// server: platform.club.BrandSettings / Brand / SvgCheck. The mock club wears the SDG brand (brand guide 2026).
import type { Brand, BrandAssets, BrandFont } from '../types';
import { MockServer } from './MockServer';
import { MockTable } from './MockTable';

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

/** The setting files the files mock registers (server: FilesApi.SETTING_FILE_KEYS over the bus), so lib needs no feature import. */
export const brandFiles = {
  url: (_slot: 'LOGO' | 'LOGO_SECONDARY' | 'FAVICON'): string | null => null,
};

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

  brand(): Brand {
    return this.saved.data.brand ?? DEFAULT_BRAND;
  }

  /** server: BrandSettings.assets — the logo slots of the setting files. */
  assets(): BrandAssets {
    return { logo: brandFiles.url('LOGO'), logoSecondary: brandFiles.url('LOGO_SECONDARY'), favicon: brandFiles.url('FAVICON') };
  }

  save(body: Record<string, unknown>): void {
    this.saved.data.brand = MockBrand.checked(body);
    this.saved.save();
  }

  /** server: Brand.checked - hex colours (upper case), listed fonts, radius ranges, short single-line texts. */
  static checked(body: Record<string, unknown>): Brand {
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
    return {
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
  }

  reset(): void {
    this.saved.data.brand = null;
    this.saved.save();
  }
}

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** server: notifications.domain.MailLayout (HTML part; the mock sends no mail). */
export function mailHtml(brand: Brand, club: { name: string; shortName: string }, firstName: string, logoUrl: string | null, link: string | null) {
  const title = 'Neue Aufgabe: Kuchen für das Turnier';
  const greeting = brand.mailGreeting ? brand.mailGreeting.replaceAll('{vorname}', firstName) : `Hallo ${firstName},`;
  const font = brand.textFont === 'SOURCE_SERIF' ? "Georgia,'Times New Roman',serif" : 'Arial,Helvetica,sans-serif';
  const lines = (text: string) => esc(text).replace(/\n/g, '<br>');
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(brand.primary.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const onPrimary = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? brand.text : '#FFFFFF';
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="margin:0;padding:0;background:${brand.tint};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.tint};"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${brand.line};border-radius:${brand.radiusLarge}px;">` +
    (logoUrl
      ? `<tr><td style="padding:24px 24px 0;"><img src="${esc(logoUrl)}" alt="${esc(club.name)}" height="48" style="display:block;height:48px;width:auto;border:0;"></td></tr>`
      : '') +
    `<tr><td style="padding:24px;font-family:${font};font-size:15px;line-height:1.5;color:${brand.text};">` +
    `<p style="margin:0 0 16px;">${esc(greeting)}</p>` +
    `<h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:${brand.primary}${brand.headingCaps ? ';text-transform:uppercase' : ''};">${esc(title)}</h1>` +
    `<p style="margin:0 0 16px;">So sehen E-Mails des Vereins aus. Fällig: Samstag, 18:00.</p>` +
    (link
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="background:${brand.primary};border-radius:${brand.radiusSmall}px;">` +
        `<a href="${esc(link)}" style="display:inline-block;padding:10px 20px;font-weight:bold;text-decoration:none;color:${onPrimary};">In der App öffnen</a></td></tr></table>`
      : '') +
    `<p style="margin:0;">${esc(brand.mailSignOff ?? 'Viele Grüße')}<br>${esc(club.name)}</p></td></tr>` +
    `<tr><td style="padding:16px 24px;border-top:1px solid ${brand.line};font-family:${font};font-size:12px;line-height:1.5;color:${brand.textMuted};">` +
    (brand.mailFooter ? `${lines(brand.mailFooter)}<br><br>` : '') +
    'Diese Benachrichtigungen kannst du in der App unter Profil → Benachrichtigungen einstellen.</td></tr></table></td></tr></table></body></html>';
  return { subject: `[${club.shortName}] ${title}`, html };
}
