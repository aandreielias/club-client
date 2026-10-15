import type { FileLinks } from './FileLinks';
import type { StoredFile } from './model';

/** Starts a browser download of a stored file through its short-lived link. */
export class FileDownloads {
  constructor(private readonly links: FileLinks) {}

  async download(file: StoredFile): Promise<void> {
    const url = await this.links.url(file.id);
    const anchor = document.createElement('a');
    anchor.href = url;
    // Honoured for same-origin/blob links; presigned server links carry their own disposition.
    anchor.download = file.name;
    anchor.rel = 'noopener';
    anchor.target = '_blank';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }
}
