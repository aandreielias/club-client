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
  onAccent: string;
  danger: string;
  success: string;
  warning: string;
  backdrop: string;
  shadowWindow: string;
  shadowPopover: string;
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
        background: '#ffffff',
        surface: '#f7f7f5',
        hover: 'rgba(55, 53, 47, 0.06)',
        selected: 'rgba(55, 53, 47, 0.08)',
        field: 'rgba(242, 241, 238, 0.6)',
        text: '#37352f',
        textMuted: '#787774',
        textFaint: '#a5a29c',
        border: 'rgba(55, 53, 47, 0.12)',
        borderStrong: 'rgba(55, 53, 47, 0.24)',
        accent: '#2383e2',
        onAccent: '#ffffff',
        danger: '#d44c47',
        success: '#448361',
        warning: '#cb912f',
        backdrop: 'rgba(15, 15, 15, 0.45)',
        shadowWindow: 'rgba(15, 15, 15, 0.05) 0 0 0 1px, rgba(15, 15, 15, 0.1) 0 5px 10px, rgba(15, 15, 15, 0.2) 0 15px 40px',
        shadowPopover: 'rgba(15, 15, 15, 0.05) 0 0 0 1px, rgba(15, 15, 15, 0.1) 0 3px 6px, rgba(15, 15, 15, 0.2) 0 9px 24px',
        tagGrayBg: '#f1f1ef',
        tagGrayText: '#787774',
        tagBrownBg: '#f4eeee',
        tagBrownText: '#9f6b53',
        tagOrangeBg: '#fbecdd',
        tagOrangeText: '#d9730d',
        tagYellowBg: '#fbf3db',
        tagYellowText: '#a37415',
        tagGreenBg: '#edf3ec',
        tagGreenText: '#448361',
        tagBlueBg: '#e7f3f8',
        tagBlueText: '#337ea9',
        tagPurpleBg: '#f4f0f7',
        tagPurpleText: '#9065b0',
        tagRedBg: '#fdebec',
        tagRedText: '#d44c47',
      } satisfies Palette,
      dark: {
        background: '#191919',
        surface: '#202020',
        hover: 'rgba(255, 255, 255, 0.055)',
        selected: 'rgba(255, 255, 255, 0.08)',
        field: 'rgba(255, 255, 255, 0.055)',
        text: '#d4d4d4',
        textMuted: '#9b9b9b',
        textFaint: '#6f6f6f',
        border: 'rgba(255, 255, 255, 0.094)',
        borderStrong: 'rgba(255, 255, 255, 0.2)',
        accent: '#2383e2',
        onAccent: '#ffffff',
        danger: '#df5452',
        success: '#529e72',
        warning: '#ca9849',
        backdrop: 'rgba(0, 0, 0, 0.6)',
        shadowWindow: 'rgba(15, 15, 15, 0.2) 0 0 0 1px, rgba(15, 15, 15, 0.3) 0 5px 10px, rgba(15, 15, 15, 0.4) 0 15px 40px',
        shadowPopover: 'rgba(15, 15, 15, 0.2) 0 0 0 1px, rgba(15, 15, 15, 0.3) 0 3px 6px, rgba(15, 15, 15, 0.4) 0 9px 24px',
        tagGrayBg: '#373737',
        tagGrayText: '#9b9b9b',
        tagBrownBg: '#4a3228',
        tagBrownText: '#ba856f',
        tagOrangeBg: '#5c3b23',
        tagOrangeText: '#c77d48',
        tagYellowBg: '#56452f',
        tagYellowText: '#ca9849',
        tagGreenBg: '#243d30',
        tagGreenText: '#529e72',
        tagBlueBg: '#143a4e',
        tagBlueText: '#379ad3',
        tagPurpleBg: '#3c2d49',
        tagPurpleText: '#9d68d3',
        tagRedBg: '#522e2a',
        tagRedText: '#df5452',
      } satisfies Palette,
    },
    font: {
      family: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      mono: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
      sizeBase: '14px',
      sizeSmall: '12.5px',
      sizeTitle: '32px',
      sizeH1: '28px',
      sizeH2: '18px',
      sizeH3: '15px',
      lineHeight: '1.5',
      weightMedium: '500',
      weightBold: '600',
    },
    radius: {
      sm: '3px',
      md: '6px',
      lg: '10px',
    },
    space: {
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      xxl: '48px',
    },
    /** Every input, select and button shares these. */
    control: {
      height: '26px',
      paddingX: '8px',
    },
    layout: {
      sidebarWidth: '240px',
      contentWidth: '1200px',
      /** Comfortable line length for forms and long text. */
      readableWidth: '720px',
      /** Height of one hour in the calendar week view. */
      calendarHour: '44px',
      narrowWidth: '420px',
      fieldWidth: '320px',
    },
    /** Detail window sizes per placement. */
    window: {
      centerWidth: 'min(960px, calc(100vw - 48px))',
      centerHeight: 'min(85vh, 900px)',
      sideWidth: 'min(600px, 48vw)',
      bottomHeight: '50vh',
    },
    motion: {
      fast: '120ms',
      window: '260ms',
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    },
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
      blue: { label: 'Blau', color: '#2383e2' },
      green: { label: 'Grün', color: '#448361' },
      purple: { label: 'Lila', color: '#9065b0' },
      orange: { label: 'Orange', color: '#d9730d' },
      red: { label: 'Rot', color: '#d44c47' },
    },
    fontSizes: {
      normal: { label: 'Normal', size: '14px' },
      small: { label: 'Klein', size: '13px' },
      large: { label: 'Groß', size: '16px' },
    },
    densities: {
      normal: { label: 'Normal', controlHeight: '26px' },
      compact: { label: 'Kompakt', controlHeight: '22px' },
      comfortable: { label: 'Breit', controlHeight: '32px' },
    },
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
