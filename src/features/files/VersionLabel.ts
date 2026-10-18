/** Suggests the next version label: "1.2" → "1.3", "2" → "3", "v1.9" → "v1.10"; null when it has no number. */
export function nextVersion(label: string | null): string {
  if (!label) return '1.1';
  const match = /^(.*?)(\d+)(\D*)$/.exec(label.trim());
  return match ? `${match[1]}${Number(match[2]) + 1}${match[3]}` : `${label.trim()}.1`;
}
