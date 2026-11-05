/** One cell of a semicolon CSV; leading = + - @ would run as a formula in Excel (CSV injection), so they get a quote mark. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Semicolon CSV with BOM, as German Excel opens and saves it. */
export function csvText(rows: readonly (readonly string[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
