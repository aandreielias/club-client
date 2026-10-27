import type { FileLinks } from './FileLinks';
import type { FilesApi } from './FilesApi';
import type { FolderTree } from './FolderTree.svelte';
import type { Folder, StoredFile } from './model';

export interface ZipEntry {
  path: string;
  file: StoredFile;
}

/**
 * Packs files into a ZIP in the browser: a whole folder with its subfolders (paths keep the
 * structure) or a selection. Files the member cannot see are never listed, so never packed.
 */
export class FolderZip {
  constructor(
    private readonly api: FilesApi,
    private readonly links: FileLinks,
    private readonly maxBytes: number,
  ) {}

  /** One path segment: folder names are free text, and "..", "/" or "\\" would write outside the unpacked folder. */
  static segment(name: string): string {
    return name.replace(/[/\\]/g, '_').replace(/^\.+/, '').trim() || '_';
  }

  /** Every visible file below `folder`, with paths relative to it. */
  async entries(folder: Folder, tree: FolderTree): Promise<ZipEntry[]> {
    const entries: ZipEntry[] = [];
    const walk = async (current: Folder, prefix: string) => {
      for (const file of await this.api.files(current.id)) entries.push({ path: prefix + FolderZip.segment(file.name), file });
      for (const child of tree.children(current.id)) await walk(child, `${prefix}${FolderZip.segment(child.name)}/`);
    };
    await walk(folder, '');
    return entries;
  }

  async build(entries: readonly ZipEntry[], onProgress: (done: number, total: number) => void = () => {}): Promise<Blob> {
    const total = entries.reduce((sum, e) => sum + e.file.sizeBytes, 0);
    if (total > this.maxBytes) {
      throw new Error(
        `Zu groß für ein ZIP im Browser (höchstens ${Math.round(this.maxBytes / 1024 / 1024)} MB). Bitte Unterordner einzeln herunterladen.`,
      );
    }
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const used = new Set<string>();
    let done = 0;
    for (const entry of entries) {
      const response = await fetch(await this.links.url(entry.file.id));
      if (!response.ok) throw new Error(`„${entry.file.name}“ konnte nicht geladen werden.`);
      zip.file(FolderZip.uniquePath(entry.path, used), await response.blob());
      onProgress(++done, entries.length);
    }
    return zip.generateAsync({ type: 'blob' });
  }

  /** "Plan.pdf" twice → "Plan.pdf", "Plan (2).pdf". */
  static uniquePath(path: string, used: Set<string>): string {
    let candidate = path;
    const dot = path.lastIndexOf('.');
    const [base, extension] = dot > path.lastIndexOf('/') ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
    for (let n = 2; used.has(candidate.toLocaleLowerCase()); n++) candidate = `${base} (${n})${extension}`;
    used.add(candidate.toLocaleLowerCase());
    return candidate;
  }
}
