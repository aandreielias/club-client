/** server: platform.Keys.generated — the prefix and twelve random hex digits. */
export const generatedKey = (prefix: string): string => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
