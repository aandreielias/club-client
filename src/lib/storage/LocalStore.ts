/**
 * Namespaced JSON access to localStorage. Storage can be missing or blocked (private mode, tests),
 * so every call degrades to "nothing stored" instead of throwing.
 */
export class LocalStore {
  constructor(private readonly prefix: string) {}

  get<T>(key: string): T | null {
    try {
      const raw = globalThis.localStorage?.getItem(this.prefix + key);
      return raw === null || raw === undefined ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): void {
    try {
      globalThis.localStorage?.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Storage blocked or full: the value lives only in memory.
    }
  }

  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(this.prefix + key);
    } catch {
      // Nothing stored.
    }
  }

  /** Removes every key below `subPrefix` within this store. */
  clear(subPrefix = ''): void {
    try {
      const storage = globalThis.localStorage;
      if (!storage) return;
      Object.keys(storage)
        .filter((k) => k.startsWith(this.prefix + subPrefix))
        .forEach((k) => storage.removeItem(k));
    } catch {
      // Nothing stored.
    }
  }
}
