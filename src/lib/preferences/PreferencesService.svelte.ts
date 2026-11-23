import type { ColorScheme, Settings } from '../../settings';
import type { LocalStore } from '../storage/LocalStore';
import type { ThemeOverrides } from '../theme/ThemeService';

type Appearance = Settings['appearance'];

export type CalendarViewPreference = 'month' | 'week';

export type FilesViewPreference = 'gallery' | 'table';

export interface Preferences {
  scheme: ColorScheme;
  fontSize: keyof Appearance['fontSizes'];
  density: keyof Appearance['densities'];
  reduceMotion: boolean;
  /** Widest a page grows, in px (null = the app's width; `appearance.contentWidth.max` = the whole window). */
  contentWidth: number | null;
  calendarView: CalendarViewPreference;
  /** Hours the week view shows (end exclusive). */
  weekStartHour: number;
  weekEndHour: number;
  /** Paths of the main sidebar entries in the user's order; [] = default order. */
  navOrder: string[];
  /** Sidebar shows icons only. */
  sidebarCollapsed: boolean;
  /** Keys of the sidebar and settings groups the user closed (others are open). */
  navClosed: string[];
  /** One view for every folder; changing it in any folder changes it everywhere. */
  filesView: FilesViewPreference;
  /** Start page section ids in the user's order ([] = default) and sections switched on or off (others: their default). */
  homeOrder: string[];
  homeShown: Record<string, boolean>;
}

const STORE_KEY = 'preferences';

/** What the club may preset for its members (admin/board); the look stays the brand's and the member's. */
export const CLUB_DEFAULT_KEYS = ['calendarView', 'weekStartHour', 'weekEndHour', 'filesView', 'navOrder', 'homeOrder', 'homeShown'] as const;

/** server: GET/PUT /me/preferences (JSON text each, null = none). */
export interface RemotePreferences {
  values: string | null;
  clubDefaults: string | null;
}

export interface PreferencesRemote {
  load(): Promise<RemotePreferences>;
  save(values: string | null): Promise<unknown>;
  /** Admin/board: the club's defaults (null = removed). */
  saveDefaults(values: string | null): Promise<RemotePreferences>;
}

/**
 * The member's personal settings: appearance and a few defaults. What the member chose (`#own`) lies over the club's
 * defaults, which lie over the app's. Every change is stored in this browser (the cache), sent to the server and handed
 * to `onChange` (the app re-applies the theme there).
 */
export class PreferencesService {
  values = $state<Preferences>() as Preferences;
  /** The club's defaults as last loaded (admin/board see them in Einstellungen). */
  club = $state<Partial<Preferences>>({});

