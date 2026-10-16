/**
 * Central parameters of the website. Every tunable value lives here: theme tokens (turned into
 * CSS custom properties by ThemeService), layout, timing, limits and storage keys.
 * Limits marked "server" mirror club-server validation; keep them in sync when the server changes.
 */

const env = import.meta.env;

export type ApiMode = 'mock' | 'http';

function readApiMode(): ApiMode {
  const mode = env.VITE_API_MODE || 'mock';
  if (mode !== 'mock' && mode !== 'http') throw new Error(`VITE_API_MODE must be "mock" or "http", got "${mode}"`);
  return mode;
}

const apiMode = readApiMode();

function requiredInHttpMode(name: string): string {
  if (apiMode !== 'http') return '';
  const value = env[name] as string | undefined;
  if (!value) throw new Error(`${name} is missing (needed for VITE_API_MODE=http)`);
  return value.replace(/\/$/, '');
}

/** 'system' follows the device setting (prefers-color-scheme). */
export type ColorScheme = 'light' | 'dark' | 'system';

/** Colour roles; both schemes must define every key (each becomes `--color-<kebab-name>`). */
export interface Palette {
  background: string;
  surface: string;
  /** Raised layers: windows, dialogs, menus. */
  elevated: string;
  hover: string;
  /** Background of selected items (active nav, chosen option). */
  selected: string;
  /** Resting background of text inputs and selects. */
  field: string;
  text: string;
  textMuted: string;
  /** Placeholders and disabled text. */
  textFaint: string;
  border: string;
  /** Stronger line, e.g. focused or hovered inputs. */
  borderStrong: string;
  accent: string;
  /** Translucent accent: focus rings, text selection. */
  accentSoft: string;
  onAccent: string;
  danger: string;
  success: string;
  warning: string;
  backdrop: string;
  shadowWindow: string;
  shadowPopover: string;
  /** Resting cards and segmented controls. */
  shadowRaised: string;
  /** Tag colours (Notion-like): background and text per hue. */
  tagGrayBg: string;
  tagGrayText: string;
  tagBrownBg: string;
  tagBrownText: string;
  tagOrangeBg: string;
  tagOrangeText: string;
  tagYellowBg: string;
  tagYellowText: string;
  tagGreenBg: string;
  tagGreenText: string;
  tagBlueBg: string;
  tagBlueText: string;
  tagPurpleBg: string;
  tagPurpleText: string;
  tagRedBg: string;
  tagRedText: string;
}

/** Durations in ms, shared by CSS tokens and script animations. */
const motionMs = { fast: 120, base: 200, slow: 320, window: 280 } as const;

