/**
 * Opens `url` in a new tab once it is known. The tab is opened right away, inside the click: browsers (Safari
 * above all) block window.open after an await, and file links are fetched first. A download closes the tab again;
 * null closes it at once (nothing to open after all).
 */
export async function openTab(url: Promise<string | null>): Promise<void> {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null; // same protection as noopener, which would hide the tab from us
  try {
    const target = await url;
    if (target === null) tab?.close();
    else if (tab) tab.location.href = target;
    else window.open(target, '_blank', 'noopener'); // popup blocker took the early tab; try the plain way
  } catch (error) {
    tab?.close();
    throw error;
  }
}
