/**
 * A record looked up by a key that comes from other reactive data (e.g. the place linked to an appointment).
 * Fetches again only when the key changes, not on every reload of the data around it; an older answer never
 * replaces a newer one. `value` is null without a key, while loading and when the lookup fails.
 * Create it while a component initialises (it runs an effect).
 */
export class Lookup<T> {
  value = $state.raw<T | null>(null);

  constructor(key: () => string | null | undefined, fetch: (key: string) => Promise<T>) {
    const current = $derived(key());
    $effect(() => {
      this.value = null;
      let latest = true;
      if (current)
        fetch(current).then(
          (found) => latest && (this.value = found),
          () => {},
        );
      return () => (latest = false);
    });
  }
}
