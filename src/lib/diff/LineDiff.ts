export type DiffKind = 'same' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

/** A run of unchanged lines folded away, or a shown line. */
export type DiffBlock = DiffLine | { kind: 'folded'; count: number };

/**
 * Line diff by longest common subsequence: lines only in `before` are removed, only in `after` added.
 * shortcut: O(n·m) memory, fine for documents up to a few thousand lines (limit in settings); a Myers diff if larger ones matter.
 */
export class LineDiff {
  static lines(before: readonly string[], after: readonly string[]): DiffLine[] {
    const n = before.length;
    const m = after.length;
    // lcs[i][j]: common lines of before[i..] and after[j..]
    const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    const out: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (before[i] === after[j]) {
        out.push({ kind: 'same', text: before[i] });
        i++;
        j++;
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
        out.push({ kind: 'removed', text: before[i++] });
      } else {
        out.push({ kind: 'added', text: after[j++] });
      }
    }
    while (i < n) out.push({ kind: 'removed', text: before[i++] });
    while (j < m) out.push({ kind: 'added', text: after[j++] });
    return out;
  }

  /** Keeps `context` unchanged lines around each change and folds longer unchanged runs. */
  static fold(lines: readonly DiffLine[], context: number): DiffBlock[] {
    const changed = lines.map((l) => l.kind !== 'same');
    const near = (index: number) => {
      for (let k = Math.max(0, index - context); k <= Math.min(lines.length - 1, index + context); k++) if (changed[k]) return true;
      return false;
    };
    const out: DiffBlock[] = [];
    let folded = 0;
    lines.forEach((line, index) => {
      if (line.kind === 'same' && !near(index)) {
        folded++;
        return;
      }
      if (folded) out.push({ kind: 'folded', count: folded });
      folded = 0;
      out.push(line);
    });
    if (folded) out.push({ kind: 'folded', count: folded });
    return out;
  }
}
