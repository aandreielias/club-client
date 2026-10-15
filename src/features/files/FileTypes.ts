import type { FolderKind } from './model';

interface FileTypeInfo {
  label: string;
  image: boolean;
}

/** Content types the server stores (FileType); HEIC arrives converted to JPEG. */
const TYPES: Readonly<Record<string, FileTypeInfo>> = {
  'image/jpeg': { label: 'JPEG', image: true },
  'image/png': { label: 'PNG', image: true },
  'application/pdf': { label: 'PDF', image: false },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'Word', image: false },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'Excel', image: false },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { label: 'PowerPoint', image: false },
};

/**
 * Client-side knowledge of accepted file types. Only used to guide users (picker filter, early
 * rejection by extension); the server decides by the actual content.
 */
export class FileTypes {
  constructor(
    private readonly imageExtensions: readonly string[],
    private readonly documentExtensions: readonly string[],
  ) {}

  label(contentType: string): string {
    return TYPES[contentType]?.label ?? 'Datei';
  }

  isImage(contentType: string): boolean {
    return TYPES[contentType]?.image ?? false;
  }

  /** Extensions a folder accepts, e.g. for `<input accept>`. */
  extensions(kind: FolderKind): readonly string[] {
    return kind === 'PHOTOS' ? this.imageExtensions : [...this.imageExtensions, ...this.documentExtensions];
  }

  accept(kind: FolderKind): string {
    return this.extensions(kind).join(',');
  }

  allows(kind: FolderKind, fileName: string): boolean {
    const name = fileName.toLowerCase();
    return this.extensions(kind).some((ext) => name.endsWith(ext));
  }

  /** Human-readable list for hints, e.g. "JPG, PNG, HEIC, PDF, …". */
  describe(kind: FolderKind): string {
    return [...new Set(this.extensions(kind).map((e) => (e === '.jpeg' ? '.jpg' : e === '.heif' ? '.heic' : e)))]
      .map((e) => e.slice(1).toUpperCase())
      .join(', ');
  }
}
