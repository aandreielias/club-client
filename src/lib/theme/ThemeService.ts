import type { ColorScheme, Palette, Settings } from '../../settings';

/** Runtime changes on top of the settings (from the user's appearance preferences). */
export interface ThemeOverrides {
  scheme?: ColorScheme;
  /** Accent colour for both schemes. */
  accent?: string;
  fontSize?: string;
  controlHeight?: string;
  /** Turns transitions and the window animation off. */
  reduceMotion?: boolean;
}

/**
 * Turns the theme section of the settings into CSS custom properties, so stylesheets never carry
 * literal values. Also flags the compact layout on <html>, because media queries cannot read
 * custom properties.
 */
export class ThemeService {
  static readonly STYLE_ID = 'theme-tokens';

  #layoutTracked = false;

  constructor(
    private readonly theme: Settings['theme'],
    private readonly compactBelowPx: number,
  ) {}

  /** (Re)writes the token stylesheet; call again whenever the overrides change. */
  apply(overrides: ThemeOverrides = {}, doc: Document = document): void {
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
    const { colors, scheme, ...groups } = ThemeService.merge(this.theme, overrides);
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
      colors: {
        light: { ...theme.colors.light, ...(o.accent ? { accent: o.accent } : {}) },
        dark: { ...theme.colors.dark, ...(o.accent ? { accent: o.accent } : {}) },
      },
      font: { ...theme.font, ...(o.fontSize ? { sizeBase: o.fontSize } : {}) },
      control: { ...theme.control, ...(o.controlHeight ? { height: o.controlHeight } : {}) },
      motion,
    } as Settings['theme'];
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
