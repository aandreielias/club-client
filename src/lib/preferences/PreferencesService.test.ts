import { describe, expect, it, vi } from 'vitest';
import { settings } from '../../settings';
import { ThemeService } from '../theme/ThemeService';
import { PreferencesService } from './PreferencesService.svelte';

const saveDefaults = vi.fn(async (values: string | null) => ({ values: null, clubDefaults: values }));
const DEFAULTS = { scheme: 'light', calendarView: 'month', filesView: 'gallery', weekStartHour: 7, weekEndHour: 23 } as const;

describe('PreferencesService', () => {
  it('starts with defaults, stores changes and reports them', () => {
    const onChange = vi.fn();
    const prefs = new PreferencesService(settings.appearance, DEFAULTS, null, onChange);
    expect(prefs.values).toMatchObject({ scheme: 'light', fontSize: 'normal', density: 'normal', reduceMotion: false });
    prefs.set('fontSize', 'large');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 'large' }));
    expect(prefs.themeOverrides()).toMatchObject({ fontSize: settings.appearance.fontSizes.large.size });
  });

  it('falls back for unknown stored values and toggles the scheme', () => {
    const store = { get: () => ({ accent: 'green', fontSize: 'huge', scheme: 'system', calendarView: 'year' }), set: vi.fn() };
    const prefs = new PreferencesService(settings.appearance, DEFAULTS, store as never);
    expect(prefs.values.fontSize).toBe('normal');
    expect(prefs.values).not.toHaveProperty('accent'); // the personal accent gave way to the club brand
    expect(prefs.values.calendarView).toBe('month');
    prefs.toggleScheme(true); // system currently dark → light
    expect(prefs.values.scheme).toBe('light');
    prefs.toggleScheme(false);
    expect(prefs.values.scheme).toBe('dark');
  });

  it('lays the member over the club over the app, and sends the member’s own choices', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (_values: string | null) => {});
    const prefs = new PreferencesService(settings.appearance, DEFAULTS, null);
    await prefs.connect({
      load: async () => ({ values: '{"scheme":"dark"}', clubDefaults: '{"calendarView":"week","weekStartHour":6,"weekEndHour":9}' }),
      save,
      saveDefaults,
    });
    expect(prefs.values).toMatchObject({ scheme: 'dark', calendarView: 'week', weekStartHour: 7, weekEndHour: 23 }); // 6–9 is too short
    prefs.set('calendarView', 'month');
    prefs.set('filesView', 'table');
    vi.runAllTimers();
    expect(save).toHaveBeenCalledOnce();
    expect(JSON.parse(save.mock.lastCall![0]!)).toEqual({ scheme: 'dark', calendarView: 'month', filesView: 'table' });
    prefs.reset();
    vi.runAllTimers();
    expect(save).toHaveBeenLastCalledWith(null);
    expect(prefs.values.calendarView).toBe('week');
    expect(prefs.clubDefaults()).toMatchObject({ calendarView: 'week', filesView: 'gallery' });
    prefs.set('weekStartHour', 8);
    prefs.set('weekEndHour', 20);
    await prefs.saveClubDefaults();
    expect(prefs.club).toMatchObject({ weekStartHour: 8, weekEndHour: 20, calendarView: 'week' });
    expect(prefs.club).not.toHaveProperty('scheme'); // the look stays the brand's and the member's
    vi.useRealTimers();
  });

  it('sends what this browser held when the member has nothing on the server yet', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async (_values: string | null) => {});
    const store = { get: () => ({ scheme: 'light', density: 'compact' }), set: vi.fn() };
    const prefs = new PreferencesService(settings.appearance, DEFAULTS, store as never);
    await prefs.connect({ load: async () => ({ values: null, clubDefaults: null }), save, saveDefaults });
    vi.runAllTimers();
    expect(save).toHaveBeenCalledWith('{"density":"compact"}'); // the light scheme was the app's default, no choice
    vi.useRealTimers();
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
