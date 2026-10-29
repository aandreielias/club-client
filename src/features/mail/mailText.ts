// Club records linked into a mail (server: mail.application.MailRefs). The mail carries only a random code per record,
// `Verweis K7Q2M9XW4P` linking to `<website>/app/r/<code>` (or `club:r/<code>` without a website), so outside mail programs
// show nothing about it. The app asks the server what each code stands for, as the reader sees it.

import type { PickedRef } from '../../lib/records/RefList.svelte';
import type { MailRef } from './model';

/** A piece of a mail's plain text: text, or a linked record's code. */
export type MailSegment = { text: string } | { code: string };

const LINK = '(?:https?://[^\\s()]+?/app/r/|club:r/)([A-Z0-9]{10})';
const HREF = new RegExp(`^${LINK}$`);
const WRITTEN = new RegExp(`Verweis ([A-Z0-9]{10}) \\(${LINK}\\)`, 'g');
const ANY = new RegExp(LINK, 'g');

/** The code a link of a formatted mail stands for, or null for other links. */
export function refCode(href: string): string | null {
  return HREF.exec(href)?.[1] ?? null;
}

/** Every record code in a mail (formatted or plain), once each. */
export function refCodes(content: string): string[] {
  return [...new Set([...content.matchAll(ANY)].map((m) => m[1]))];
}

/** The plain text with its record links as separate segments, in order. */
export function mailSegments(body: string): MailSegment[] {
  const segments: MailSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(WRITTEN)) {
    if (match.index > last) segments.push({ text: body.slice(last, match.index) });
    segments.push({ code: match[2] });
    last = match.index + match[0].length;
  }
  if (last < body.length) segments.push({ text: body.slice(last) });
  return segments;
}

const CODE_LINK = new RegExp(`<a [^>]*href="${LINK}"[^>]*>[^<]*</a>`, 'g');
// server: MailRefs.render appends the attached records as this block (texts.properties mail.refs.heading).
const ATTACHED = /<p>Verknüpft:<\/p><ul>((?:<li>.*?<\/li>)*)<\/ul>$/;

/**
 * A saved draft back into the composer: its record codes become chips again (`<a data-ref>`) and the attached block at the end
 * becomes the attachment list. Codes the writer may no longer see stay as text.
 */
export function draftForEditor(html: string, refs: ReadonlyMap<string, MailRef>): { html: string; attached: PickedRef[] } {
  const asRef = (code: string): PickedRef | null => {
    const ref = refs.get(code);
    if (!ref?.visible) return null;
    const id = ref.kind === 'FILE' ? ref.windowId!.slice(ref.windowId!.indexOf(':') + 1) : ref.windowId!;
    return { kind: ref.kind!, id, title: ref.title! };
  };
  const attached: PickedRef[] = [];
  let text = html.replace(ATTACHED, (_, items: string) => {
    for (const [, code] of items.matchAll(ANY)) {
      const ref = asRef(code);
      if (ref) attached.push(ref);
    }
    return '';
  });
  text = text.replace(CODE_LINK, (link, code: string) => {
    const ref = asRef(code);
    const escaped = ref?.title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return ref ? `<a data-ref="${ref.kind.toLowerCase()}:${ref.id}">${escaped}</a>` : `Verweis ${code}`;
  });
  return { html: text, attached };
}
