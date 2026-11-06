import { describe, expect, it } from 'vitest';
import { settings } from '../../settings';
import type { Brand } from '../types';
import { contrast } from './contrast';
import { ThemeService } from './ThemeService';

describe('ThemeService', () => {
  const css = new ThemeService(settings.theme, settings.compactBelowPx).css();

  it('emits one custom property per token', () => {
    expect(css).toContain(`--radius-md: ${settings.theme.radius.md};`);
    expect(css).toContain(`--font-size-h1: ${settings.theme.font.sizeH1};`);
    expect(css).toContain(`--layout-sidebar-width: ${settings.theme.layout.sidebarWidth};`);
    expect(css).toContain(`--color-text-muted: ${settings.theme.colors.light.textMuted};`);
  });

  it('uses only the light palette for scheme "light"', () => {
    expect(css).not.toContain('prefers-color-scheme');
    expect(css.indexOf(`--color-background: ${settings.theme.colors.light.background};`)).toBeLessThan(css.indexOf('data-theme'));
  });

  it('follows the device for scheme "system"', () => {
    const system = new ThemeService({ ...settings.theme, scheme: 'system' }, settings.compactBelowPx).css();
    expect(system).toContain('prefers-color-scheme: dark');
    expect(system.split(`--color-background: ${settings.theme.colors.dark.background};`)).toHaveLength(3);
  });

  it('can force the dark palette', () => {
    const dark = new ThemeService({ ...settings.theme, scheme: 'dark' }, settings.compactBelowPx).css();
    expect(dark.startsWith(':root {')).toBe(true);
    expect(dark.split('\n')[0]).toContain(`--color-background: ${settings.theme.colors.dark.background};`);
  });
});

describe('ThemeService brand', () => {
  const sdg: Brand = {
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
  const branded = ThemeService.branded(settings.theme, sdg);

  it('takes the brand colours in light mode and keeps them readable in dark mode', () => {
    expect(branded.colors.light).toMatchObject({
      accent: '#57263C',
      accentHover: '#431C2E',
      highlight: '#A8862F',
      surface: '#F5F0F2',
      onAccent: '#ffffff',
    });
    expect(branded.colors.dark.background).toBe(settings.theme.colors.dark.background);
    expect(contrast(branded.colors.dark.accent, settings.theme.colors.dark.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('sets the heading font, capitals and radii', () => {
    expect(branded.font.display).toContain('Anton');
    expect(branded.font).toMatchObject({ displayTransform: 'uppercase', displayWeight: '400' });
    expect(branded.radius).toMatchObject({ sm: '4px', md: '5px', lg: '8px' });
  });

  it('starts with the brand remembered from the last visit, unless it is unusable', () => {
    const start = (cached: unknown) => new ThemeService(settings.theme, settings.compactBelowPx, { get: () => cached } as never).css();
    expect(start(sdg)).toContain('--color-accent: #57263C;');
    expect(start({ ...sdg, headingFont: 'GONE' })).toContain(`--color-accent: ${settings.theme.colors.light.accent};`);
  });
});
