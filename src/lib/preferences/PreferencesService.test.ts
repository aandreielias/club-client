import { describe, expect, it, vi } from 'vitest';
import { settings } from '../../settings';
import { ThemeService } from '../theme/ThemeService';
import { PreferencesService } from './PreferencesService.svelte';

describe('PreferencesService', () => {
  it('starts with defaults, stores changes and reports them', () => {
    const onChange = vi.fn();
    const prefs = new PreferencesService(settings.appearance, { scheme: 'light', calendarView: 'month', filesView: 'gallery' }, null, onChange);
    expect(prefs.values).toMatchObject({ scheme: 'light', accent: 'indigo', fontSize: 'normal', density: 'normal', reduceMotion: false });
    prefs.set('accent', 'green');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ accent: 'green' }));
    expect(prefs.themeOverrides()).toMatchObject({ accent: settings.appearance.accents.green.color });
  });

  it('falls back for unknown stored values and toggles the scheme', () => {
    const store = { get: () => ({ accent: 'neon', scheme: 'system', calendarView: 'year' }), set: vi.fn() };
    const prefs = new PreferencesService(settings.appearance, { scheme: 'light', calendarView: 'month', filesView: 'gallery' }, store as never);
    expect(prefs.values.accent).toBe('indigo');
    expect(prefs.values.calendarView).toBe('month');
    prefs.toggleScheme(true); // system currently dark → light
    expect(prefs.values.scheme).toBe('light');
    prefs.toggleScheme(false);
    expect(prefs.values.scheme).toBe('dark');
  });
});

describe('ThemeService overrides', () => {
  const theme = new ThemeService(settings.theme, settings.compactBelowPx);

  it('applies scheme, accent, size, density and reduced motion', () => {
    const css = theme.css({ scheme: 'dark', accent: '#448361', fontSize: '16px', controlHeight: '36px', reduceMotion: true });
    const root = css.split('\n')[0];
    expect(root).toContain(`--color-background: ${settings.theme.colors.dark.background};`);
    expect(root).toContain('--color-accent: #448361;');
    expect(root).toContain('--font-size-base: 16px;');
    expect(root).toContain('--control-height: 36px;');
    expect(root).toContain('--motion-window: 0ms;');
  });
});
