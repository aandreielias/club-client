import type { ColorScheme, Palette, Settings } from '../../settings';
import type { LocalStore } from '../storage/LocalStore';
import type { Brand, BrandAssets } from '../types';
import { mix, readableOn, textOn } from './contrast';
import { BRAND_FONTS } from './fonts';

/** Runtime changes on top of the settings and the club brand (from the user's appearance preferences). */
export interface ThemeOverrides {
  scheme?: ColorScheme;
  fontSize?: string;
  controlHeight?: string;
  /** Turns transitions and the window animation off. */
  reduceMotion?: boolean;
}

const BRAND_KEY = 'brand';

/**
 * Turns the theme section of the settings into CSS custom properties, so stylesheets never carry
 * literal values. Three layers: the settings, the club brand on top, the member's overrides last.
 * Also flags the compact layout on <html>, because media queries cannot read custom properties.
 */
export class ThemeService {
  static readonly STYLE_ID = 'theme-tokens';

  #layoutTracked = false;
  #overrides: ThemeOverrides = {};
  #brand: Brand | null;

  constructor(
    private readonly theme: Settings['theme'],
    private readonly compactBelowPx: number,
    private readonly store: LocalStore | null = null,
  ) {
    // The last brand seen, so the next start does not flash in the default look before the club loads.
    const cached = store?.get<Brand>(BRAND_KEY);
    this.#brand = cached && cached.headingFont in BRAND_FONTS && cached.textFont in BRAND_FONTS ? cached : null;
  }

  /** The club's brand and images (from the club facts); remembered for the next start. */
  setBrand(brand: Brand, assets: BrandAssets, doc: Document = document): void {
    this.#brand = brand;
    this.store?.set(BRAND_KEY, brand);
    this.apply(this.#overrides, doc);
    ThemeService.head(doc, 'link[rel="icon"]', 'link', { rel: 'icon' }).setAttribute('href', assets.favicon ?? assets.logo ?? 'data:,');
  }

  /** (Re)writes the token stylesheet; call again whenever the overrides change. */
  apply(overrides: ThemeOverrides = {}, doc: Document = document): void {
    this.#overrides = overrides;
    let style = doc.getElementById(ThemeService.STYLE_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = ThemeService.STYLE_ID;
      doc.head.prepend(style);
    }
    style.textContent = this.css(overrides);
    // Read by styles.css and lib/motion to switch animations off.
    if (overrides.reduceMotion) doc.documentElement.dataset.motion = 'reduced';
    else delete doc.documentElement.dataset.motion;
    const scheme = overrides.scheme ?? this.theme.scheme;
    // Native controls (date pickers, scrollbars) follow this before the stylesheet applies.
    doc.querySelector('meta[name="color-scheme"]')?.setAttribute('content', scheme === 'system' ? 'light dark' : scheme);
    const brand = this.#brand;
    if (brand) {
      for (const font of new Set([brand.headingFont, brand.textFont])) void BRAND_FONTS[font].load?.();
      ThemeService.head(doc, 'meta[name="theme-color"]', 'meta', { name: 'theme-color' }).setAttribute('content', brand.primary);
    }
    if (!this.#layoutTracked) {
      this.#layoutTracked = true;
      this.trackLayout(doc);
    }
  }

  /**
   * `--font-size-base: 15px` etc. for every token group and `--color-*` for the palette. With
   * scheme 'system' the dark palette applies when the device prefers it; `data-theme` on <html>
   * can still force either palette.
   */
  css(overrides: ThemeOverrides = {}): string {
    const { colors, scheme, ...groups } = ThemeService.merge(this.#brand ? ThemeService.branded(this.theme, this.#brand) : this.theme, overrides);
    const tokens = Object.entries(groups).flatMap(([group, values]) =>
      Object.entries(values).map(([name, value]) => `--${ThemeService.kebab(group)}-${ThemeService.kebab(name)}: ${value};`),
    );
    const light = `${ThemeService.palette(colors.light)} color-scheme: light;`;
    const dark = `${ThemeService.palette(colors.dark)} color-scheme: dark;`;
    const rules = [`:root { ${tokens.join(' ')} ${scheme === 'dark' ? dark : light} }`];
    if (scheme === 'system') {
      rules.push(`@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${dark} } }`);
    }
    rules.push(`:root[data-theme='light'] { ${light} }`, `:root[data-theme='dark'] { ${dark} }`);
    return rules.join('\n');
  }

  private static merge(theme: Settings['theme'], o: ThemeOverrides): Settings['theme'] {
    const motion = o.reduceMotion ? { ...theme.motion, fast: '0ms', base: '0ms', slow: '0ms', window: '0ms' } : theme.motion;
    return {
      ...theme,
      scheme: o.scheme ?? theme.scheme,
      font: { ...theme.font, ...(o.fontSize ? { sizeBase: o.fontSize } : {}) },
      control: { ...theme.control, ...(o.controlHeight ? { height: o.controlHeight } : {}) },
      motion,
    } as Settings['theme'];
  }

  /**
   * The brand on top of the settings. Light mode takes its colours as they are; dark mode keeps the neutral surfaces and
   * lightens the brand colours until they read on the dark background.
   */
  static branded(theme: Settings['theme'], brand: Brand): Settings['theme'] {
    const { light, dark } = theme.colors;
    const darkAccent = readableOn(brand.primary, dark.background);
    const heading = BRAND_FONTS[brand.headingFont];
    const px = (n: number) => `${n}px`;
    const [small, large] = [brand.radiusSmall, brand.radiusLarge];
    return {
      ...theme,
      colors: {
        light: {
          ...light,
          accent: brand.primary,
          accentHover: brand.primaryHover,
          highlight: brand.accent,
          onAccent: textOn(brand.primary, brand.text),
          text: brand.text,
          textMuted: brand.textMuted,
          surface: brand.tint,
          border: brand.line,
        },
        dark: {
          ...dark,
          accent: darkAccent,
          accentHover: mix(darkAccent, '#ffffff', 0.12),
          // graphical marks need 3:1, not the 4.5:1 of text
          highlight: readableOn(brand.accent, dark.background, 3),
          onAccent: textOn(darkAccent, brand.text),
        },
      },
      font: {
        ...theme.font,
        family: BRAND_FONTS[brand.textFont].stack,
        display: heading.stack,
        displayWeight: heading.headingWeight,
        displayTransform: brand.headingCaps ? 'uppercase' : 'none',
        displayTracking: brand.headingCaps ? '0.02em' : theme.font.displayTracking,
      },
      radius: { ...theme.radius, sm: px(small), md: px(Math.round(small + (large - small) / 3)), lg: px(large), xl: px(Math.round(large * 1.4)) },
    } as Settings['theme'];
  }

  /** The element in <head> matching `selector`, created when missing. */
  private static head(doc: Document, selector: string, tag: string, attributes: Record<string, string>): Element {
    let element = doc.head.querySelector(selector);
    if (!element) {
      element = doc.createElement(tag);
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
      doc.head.append(element);
    }
    return element;
  }

  private trackLayout(doc: Document): void {
    const query = doc.defaultView?.matchMedia(`(max-width: ${this.compactBelowPx - 0.02}px)`);
    if (!query) return;
    const update = () => {
      doc.documentElement.dataset.layout = query.matches ? 'compact' : 'wide';
    };
    update();
    query.addEventListener('change', update);
  }

  private static palette(palette: Palette): string {
    return Object.entries(palette)
      .map(([name, value]) => `--color-${ThemeService.kebab(name)}: ${value};`)
      .join(' ');
  }

  private static kebab(name: string): string {
    return name.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);
  }
}
