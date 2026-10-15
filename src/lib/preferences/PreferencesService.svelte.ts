import type { ColorScheme, Settings } from '../../settings';
import type { LocalStore } from '../storage/LocalStore';
import type { ThemeOverrides } from '../theme/ThemeService';

type Appearance = Settings['appearance'];

export type CalendarViewPreference = 'month' | 'week' | 'list';

export interface Preferences {
  scheme: ColorScheme;
  accent: keyof Appearance['accents'];
  fontSize: keyof Appearance['fontSizes'];
  density: keyof Appearance['densities'];
  reduceMotion: boolean;
  calendarView: CalendarViewPreference;
  /** Paths of the main sidebar entries in the user's order; [] = default order. */
  navOrder: string[];
}

const STORE_KEY = 'preferences';

/**
 * The user's personal settings (per browser): appearance and a few defaults. Every change is
 * stored and handed to `onChange` (the app re-applies the theme there).
 */
export class PreferencesService {
  values = $state<Preferences>() as Preferences;

  readonly #defaults: Preferences;

  constructor(
    readonly appearance: Appearance,
    defaults: { scheme: ColorScheme; calendarView: CalendarViewPreference },
    private readonly store: LocalStore | null,
    private readonly onChange: (preferences: Preferences) => void = () => {},
  ) {
    this.#defaults = {
      scheme: defaults.scheme,
      accent: PreferencesService.first(appearance.accents),
      fontSize: PreferencesService.first(appearance.fontSizes),
      density: PreferencesService.first(appearance.densities),
      reduceMotion: false,
      calendarView: defaults.calendarView,
      navOrder: [],
    };
    this.values = this.sanitize({ ...this.#defaults, ...(store?.get<Partial<Preferences>>(STORE_KEY) ?? {}) });
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    this.values = this.sanitize({ ...this.values, [key]: value });
    this.store?.set(STORE_KEY, this.values);
    this.onChange(this.values);
  }

  reset(): void {
    this.values = { ...this.#defaults };
    this.store?.set(STORE_KEY, this.values);
    this.onChange(this.values);
  }

  /** Light ↔ dark; from "system" it switches to the opposite of what the device shows now. */
  toggleScheme(prefersDark: boolean): void {
    const dark = this.values.scheme === 'dark' || (this.values.scheme === 'system' && prefersDark);
    this.set('scheme', dark ? 'light' : 'dark');
  }

  /** What ThemeService needs from the current preferences. */
  themeOverrides(): ThemeOverrides {
    const v = this.values;
    return {
      scheme: v.scheme,
      accent: this.appearance.accents[v.accent].color,
      fontSize: this.appearance.fontSizes[v.fontSize].size,
      controlHeight: this.appearance.densities[v.density].controlHeight,
      reduceMotion: v.reduceMotion,
    };
  }

  /** Unknown stored values (e.g. a removed accent) fall back to the defaults. */
  private sanitize(values: Preferences): Preferences {
    const d = this.#defaults;
    return {
      scheme: ['light', 'dark', 'system'].includes(values.scheme) ? values.scheme : d.scheme,
      accent: values.accent in this.appearance.accents ? values.accent : d.accent,
      fontSize: values.fontSize in this.appearance.fontSizes ? values.fontSize : d.fontSize,
      density: values.density in this.appearance.densities ? values.density : d.density,
      reduceMotion: values.reduceMotion === true,
      calendarView: ['month', 'week', 'list'].includes(values.calendarView) ? values.calendarView : d.calendarView,
      navOrder: Array.isArray(values.navOrder) ? values.navOrder.filter((p): p is string => typeof p === 'string') : [],
    };
  }

  private static first<T extends object>(options: T): keyof T {
    return Object.keys(options)[0] as keyof T;
  }
}
