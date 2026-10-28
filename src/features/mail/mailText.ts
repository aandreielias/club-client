// Club records linked into a mail (server: mail.application.MailRefs). The server writes them as links to
// `<website>/app/records/task/<id>` (or `club:task/<id>` without a website); in the plain-text copy as `„Titel“ (<link>)`.
// The reader opens them in the window.

/** A piece of a mail text: plain text, or a linked record (window kind and id, files `folderId:fileId`). */
export type MailSegment = { text: string } | { title: string; kind: string; id: string };

// Server ids are UUIDs; the mock's are short words.
const ID = '[\\w-]{1,64}';
const LINK = `(?:https?://[^\\s()]+?/app/records/|club:)([a-z]+)/(${ID}(?::${ID})?)`;
const WRITTEN = new RegExp(`„([^“\\n]*)“ \\(${LINK}\\)`, 'g');
const HREF = new RegExp(`^${LINK}$`);

/** The window a record link of a formatted mail opens, or null for other links. */
export function recordTarget(href: string): { kind: string; id: string } | null {
  const match = HREF.exec(href);
  return match ? { kind: match[1], id: match[2] } : null;
}

/** The text with its written-out record links as separate segments, in order. */
export function mailSegments(body: string): MailSegment[] {
  const segments: MailSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(WRITTEN)) {
    if (match.index > last) segments.push({ text: body.slice(last, match.index) });
    segments.push({ title: match[1], kind: match[2], id: match[3] });
    last = match.index + match[0].length;
  }
  if (last < body.length) segments.push({ text: body.slice(last) });
  return segments;
}