  readonly #defaults: Preferences;
  #own: Partial<Preferences>;
  #remote: PreferencesRemote | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly appearance: Appearance,
    defaults: {
      scheme: ColorScheme;
      calendarView: CalendarViewPreference;
      filesView: FilesViewPreference;
      weekStartHour: number;
      weekEndHour: number;
    },
    private readonly store: LocalStore | null,
    private readonly onChange: (preferences: Preferences) => void = () => {},
  ) {
    this.#defaults = {
      scheme: defaults.scheme,
      fontSize: PreferencesService.first(appearance.fontSizes),
      density: PreferencesService.first(appearance.densities),
      reduceMotion: false,
      contentWidth: null,
      calendarView: defaults.calendarView,
      weekStartHour: defaults.weekStartHour,
      weekEndHour: defaults.weekEndHour,
      navOrder: [],
      sidebarCollapsed: false,
      navClosed: [],
      filesView: defaults.filesView,
      homeOrder: [],
      homeShown: {},
    };
    // Older browsers stored every value; one equal to the app's default was no choice, so the club's default may apply.
    const stored = PreferencesService.object(store?.get<unknown>(STORE_KEY));
    this.#own = Object.fromEntries(
      Object.entries(stored).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(this.#defaults[key as keyof Preferences])),
    );
    this.values = this.sanitize({ ...this.#defaults, ...this.#own });
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    this.#own = { ...this.#own, [key]: value };
    this.#changed();
  }

  /** Everything back to the club's defaults (and the app's where the club set none). */
  reset(): void {
    this.#own = {};
    this.#changed();
  }

  /**
   * After sign-in: the member's choices from the server win over this browser's; a member with none yet keeps what
   * this browser holds and sends it up once.
   */
  async connect(remote: PreferencesRemote): Promise<void> {
    this.#remote = remote;
    const loaded = await remote.load();
    this.club = PreferencesService.parse(loaded.clubDefaults);
    if (loaded.values != null) this.#own = PreferencesService.parse(loaded.values);
    else if (Object.keys(this.#own).length) this.#push();
    this.#apply();
  }

  /** Signed out: changes stay in this browser only. */
  disconnect(): void {
    clearTimeout(this.#timer);
    this.#remote = null;
  }

  /** The current values of what the club may preset (to save them as its defaults). */
  clubDefaults(): Partial<Preferences> {
    return Object.fromEntries(CLUB_DEFAULT_KEYS.map((key) => [key, this.values[key]]));
  }

  /** Admin/board: the member's current start page, sidebar order, calendar and file views become the club's defaults. */
  async saveClubDefaults(): Promise<void> {
    await this.#setClub(JSON.stringify(this.clubDefaults()));
  }

  async removeClubDefaults(): Promise<void> {
    await this.#setClub(null);
  }

  async #setClub(values: string | null): Promise<void> {
    if (!this.#remote) throw new Error('Not signed in');
    this.club = PreferencesService.parse((await this.#remote.saveDefaults(values)).clubDefaults);
    this.#apply();
  }

  #changed(): void {
    this.#apply();
    this.#push();
  }

  #apply(): void {
    this.values = this.sanitize({ ...this.#defaults, ...this.club, ...this.#own });
    this.store?.set(STORE_KEY, this.#own);
    this.onChange(this.values);
  }

  /** Quick changes in a row (closing sidebar groups) go out as one request. */
  #push(): void {
    clearTimeout(this.#timer);
    const remote = this.#remote;
    if (!remote) return;
    this.#timer = setTimeout(() => {
      const own = Object.keys(this.#own).length ? JSON.stringify(this.#own) : null;
      remote.save(own).catch(() => {}); // kept in this browser; sent again with the next change
    }, 500);
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
      fontSize: this.appearance.fontSizes[v.fontSize].size,
      controlHeight: this.appearance.densities[v.density].controlHeight,
      reduceMotion: v.reduceMotion,
      contentWidth: v.contentWidth === null ? undefined : v.contentWidth >= this.appearance.contentWidth.max ? 'none' : `${v.contentWidth}px`,
    };
  }

  /** Unknown stored values (e.g. a removed accent) fall back to the defaults. */
  private sanitize(values: Preferences): Preferences {
    const d = this.#defaults;
    return {
      scheme: ['light', 'dark', 'system'].includes(values.scheme) ? values.scheme : d.scheme,
      fontSize: values.fontSize in this.appearance.fontSizes ? values.fontSize : d.fontSize,
      density: values.density in this.appearance.densities ? values.density : d.density,
      reduceMotion: values.reduceMotion === true,
      contentWidth: PreferencesService.width(values.contentWidth, this.appearance.contentWidth),
      calendarView: ['month', 'week'].includes(values.calendarView) ? values.calendarView : d.calendarView,
      ...PreferencesService.hours(values, d),
      navOrder: PreferencesService.strings(values.navOrder),
      sidebarCollapsed: values.sidebarCollapsed === true,
      navClosed: PreferencesService.strings(values.navClosed),
      filesView: values.filesView === 'table' || values.filesView === 'gallery' ? values.filesView : d.filesView,
      homeOrder: PreferencesService.strings(values.homeOrder),
      homeShown: Object.fromEntries(
        Object.entries(values.homeShown && typeof values.homeShown === 'object' ? values.homeShown : {}).filter(([, on]) => typeof on === 'boolean'),
      ),
    };
  }

  /** A width inside the slider's range, else none. */
  private static width(value: unknown, range: Appearance['contentWidth']): number | null {
    return typeof value === 'number' && value >= range.min && value <= range.max ? value : null;
  }

  /** Whole hours 0–24, at least 4 shown; otherwise the defaults. */
  private static hours(values: Preferences, d: Preferences): Pick<Preferences, 'weekStartHour' | 'weekEndHour'> {
    const { weekStartHour: start, weekEndHour: end } = values;
    return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= 24 && end - start >= 4
      ? { weekStartHour: start, weekEndHour: end }
      : { weekStartHour: d.weekStartHour, weekEndHour: d.weekEndHour };
  }

  private static parse(json: string | null): Partial<Preferences> {
    try {
      return json ? PreferencesService.object(JSON.parse(json)) : {};
    } catch {
      return {};
    }
  }

  private static object(value: unknown): Partial<Preferences> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<Preferences>) : {};
  }

  private static strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string') : [];
  }

  private static first<T extends object>(options: T): keyof T {
    return Object.keys(options)[0] as keyof T;
  }
}
