import { SHORTCUTS, type CommandId, type ShortcutContext } from '../../shortcuts';
import type { LocalStore } from '../storage/LocalStore';
import { KeySpec } from './KeySpec';

const STORE_KEY = 'shortcuts';

/** '' = deliberately unassigned. */
type Overrides = Partial<Record<CommandId, string>>;

/**
 * Effective key bindings: defaults from src/shortcuts.ts plus the user's changes (per browser).
 */
export class Keymap {
  overrides = $state<Overrides>({});

  constructor(private readonly store: LocalStore | null) {
    const stored = store?.get<Overrides>(STORE_KEY) ?? {};
    this.overrides = Object.fromEntries(Object.entries(stored).filter(([id]) => id in SHORTCUTS)) as Overrides;
  }

  /** Canonical keys of a command ('' = none). */
  keys(id: CommandId): string {
    return KeySpec.normalize(this.overrides[id] ?? SHORTCUTS[id].keys);
  }

  isCustom(id: CommandId): boolean {
    return id in this.overrides;
  }

  set(id: CommandId, keys: string): void {
    const normalized = KeySpec.normalize(keys);
    if (normalized === KeySpec.normalize(SHORTCUTS[id].keys)) this.reset(id);
    else this.save({ ...this.overrides, [id]: normalized });
  }

  clear(id: CommandId): void {
    this.set(id, '');
  }

  reset(id: CommandId): void {
    const { [id]: _removed, ...rest } = this.overrides;
    this.save(rest as Overrides);
  }

  resetAll(): void {
    this.save({});
  }

  /** Commands whose keys clash with `keys` in a context where both can be active together. */
  conflicts(id: CommandId, keys: string): CommandId[] {
    const context = SHORTCUTS[id].context;
    return (Object.keys(SHORTCUTS) as CommandId[]).filter(
      (other) => other !== id && Keymap.shareScope(context, SHORTCUTS[other].context) && KeySpec.clashes(keys, this.keys(other)),
    );
  }

  /** Commands bound to exactly this canonical spec. */
  commandsFor(spec: string): CommandId[] {
    return (Object.keys(SHORTCUTS) as CommandId[]).filter((id) => this.keys(id) === spec);
  }

  /** Commands whose spec continues after the given steps (for the "next key" hint). */
  continuations(prefix: readonly string[]): { id: CommandId; next: string }[] {
    return (Object.keys(SHORTCUTS) as CommandId[]).flatMap((id) => {
      const steps = KeySpec.steps(this.keys(id));
      return steps.length > prefix.length && prefix.every((step, i) => steps[i] === step) ? [{ id, next: steps[prefix.length] }] : [];
    });
  }

  /** Global keys are unique everywhere; other contexts only clash with themselves. */
  static shareScope(a: ShortcutContext, b: ShortcutContext): boolean {
    return a === 'global' || b === 'global' || a === b;
  }

  private save(overrides: Overrides): void {
    this.overrides = overrides;
    this.store?.set(STORE_KEY, overrides);
  }
}
