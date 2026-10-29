/** A multiple choice with one value switched (on when off, off when on); the order of `options` is kept. */
export function toggled<T>(values: readonly T[], value: T, options: readonly T[]): T[] {
  const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  return options.filter((o) => next.includes(o));
}
