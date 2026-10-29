/**
 * Saves a new order of records that keep a `sort` number: positions become 10, 20, 30 …, and only records whose number changes are
 * written (one request each). Archived records keep theirs.
 */
export async function saveOrder<T extends { key: string; sort: number }>(
  keys: readonly string[],
  records: readonly T[],
  save: (record: T, sort: number) => Promise<unknown>,
): Promise<void> {
  const writes = keys
    .map((key, index) => ({ record: records.find((r) => r.key === key), sort: (index + 1) * 10 }))
    .filter((w): w is { record: T; sort: number } => !!w.record && w.record.sort !== w.sort);
  for (const write of writes) await save(write.record, write.sort);
}
