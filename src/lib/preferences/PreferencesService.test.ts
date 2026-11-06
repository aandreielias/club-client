import { describe, expect, it, vi } from 'vitest';
import { settings } from '../../settings';
import { ThemeService } from '../theme/ThemeService';
import { PreferencesService } from './PreferencesService.svelte';

describe('PreferencesService', () => {
  it('starts with defaults, stores changes and reports them', () => {
    const onChange = vi.fn();
    const prefs = new PreferencesService(settings.appearance, { scheme: 'light', calendarView: 'month', filesView: 'gallery' }, null, onChange);
    expect(prefs.values).toMatchObject({ scheme: 'light', fontSize: 'normal', density: 'normal', reduceMotion: false });
    prefs.set('fontSize', 'large');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 'large' }));
    expect(prefs.themeOverrides()).toMatchObject({ fontSize: settings.appearance.fontSizes.large.size });
  });

  it('falls back for unknown stored values and toggles the scheme', () => {
    const store = { get: () => ({ accent: 'green', fontSize: 'huge', scheme: 'system', calendarView: 'year' }), set: vi.fn() };
    const prefs = new PreferencesService(settings.appearance, { scheme: 'light', calendarView: 'month', filesView: 'gallery' }, store as never);
    expect(prefs.values.fontSize).toBe('normal');
    expect(prefs.values).not.toHaveProperty('accent'); // the personal accent gave way to the club brand
    expect(prefs.values.calendarView).toBe('month');
    prefs.toggleScheme(true); // system currently dark → light
    expect(prefs.values.scheme).toBe('light');
    prefs.toggleScheme(false);
    expect(prefs.values.scheme).toBe('dark');
  });
});

describe('ThemeService overrides', () => {
  const theme = new ThemeService(settings.theme, settings.compactBelowPx);

  it('applies scheme, size, density and reduced motion', () => {
    const css = theme.css({ scheme: 'dark', fontSize: '16px', controlHeight: '36px', reduceMotion: true });
    const root = css.split('\n')[0];
    expect(root).toContain(`--color-background: ${settings.theme.colors.dark.background};`);
    expect(root).toContain('--font-size-base: 16px;');
    expect(root).toContain('--control-height: 36px;');
    expect(root).toContain('--motion-window: 0ms;');
  });
});
