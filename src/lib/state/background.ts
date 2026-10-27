/**
 * Runs a load the page does not depend on (prefetching teams for a picker, a live reload): a failure stays quiet, since the page
 * works without it and the next load tries again. User actions go through `Action`, which shows the error.
 */
export function background(load: Promise<unknown>): void {
  load.catch(() => {});
}
