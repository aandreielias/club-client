/** Hands content the app produced (exports) to the browser as a file download. */
export class BrowserFile {
  static save(content: Blob, name: string): void {
    const url = URL.createObjectURL(content);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Revoke after the click was handled; the download keeps its own copy.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
