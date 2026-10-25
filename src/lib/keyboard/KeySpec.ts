/** The parts of a keyboard event KeySpec needs (a real KeyboardEvent fits). */
export interface KeyInput {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_ORDER = ['Mod', 'Ctrl', 'Alt', 'Shift'] as const;
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn']);
const KEY_LABELS: Readonly<Record<string, string>> = {
  ArrowLeft: 'Pfeil links',
  ArrowRight: 'Pfeil rechts',
  ArrowUp: 'Pfeil hoch',
  ArrowDown: 'Pfeil runter',
  Escape: 'Esc',
  Enter: 'Enter',
  ' ': 'Leertaste',
  Backspace: 'Rücktaste',
  Delete: 'Entf',
  Tab: 'Tab',
};

/**
 * Key specs as written in src/shortcuts.ts ("Mod+K", "g k", "Shift+R"): parsing to a canonical
 * form, turning keyboard events into the same form, conflict checks and display labels.
 * Canonical form: modifiers in fixed order, letters upper case, steps joined by one space.
 */
export class KeySpec {
  private constructor() {}

  /** Canonical form of a spec; '' for an empty or unusable spec. */
  static normalize(spec: string): string {
    return spec
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((step) => KeySpec.normalizeCombo(step))
      .filter(Boolean)
      .join(' ');
  }

  /** Canonical combo of a key event, or null for lone modifier keys. */
  static fromEvent(event: KeyInput, isMac: boolean): string | null {
    // Some synthetic keydowns (e.g. Chrome autofill) carry no key at all.
    if (!event.key || MODIFIER_KEYS.has(event.key)) return null;
    let key: string;
    let shiftImplied = false;
    if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
    else if (/^Digit\d$/.test(event.code)) key = event.code.slice(5);
    else if (event.key.length === 1) {
      key = event.key === ' ' ? 'Space' : event.key;
      // A typed symbol such as "?" already contains Shift; keep the spec layout-friendly.
      shiftImplied = true;
    } else key = event.key;
    const mods: string[] = [];
    if (isMac ? event.metaKey : event.ctrlKey) mods.push('Mod');
    if (isMac && event.ctrlKey) mods.push('Ctrl');
    if (event.altKey) mods.push('Alt');
    if (event.shiftKey && !shiftImplied) mods.push('Shift');
    return KeySpec.normalizeCombo([...mods, key].join('+'));
  }

  static steps(spec: string): string[] {
    const normalized = KeySpec.normalize(spec);
    return normalized ? normalized.split(' ') : [];
  }

  /** True when the combo has Mod, Ctrl or Alt (usable while typing in a text field). */
  static hasCommandModifier(combo: string): boolean {
    return /(^|\+)(Mod|Ctrl|Alt)\+/.test(combo);
  }

  /** Two specs clash when equal or when one is the start of the other (the longer could never fire). */
  static clashes(a: string, b: string): boolean {
    const x = KeySpec.steps(a);
    const y = KeySpec.steps(b);
    if (!x.length || !y.length) return false;
    const shorter = x.length <= y.length ? x : y;
    const longer = shorter === x ? y : x;
    return shorter.every((step, i) => longer[i] === step);
  }

  /** Display labels per step and key, e.g. "Mod+K" → [["Strg", "K"]], "g k" → [["G"], ["K"]]. */
  static labels(spec: string, isMac: boolean): string[][] {
    return KeySpec.steps(spec).map((step) =>
      step.split('+').map((part) => {
        if (part === 'Mod') return isMac ? 'Cmd' : 'Strg';
        if (part === 'Alt') return isMac ? 'Option' : 'Alt';
        if (part === 'Ctrl') return 'Ctrl';
        if (part === 'Shift') return 'Shift';
        if (part === 'Space') return KEY_LABELS[' '];
        return KEY_LABELS[part] ?? part;
      }),
    );
  }

  /** Readable text, e.g. "G, dann K" or "Strg + K". */
  static text(spec: string, isMac: boolean): string {
    return KeySpec.labels(spec, isMac)
      .map((parts) => parts.join(' + '))
      .join(', dann ');
  }

  private static normalizeCombo(combo: string): string {
    // "+" itself as a key ("Shift++") is not supported; such specs come out empty.
    const parts = combo.split('+').filter(Boolean);
    if (!parts.length) return '';
    const key = parts[parts.length - 1];
    const mods = new Set(parts.slice(0, -1).map((m) => KeySpec.modifier(m)).filter((m): m is (typeof MODIFIER_ORDER)[number] => !!m));
    const keyName = key.length === 1 ? key.toUpperCase() : KeySpec.namedKey(key);
    if (!keyName) return '';
    return [...MODIFIER_ORDER.filter((m) => mods.has(m)), keyName].join('+');
  }

  private static modifier(name: string): (typeof MODIFIER_ORDER)[number] | null {
    const lower = name.toLowerCase();
    if (lower === 'mod' || lower === 'cmd' || lower === 'meta') return 'Mod';
    if (lower === 'ctrl' || lower === 'control') return 'Ctrl';
    if (lower === 'alt' || lower === 'option') return 'Alt';
    if (lower === 'shift') return 'Shift';
    return null;
  }

  private static namedKey(key: string): string {
    const lower = key.toLowerCase();
    const named: Record<string, string> = {
      esc: 'Escape',
      escape: 'Escape',
      enter: 'Enter',
      return: 'Enter',
      space: 'Space',
      tab: 'Tab',
      backspace: 'Backspace',
      delete: 'Delete',
      arrowleft: 'ArrowLeft',
      arrowright: 'ArrowRight',
      arrowup: 'ArrowUp',
      arrowdown: 'ArrowDown',
    };
    return named[lower] ?? (/^f\d{1,2}$/.test(lower) ? lower.toUpperCase() : '');
  }
}
