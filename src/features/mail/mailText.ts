// Club records linked into a mail (server: mail.application.MailRefs). The composer writes `[Titel](club:task/<id>)` where a record
// was dropped; the server checks it and writes `„Titel“ (<website>/app/records/task/<id>)` (or `club:task/<id>` without a
// website), which the reader turns back into links.

import type { PickedRef } from '../../lib/records/RefList.svelte';

/** A piece of a mail text: plain text, or a linked record (window kind and id, files `folderId:fileId`). */
export type MailSegment = { text: string } | { title: string; kind: string; id: string };

// Server ids are UUIDs; the mock's are short words.
const ID = '[\\w-]{1,64}';
const WRITTEN = new RegExp(`„([^“\\n]*)“ \\((?:https?://[^\\s()]+?/app/records/|club:)([a-z]+)/(${ID}(?::${ID})?)\\)`, 'g');

/** The marker the composer puts into the text where a record goes; the server replaces it. */
export function mailToken(ref: PickedRef): string {
  return `[${ref.title.replace(/[[\]\n]/g, ' ').trim()}](club:${ref.kind.toLowerCase()}/${ref.id})`;
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
