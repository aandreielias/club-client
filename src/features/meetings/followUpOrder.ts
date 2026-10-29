import type { FollowUpRule } from './model';

/**
 * Editing a list of follow-ups in order; each answers the new list. With `firstMayWait` false the first one always starts with the
 * decision (a decision's own list); a motion's list may start after the decision's last one.
 */
export class FollowUpOrder {
  constructor(private readonly firstMayWait = false) {}

  /** Replaces the one at `index`, or adds it at the end. */
  put(list: readonly FollowUpRule[], index: number | null, followUp: FollowUpRule): FollowUpRule[] {
    const next = index == null ? [...list, followUp] : list.map((f, i) => (i === index ? followUp : f));
    return this.#firstStarts(next);
  }

  remove(list: readonly FollowUpRule[], index: number): FollowUpRule[] {
    return this.#firstStarts(list.filter((_, i) => i !== index));
  }

  /** Puts a removed one back at its place. */
  restore(list: readonly FollowUpRule[], index: number, followUp: FollowUpRule): FollowUpRule[] {
    const next = [...list];
    next.splice(Math.min(index, next.length), 0, followUp);
    return this.#firstStarts(next);
  }

  /** New order from the sortable list's keys (the old positions as text). */
  reorder(list: readonly FollowUpRule[], keys: readonly string[]): FollowUpRule[] {
    return this.#firstStarts(keys.map((k) => list[Number(k)]));
  }

  #firstStarts(list: FollowUpRule[]): FollowUpRule[] {
    if (this.firstMayWait || !list[0]?.afterPrevious) return list;
    return [{ ...list[0], afterPrevious: false }, ...list.slice(1)];
  }
}
