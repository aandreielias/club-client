/**
 * Central parameters of the website. Every tunable value lives here: theme tokens (turned into
 * CSS custom properties by ThemeService), layout, timing, limits and storage keys.
 * Limits marked "server" mirror club-server validation; keep them in sync when the server changes.
 */

const env = import.meta.env;

export type ApiMode = 'mock' | 'http';

function readApiMode(): ApiMode {
  // The mock (dev login accepts any password) is only a default in development; a release build must say which.
  const mode = env.VITE_API_MODE || (env.PROD ? '' : 'mock');
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
  /** Primary buttons on hover. */
  accentHover: string;
  /** The brand's second colour: small marks only (active sidebar entry, unread dots), never text or areas. */
  highlight: string;
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
  /** Light top edge of filled buttons. */
  insetHighlight: string;
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
        accentHover: '#5762c1',
        highlight: '#5e6ad2',
        accentSoft: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
        onAccent: '#ffffff',
        danger: '#e5484d',
        success: '#2f9e6b',
        warning: '#d9932b',
        backdrop: 'rgba(12, 13, 18, 0.28)',
        shadowWindow: '0 0 0 1px rgba(24, 26, 36, 0.06), 0 8px 24px -6px rgba(24, 26, 36, 0.14), 0 24px 64px -12px rgba(24, 26, 36, 0.18)',
        shadowPopover: '0 0 0 1px rgba(24, 26, 36, 0.07), 0 4px 12px -2px rgba(24, 26, 36, 0.10), 0 12px 32px -8px rgba(24, 26, 36, 0.14)',
        shadowRaised: '0 1px 2px rgba(24, 26, 36, 0.06), 0 0 0 1px rgba(24, 26, 36, 0.06)',
        insetHighlight: 'rgba(255, 255, 255, 0.14)',
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
        accentHover: '#8d94f3',
        highlight: '#7c84f0',
        accentSoft: 'color-mix(in srgb, var(--color-accent) 26%, transparent)',
        onAccent: '#ffffff',
        danger: '#f0676b',
        success: '#3cb57d',
        warning: '#e6a845',
        backdrop: 'rgba(0, 0, 0, 0.5)',
        shadowWindow: '0 0 0 1px rgba(255, 255, 255, 0.06), 0 8px 24px -6px rgba(0, 0, 0, 0.5), 0 24px 64px -12px rgba(0, 0, 0, 0.6)',
        shadowPopover: '0 0 0 1px rgba(255, 255, 255, 0.07), 0 4px 12px -2px rgba(0, 0, 0, 0.45), 0 12px 32px -8px rgba(0, 0, 0, 0.55)',
        shadowRaised: '0 1px 2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        insetHighlight: 'rgba(255, 255, 255, 0.14)',
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
      /** Badges, key caps, timeline labels. */
      sizeTiny: '11px',
      sizeTitle: '24px',
      sizeH1: '22px',
      sizeH2: '15px',
      sizeH3: '13.5px',
      lineHeight: '1.5',
      tracking: '-0.006em',
      weightMedium: '500',
      weightBold: '600',
      /** Page and window titles (club brand: heading font, capitals). */
      display: "'Inter Variable', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      displayWeight: '600',
      displayTransform: 'none',
      displayTracking: '-0.015em',
    },
    radius: {
      /** Thin marks: scrollbar thumbs, bars. */
      xs: '2px',
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
      sidebarCollapsedWidth: '56px',
      contentWidth: '1180px',
      /** Comfortable line length for forms and long text. */
      readableWidth: '720px',
      /** Height of one hour in the calendar week view. */
      calendarHour: '44px',
      /** One row of a table or settings list. */
      rowHeight: '38px',
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
    /** Video call window sizes per placement; `left` is the side placement moved next to the sidebar. */
    call: {
      centerWidth: 'min(760px, calc(100vw - 48px))',
      centerHeight: 'min(70vh, 600px)',
      sideWidth: 'min(420px, 34vw)',
      bottomHeight: '42vh',
      /** The minimized call: one bar along the bottom. */
      barHeight: '56px',
      /** Share of the brand's primary colour in the call's dark background. */
      tint: '30%',
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
    /** Deleting: time to click "Rückgängig" before the server deletes. */
    undoMs: 6000,
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
    /** Supabase password policy (../docs/SETUP.md 3.3). */
    passwordMinLength: 12,
  },

  /** Club facts admins and the board edit (server: ClubController.ClubBody). */
  club: {
    nameMaxLength: 100,
    shortNameMaxLength: 20,
    addressMaxLength: 300,
    linkMaxLength: 200,
    /** server: ClubController (letters, digits, space, dot, slash, hyphen). */
    registerNumberPattern: '^[A-Za-z0-9 ./-]{1,20}$',
    registerNumberMaxLength: 20,
  },

  /** server: members module */
  profile: {
    phoneMaxLength: 25,
  },

  /** server: members module (Member, MembersController) */
  members: {
    /** server: BoardRules.validate (guardian age and own photo consent age) */
    ages: { guardianMin: 14, guardianMax: 21, consentMin: 10 },
    nameMaxLength: 100,
    earliestBirthDate: '1900-01-01',
    /** server: ChangeRequest.NOTE_MAX */
    changeNoteMaxLength: 500,
    kindLabelMaxLength: 40,
    /** server: BoardRules (office settings and board-wide settings) */
    office: { labelMaxLength: 40, maxHolders: 20, maxTermYears: 10 },
    board: { maxMinSize: 20, maxCooptWeeks: 52, maxTermWarningDays: 365, maxByElectionDays: 365 },
  },

  /** server: teams module (Team) */
  teams: {
    nameMaxLength: 80,
    /** Season format, e.g. 2026/27. */
    seasonPattern: '^\\d{4}(/\\d{2})?$',
    seasonMaxLength: 7,
    maxJersey: 99,
    positionMaxLength: 40,
    playerRequestMaxLength: 500,
  },

  /** server: meetings module (Meeting, MeetingType, MeetingStep, Agenda, Resolution) */
  meetings: {
    titleMaxLength: 120,
    urgencyMaxLength: 1000,
    locationMaxLength: 200,
    /** server: CallHandlers.OPENS_BEFORE */
    callOpensBeforeMs: 60 * 60_000,
    /** Speaker highlight: loudness (0–1, RMS) that counts as speaking, how long it holds after silence, how often it is measured. */
    callSpeakingLevel: 0.04,
    callSpeakingHoldMs: 900,
    callMeterMs: 200,
    /** Dragging the call window's inner edge: smallest side width and bottom height. */
    callMinSidePx: 280,
    callMinBottomPx: 200,
    protocolMaxLength: 100_000,
    guestNameMaxLength: 100,
    guestEmailMaxLength: 200,
    type: { labelMaxLength: 80, invitationLabelMaxLength: 120, maxInvitees: 50, maxGraceMinutes: 1440 },
    step: { titleMaxLength: 150, bodyMaxLength: 1000, maxOffsetHours: 8760 },
    agenda: { maxItems: 50, titleMaxLength: 200, noteMaxLength: 1000, motionTextMaxLength: 4000, maxAssignees: 30 },
    /** Circular votes: longest minimum deadline admins may set. */
    maxCircularMinHours: 720,
    /** Linked records of a meeting or resolution (server: MAX_LINKS). */
    maxLinks: 30,
  },

  /** server: tournaments module (Tournament, TournamentHandlers) */
  tournaments: {
    nameMaxLength: 120,
    teamNameMaxLength: 80,
    maxTeams: 64,
    maxFields: 16,
    maxQualifiers: 32,
    maxGroups: 8,
    guestNameMaxLength: 100,
    fieldMaxLength: 40,
    maxSetPoints: 99,
  },

  calendar: {
    defaultView: 'month' as 'month' | 'week',
    /** Hours shown in the week view (end exclusive). */
    weekStartHour: 7,
    weekEndHour: 23,
    /** Entries shown per day cell in the month view before "+n weitere". */
    maxChipsPerDay: 3,
    defaultStartTime: '18:00',
    /** Week view: dropped appointments snap to this grid. */
    snapMinutes: 15,
    defaultDurationMinutes: 90,
    /** server: calendar + attendance modules */
    maxRangeDays: 366,
    /** .ics export: upcoming appointments within this many days (weekly series run at most 2 years). */
    exportDays: 2 * 366,
    /** server: Appointment.MAX_DURATION; each type sets its own (maxDays). */
    maxDurationDays: 30,
    maxSeriesOccurrences: 104,
    maxIntervalWeeks: 8,
    maxIntervalMonths: 12,
    titleMaxLength: 120,
    descriptionMaxLength: 2000,
    locationMaxLength: 200,
    reasonMaxLength: 300,
    /** Changing cabins, free text per club cabin label (where the appointment type offers them). */
    cabinMaxLength: 60,
    /** Car pools: seats until the club's calendar settings (maxRideSeats) are loaded; the server limits the note. */
    rideMaxSeats: 8,
    /** Car seen from above next to each ride (CarSeats); height follows the number of seats. */
    rideGraphic: { width: 84 },
    rideNoteMaxLength: 200,
    holidayNameMaxLength: 80,
    typeLabelMaxLength: 40,
    maxRemindHours: 336,
    /** server: calendar_type.min_shift_minutes (a day). */
    maxShiftMinutes: 1440,
    opponentMaxLength: 80,
    trainingPlanMaxLength: 4000,
  },

  /** How long returning to a page waits for its list to load before restoring the scroll position. */
  scrollRestoreMs: 1500,

  window: {
    /** Records offered under "Zuletzt geöffnet" in the command palette. */
    recentRecords: 8,
    defaultDock: 'center' as 'center' | 'side' | 'bottom',
    /** Dragging the inner edge of a docked window: its smallest size, what the page keeps, arrow-key step. */
    resize: { minSidePx: 320, minBottomPx: 200, pageMinWidthPx: 360, pageMinHeightPx: 160, stepPx: 24 },
    /**
     * Dragging the detail window or the call by its header (lib/window/windowDrag): how far a docked one moves before it
     * undocks, how close its edge comes to the screen's to dock there, how far ahead (ms at the drag's speed) that is judged.
     */
    drag: { undockPx: 8, snapPx: 100, leadMs: 150 },
  },

  /** Key handling; the shortcuts themselves are in src/shortcuts.ts. */
  keyboard: {
    /** Time to press the next key of a sequence (e.g. G, then K). */
    sequenceTimeoutMs: 1200,
    /** While recording a shortcut: wait this long for a second key before saving a single key. */
    recordSequenceMs: 900,
  },

  /** Einstellungen › Erscheinungsbild: typing pause before the e-mail preview is rendered again. */
  brand: {
    mailPreviewDebounceMs: 400,
    /** server: Brand and MailSample */
    appNameMaxLength: 30,
    maxRadiusSmall: 12,
    maxRadiusLarge: 24,
    mailGreetingMaxLength: 100,
    mailSignOffMaxLength: 200,
    mailFooterMaxLength: 500,
    sampleSubjectMaxLength: 200,
    sampleTextMaxLength: 2000,
  },

  /** Choices offered under Einstellungen > Darstellung; the first entry of each is the default. */
  appearance: {
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
    /** Rows of the other list sections (tasks, inventory, members ...). */
    listRows: 6,
    /** Days of the "Termine" section. */
    calendarDays: 30,
    /** Days of the "Sitzungen" and "Turniere" sections (they are planned further ahead). */
    planningDays: 90,
  },

  activity: {
    /** Changes loaded per page of the "Aktivität" page (server: at most 100). */
    pageSize: 50,
  },

  /** Split view: share of the width the main page keeps, arrow-key step, page opened first. */
  split: { minRatio: 0.3, maxRatio: 0.7, step: 0.05, defaultPath: '/calendar' },

  /** Club mailboxes (server: OutgoingMail limits). */
  mail: {
    /** Default recipients per member and day until admin/board change it (server: mail_setting.daily_limit). */
    dailyLimit: 200,
    subjectMaxLength: 200,
    /** Formatted text, as HTML (server: OutgoingMail.MAX_HTML). */
    bodyMaxLength: 200_000,
    /** Records linked in the text and attached, together (server: MailRefs.MAX). */
    maxRefs: 20,
    mailboxNameMaxLength: 100,
    maxDailyLimit: 10_000,
    /** Hits per kind in the "Verknüpfen" search. */
    /** A draft is saved this long after the last change while writing. */
    draftDelayMs: 1500,
  },
  locations: {
    nameMaxLength: 100,
    streetMaxLength: 120,
    zipMaxLength: 12,
    cityMaxLength: 80,
    noteMaxLength: 500,
    /**
     * Small map next to a place: OpenStreetMap data from OpenFreeMap (free, no key), drawn by MapLibre in
     * an Apple-Maps-like look (lib/maps/MapLook.ts). Zoom level and height on screen.
     */
    map: {
      style: 'https://tiles.openfreemap.org/styles/liberty',
      zoom: 15.5,
      height: '15rem',
    },
  },

  notifications: {
    /** Show a toast when a new notification arrives live. */
    toastOnArrival: true,
    /** server: NotificationHandlers.saveSettings, days the inbox and the activity log are kept */
    inboxRetentionDays: { min: 30, max: 365 },
    activityRetentionDays: { min: 90, max: 3650 },
  },

  files: {
    /** Comparing versions: lines read per version, unchanged lines kept around each change. */
    compareMaxLines: 2000,
    compareContextLines: 2,
    /** server: FileVersion.MAX_LABEL */
    versionLabelMaxLength: 20,
    /** ZIP downloads are packed in the browser; larger folders must be downloaded in parts. */
    zipMaxBytes: 500 * 1024 * 1024,
    /** Excel/PowerPoint previews show at most this much. */
    preview: { maxRows: 500, maxColumns: 50, maxSlides: 100 },
    /** View of every folder until the member picks another one. */
    defaultView: 'gallery' as 'gallery' | 'table',
    /** server: spring.servlet.multipart.max-file-size (25MB) */
    maxUploadBytes: 25 * 1024 * 1024,
    /** server: FileHandlers / Folder */
    maxFolderDepth: 5,
    folderNameMaxLength: 100,
    maxTags: 50,
    maxFolderTeams: 20,
    /** Upload quota per member in GB (server: files_setting, 100 MB to 100 GB). */
    quotaMinGb: 0.1,
    quotaMaxGb: 100,
    /** server: files_setting.max_image_side and keep_versions */
    imageSideMin: 1600,
    imageSideMax: 6000,
    maxKeepVersions: 100,
    /** Download links live 5 minutes on the server; reuse them until this long before expiry. */
    linkReuseMarginMs: 30_000,
    /** File pickers offer these; the server checks the real type by content. */
    imageExtensions: ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.svg'],
    documentExtensions: ['.pdf', '.docx', '.dotx', '.xlsx', '.pptx'],
    /** Simulated upload duration per MB in mock mode. */
    mockUploadMsPerMb: 400,
  },

  tasks: {
    defaultDueTime: '18:00',
    /** In-app reminders of own due tasks: how often to look, and when to sum up instead. */
    reminderCheckMs: 60 * 60_000,
    reminderMaxToasts: 3,
    /** server: tasks module */
    titleMaxLength: 150,
    descriptionMaxLength: 4000,
    maxAssignees: 30,
    maxChecklistItems: 50,
    checklistItemMaxLength: 200,
    commentMaxLength: 2000,
    maxRemindHours: 336,
    maxOverdueRepeatDays: 30,
    maxEscalateAfterDays: 90,
  },

  finance: {
    /** server: finance module (Account, Category, Booking, FinanceHandlers) */
    labelMaxLength: 60,
    textMaxLength: 200,
    noteMaxLength: 2000,
    referenceMaxLength: 60,
    counterpartyMaxLength: 120,
    maxCents: 1_000_000_000,
    maxRefs: 20,
    maxReceipts: 10,
    listCap: 2000,
    /** server: FeeSettings (due and reminder days, how to pay, account holder) */
    fee: { maxDays: 365, instructionsMaxLength: 2000, holderMaxLength: 70, maxYouthAge: 99 },
  },
  inventory: {
    /** server: inventory module (Item) */
    nameMaxLength: 100,
    categoryMaxLength: 60,
    /** Lines of the "Wo ist es?" editor (server: InventoryHandlers.MAX_STOCK_ENTRIES). */
    maxStockLines: 50,
    /** Mock of the server's reminder job (lead time: the club's calendar settings). */
    reminderCheckMs: 5 * 60_000,
    descriptionMaxLength: 2000,
    maxQuantity: 100_000,
  },

  /** Global search (sidebar field, /search). server: SearchController. */
  search: {
    minQueryLength: 2,
    maxQueryLength: 100,
    /** Hits per kind (appointments, tasks, ...); the server allows up to 25. */
    perKind: 8,
    /** Hits per kind when picking records to link (mails). */
    pickerPerKind: 5,
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
    /** A sidebar group's flyout stays this long after the pointer leaves, so it can move into it. */
    flyoutCloseDelayMs: 180,
    /** While the pointer heads for an open flyout (SafeTriangle), a pause this long ends the aim: the flyout closes or the row below opens. */
    flyoutAimMs: 400,
    /** Touch: holding a finger this long opens the context menu. */
    longPressMs: 500,
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
