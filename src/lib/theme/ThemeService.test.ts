import { describe, expect, it } from 'vitest';
import { settings } from '../../settings';
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
