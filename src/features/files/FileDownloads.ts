import { openTab } from '../../lib/window/openTab';
import type { FileLinks } from './FileLinks';
import type { StoredFile } from './model';

/** Starts a browser download of a stored file through its short-lived link. */
export class FileDownloads {
  constructor(private readonly links: FileLinks) {}

  /** Presigned server links (own disposition) open in a tab opened inside the click; blob links (mock) download by name. */
  async download(file: StoredFile): Promise<void> {
    let blobUrl: string | null = null;
    await openTab(this.links.url(file.id).then((url) => (url.startsWith('blob:') ? ((blobUrl = url), null) : url)));
    if (!blobUrl) return;
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = file.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }
}