export const settings = {
  /** Build-time environment (.env / CI variables). */
  runtime: {
    apiMode,
    apiUrl: requiredInHttpMode('VITE_API_URL'),
    supabaseUrl: requiredInHttpMode('VITE_SUPABASE_URL'),
    supabaseKey: requiredInHttpMode('VITE_SUPABASE_PUBLISHABLE_KEY'),
  },

  theme: {
    scheme: 'light' as ColorScheme,
    colors: {
      light: {
        background: '#fcfcfd',
        surface: '#f5f5f7',
        elevated: '#ffffff',
        hover: 'rgba(24, 26, 36, 0.045)',
        selected: 'rgba(24, 26, 36, 0.07)',
        field: '#ffffff',
        text: '#1b1c21',
        textMuted: '#6b6e78',
        textFaint: '#a3a5ad',
        border: 'rgba(24, 26, 36, 0.08)',
        borderStrong: 'rgba(24, 26, 36, 0.15)',
        accent: '#5e6ad2',
        accentSoft: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
        onAccent: '#ffffff',
        danger: '#e5484d',
        success: '#2f9e6b',
        warning: '#d9932b',
        backdrop: 'rgba(12, 13, 18, 0.28)',
        shadowWindow: '0 0 0 1px rgba(24, 26, 36, 0.06), 0 8px 24px -6px rgba(24, 26, 36, 0.14), 0 24px 64px -12px rgba(24, 26, 36, 0.18)',
        shadowPopover: '0 0 0 1px rgba(24, 26, 36, 0.07), 0 4px 12px -2px rgba(24, 26, 36, 0.10), 0 12px 32px -8px rgba(24, 26, 36, 0.14)',
        shadowRaised: '0 1px 2px rgba(24, 26, 36, 0.06), 0 0 0 1px rgba(24, 26, 36, 0.06)',
        tagGrayBg: 'rgba(107, 110, 120, 0.12)',
        tagGrayText: '#5f626b',
        tagBrownBg: 'rgba(150, 102, 72, 0.13)',
        tagBrownText: '#8a5a3c',
        tagOrangeBg: 'rgba(230, 125, 34, 0.13)',
        tagOrangeText: '#b8600f',
        tagYellowBg: 'rgba(217, 160, 30, 0.15)',
        tagYellowText: '#94690a',
        tagGreenBg: 'rgba(47, 158, 107, 0.13)',
        tagGreenText: '#23794f',
        tagBlueBg: 'rgba(59, 130, 220, 0.13)',
        tagBlueText: '#2563b8',
        tagPurpleBg: 'rgba(124, 92, 214, 0.13)',
        tagPurpleText: '#6743c4',
        tagRedBg: 'rgba(229, 72, 77, 0.12)',
        tagRedText: '#c42f35',
      } satisfies Palette,
      dark: {
        background: '#0f1013',
        surface: '#141518',
        elevated: '#1b1c20',
        hover: 'rgba(255, 255, 255, 0.045)',
        selected: 'rgba(255, 255, 255, 0.075)',
        field: 'rgba(255, 255, 255, 0.03)',
        text: '#e7e8ea',
        textMuted: '#9a9ca4',
        textFaint: '#63656d',
        border: 'rgba(255, 255, 255, 0.07)',
        borderStrong: 'rgba(255, 255, 255, 0.14)',
        accent: '#7c84f0',
        accentSoft: 'color-mix(in srgb, var(--color-accent) 26%, transparent)',
        onAccent: '#ffffff',
        danger: '#f0676b',
        success: '#3cb57d',
        warning: '#e6a845',
        backdrop: 'rgba(0, 0, 0, 0.5)',
        shadowWindow: '0 0 0 1px rgba(255, 255, 255, 0.06), 0 8px 24px -6px rgba(0, 0, 0, 0.5), 0 24px 64px -12px rgba(0, 0, 0, 0.6)',
        shadowPopover: '0 0 0 1px rgba(255, 255, 255, 0.07), 0 4px 12px -2px rgba(0, 0, 0, 0.45), 0 12px 32px -8px rgba(0, 0, 0, 0.55)',
        shadowRaised: '0 1px 2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        tagGrayBg: 'rgba(154, 156, 164, 0.16)',
        tagGrayText: '#b3b5bc',
        tagBrownBg: 'rgba(186, 133, 111, 0.18)',
        tagBrownText: '#d2a48f',
        tagOrangeBg: 'rgba(240, 140, 60, 0.18)',
        tagOrangeText: '#f0a466',
        tagYellowBg: 'rgba(230, 180, 70, 0.18)',
        tagYellowText: '#e8c170',
        tagGreenBg: 'rgba(60, 181, 125, 0.18)',
        tagGreenText: '#6fcf9f',
        tagBlueBg: 'rgba(80, 150, 240, 0.2)',
        tagBlueText: '#86b6f5',
        tagPurpleBg: 'rgba(150, 120, 240, 0.2)',
        tagPurpleText: '#b7a3f7',
        tagRedBg: 'rgba(240, 103, 107, 0.18)',
        tagRedText: '#f59497',
      } satisfies Palette,
    },
    font: {
      family: "'Inter Variable', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      mono: "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, monospace",
      /** OpenType features of Inter (cv01: alternate one, ss03: round quotes). */
      features: "'cv01', 'ss03'",
      sizeBase: '14px',
      sizeSmall: '12.5px',
      sizeTitle: '24px',
      sizeH1: '22px',
      sizeH2: '15px',
      sizeH3: '13.5px',
      lineHeight: '1.5',
      tracking: '-0.006em',
      weightMedium: '500',
      weightBold: '600',
    },
    radius: {
      sm: '4px',
      md: '6px',
      lg: '10px',
      xl: '14px',
      full: '999px',
    },
    space: {
      xxs: '2px',
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      xxl: '40px',
    },
    /** Every input, select and button shares these. */
    control: {
      height: '30px',
      paddingX: '10px',
    },
    icon: {
      size: '16px',
      sizeSmall: '14px',
      stroke: '1.75',
    },
    layout: {
      sidebarWidth: '232px',
      contentWidth: '1180px',
      /** Comfortable line length for forms and long text. */
      readableWidth: '720px',
      /** Height of one hour in the calendar week view. */
      calendarHour: '44px',
      narrowWidth: '400px',
      fieldWidth: '320px',
    },
    /** Detail window sizes per placement. */
    window: {
      centerWidth: 'min(920px, calc(100vw - 48px))',
      centerHeight: 'min(85vh, 880px)',
      sideWidth: 'min(580px, 46vw)',
      bottomHeight: '50vh',
    },
    /** CSS side of `settings.motion` (same numbers, as custom properties). */
    motion: {
      fast: `${motionMs.fast}ms`,
      base: `${motionMs.base}ms`,
      slow: `${motionMs.slow}ms`,
      window: `${motionMs.window}ms`,
      /** Quick start, long soft landing: everything that enters. */
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      /** Symmetric, for things that move between two resting places. */
      easingInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    },
  },

  /** Animation timing for script-driven motion (src/lib/motion); CSS reads theme.motion. */
  motion: {
    ...motionMs,
    /** Delay between rows that fade in one after another, and the last row that still waits. */
    staggerMs: 22,
    staggerMax: 12,
    /** Distance (px) elements travel when they enter. */
    rise: 6,
  },

  /** Event bus (src/lib/bus): request timeout and debug history length. */
  bus: {
    requestTimeoutMs: 5000,
    historySize: 200,
  },

  /** Below this viewport width the layout switches to compact (sidebar as overlay). */
  compactBelowPx: 720,

  storage: {
    /** Bump the version when a stored shape changes, so old data is ignored. */
    prefix: 'club.v2.',
  },

  api: {
    mockLatencyMs: 150,
    /** Origin shown for absolute links (e.g. the iCal feed) in mock mode. */
    mockOrigin: 'https://mock.invalid',
  },

  notify: {
    toastMs: 3000,
    errorToastMs: 6000,
  },

  /** Live updates (WebSocket /ws, server: gateway/live). */
  live: {
    path: '/ws',
    reconnectMinMs: 1000,
    reconnectMaxMs: 30_000,
    /** Send a fresh token this long before the current one expires. */
    reauthLeadMs: 60_000,
    /** Lifetime the mock server grants per token. */
    mockTokenLifetimeMs: 15 * 60_000,
  },

  auth: {
    /** Supabase password policy (docs/SETUP.md 3.3). */
    passwordMinLength: 12,
  },

  /** server: members module */
  security: {
    pinLength: 5,
    stepUpMinutes: 10,
    maxPinAttempts: 5,
  },

  /** server: members module */
  profile: {
    phoneMaxLength: 25,
  },

  /** server: members module (Member, MembersController) */
  members: {
    nameMaxLength: 100,
    earliestBirthDate: '1900-01-01',
    /** Exact text the server requires to reset every PIN at once. */
    resetAllConfirmation: 'RESET ALL PINS',
    /** Show the search field from this many members on. */
    searchFrom: 8,
  },

  /** server: teams module (Team) */
  teams: {
    nameMaxLength: 80,
    /** Season format, e.g. 2026/27. */
    seasonPattern: '^\\d{4}/\\d{2}$',
    /** Month (1-12) in which a new season starts, for the default in the team form. */
    seasonStartMonth: 7,
  },

  calendar: {
    defaultView: 'month' as 'month' | 'week' | 'list',
    /** Hours shown in the week view (end exclusive). */
    weekStartHour: 7,
    weekEndHour: 23,
    /** Entries shown per day cell in the month view before "+n weitere". */
    maxChipsPerDay: 3,
    /** Length of one page in the list view. */
    agendaDays: 28,
    defaultStartTime: '18:00',
    defaultDurationMinutes: 90,
    /** server: calendar + attendance modules */
    maxRangeDays: 366,
    /** .ics export: upcoming appointments within this many days (weekly series run at most 2 years). */
    exportDays: 2 * 366,
    maxDurationDays: 7,
    maxSeriesOccurrences: 104,
    maxIntervalWeeks: 4,
    titleMaxLength: 120,
    descriptionMaxLength: 2000,
    locationMaxLength: 200,
    reasonMaxLength: 300,
  },

  window: {
    defaultDock: 'center' as 'center' | 'side' | 'bottom',
  },

  /** Key handling; the shortcuts themselves are in src/shortcuts.ts. */
  keyboard: {
    /** Time to press the next key of a sequence (e.g. G, then K). */
    sequenceTimeoutMs: 1200,
    /** While recording a shortcut: wait this long for a second key before saving a single key. */
    recordSequenceMs: 900,
  },

  /** Choices offered under Einstellungen > Darstellung; the first entry of each is the default. */
  appearance: {
    accents: {
      indigo: { label: 'Indigo', color: '#5e6ad2' },
      blue: { label: 'Blau', color: '#2f7fe0' },
      green: { label: 'Grün', color: '#2f9e6b' },
      violet: { label: 'Violett', color: '#8b5cf6' },
      orange: { label: 'Orange', color: '#e0702a' },
      red: { label: 'Rot', color: '#e5484d' },
    },
    fontSizes: {
      normal: { label: 'Normal', size: '14px' },
      small: { label: 'Klein', size: '13px' },
      large: { label: 'Groß', size: '15px' },
    },
    densities: {
      normal: { label: 'Normal', controlHeight: '30px' },
      compact: { label: 'Kompakt', controlHeight: '26px' },
      comfortable: { label: 'Breit', controlHeight: '36px' },
    },
  },

  /** Start page. */
  home: {
    /** Days of the agenda. */
    agendaDays: 7,
    /** Newest notifications shown. */
    notificationCount: 5,
  },

  notifications: {
    /** Show a toast when a new notification arrives live. */
    toastOnArrival: true,
  },

  files: {
    /** server: spring.servlet.multipart.max-file-size (25MB) */
    maxUploadBytes: 25 * 1024 * 1024,
    /** server: FileHandlers / Folder */
    maxFolderDepth: 5,
    folderNameMaxLength: 100,
    maxTags: 50,
    /** Download links live 5 minutes on the server; reuse them until this long before expiry. */
    linkReuseMarginMs: 30_000,
    /** File pickers offer these; the server checks the real type by content. */
    imageExtensions: ['.jpg', '.jpeg', '.png', '.heic', '.heif'],
    documentExtensions: ['.pdf', '.docx', '.xlsx', '.pptx'],
    /** Simulated upload duration per MB in mock mode. */
    mockUploadMsPerMb: 400,
  },

  tasks: {
    defaultDueTime: '18:00',
    /** Open tasks due within this many hours are highlighted (server reminds 24 h before). */
    dueSoonHours: 24,
    /** server: tasks module */
    titleMaxLength: 150,
    descriptionMaxLength: 4000,
    maxAssignees: 30,
    maxChecklistItems: 50,
    checklistItemMaxLength: 200,
    commentMaxLength: 2000,
  },

  inventory: {
    /** server: inventory module (Item) */
    nameMaxLength: 100,
    categoryMaxLength: 60,
    locationMaxLength: 100,
    descriptionMaxLength: 2000,
    maxQuantity: 100_000,
  },

  /** Global search (sidebar field, /search). server: SearchController. */
  search: {
    minQueryLength: 2,
    maxQueryLength: 100,
    /** Hits per kind (appointments, tasks, ...); the server allows up to 25. */
    perKind: 8,
    /** Typing pause before the results update. */
    debounceMs: 250,
  },

  /** Custom tooltips (ui/tooltip.ts) and context menus (ui/contextMenu.ts). */
  overlay: {
    /** Pause on hover before a tooltip shows; keyboard focus shows it at once. */
    tooltipDelayMs: 500,
    /** After one tooltip, the next shows without delay if the pointer moves on within this time. */
    tooltipSkipDelayMs: 400,
    tooltipMaxWidthPx: 320,
    /** Gap between anchor (or pointer) and tooltip/menu, and to the viewport edge. */
    offsetPx: 6,
  },

  /** "Benötigt" lists and attached files of appointments and tasks (server: platform.LinkResolver). */
  links: {
    maxEntries: 50,
    maxQuantity: 10_000,
    /** File picker: hits per search (server allows up to 50) and typing pause before searching. */
    fileResults: 20,
    searchDebounceMs: 200,
  },
} as const;

export type Settings = typeof settings;
