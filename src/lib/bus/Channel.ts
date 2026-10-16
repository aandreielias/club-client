export const DEFAULT_SEPARATOR = '/';

/** Thrown for malformed channel paths. */
export class ValidationError extends Error {
  override name = 'ValidationError';
}

/**
 * Hierarchical channel name, e.g. `domain/tasks/task-changed` (port of ae.eventbus.core.channel.Channel).
 * Immutable value object; compare with `equals` or by `toString()`.
 */
export class Channel {
  private constructor(readonly segments: readonly string[]) {}

  static of(...segments: string[]): Channel {
    if (!segments.length) throw new ValidationError('A channel needs at least one segment.');
    for (const segment of segments) {
      if (!segment.trim()) throw new ValidationError('Channel segments must not be empty.');
      if (segment.includes(DEFAULT_SEPARATOR)) throw new ValidationError(`Segment "${segment}" contains the separator.`);
    }
    return new Channel([...segments]);
  }

  static parse(path: string, separator = DEFAULT_SEPARATOR): Channel {
    const trimmed = path.trim();
    if (!trimmed) throw new ValidationError('Channel path must not be empty.');
    return Channel.of(...trimmed.split(separator));
  }

  get depth(): number {
    return this.segments.length;
  }

  get isRoot(): boolean {
    return this.segments.length === 1;
  }

  get parent(): Channel | null {
    return this.isRoot ? null : new Channel(this.segments.slice(0, -1));
  }

  /** Strict ancestor: `a` is parent of `a/b` and `a/b/c`, not of itself. */
  isParentOf(other: Channel): boolean {
    return other.depth > this.depth && this.segments.every((s, i) => other.segments[i] === s);
  }

  isChildOf(other: Channel): boolean {
    return other.isParentOf(this);
  }

  /** This channel and every ancestor, nearest first. */
  lineage(): Channel[] {
    const list: Channel[] = [];
    for (let c: Channel | null = this; c; c = c.parent) list.push(c);
    return list;
  }

  equals(other: Channel): boolean {
    return this.toString() === other.toString();
  }

  toString(separator = DEFAULT_SEPARATOR): string {
    return this.segments.join(separator);
  }
}
