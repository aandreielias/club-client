import { downloadLink } from '../../lib/window/openTab';
import type { FileLinks } from './FileLinks';
import type { StoredFile } from './model';

/** Starts a browser download of a stored file through its short-lived link. */
export class FileDownloads {
  constructor(private readonly links: FileLinks) {}

  download(file: StoredFile): Promise<void> {
    return downloadLink(this.links.url(file.id), file.name);
  }
}
