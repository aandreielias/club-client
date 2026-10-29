import type { LinkTarget } from './LinkResolver';

/**
 * Links that reach the app from outside (mails, e-mail notices) as paths, `<host>/app/tasks/<id>` or `<host>/app/r/<code>`, while the
 * app routes by hash: the path becomes the hash route it stands for, so the record opens after sign-in.
 */
export function deepLink(pathname: string, resolve: (link: string) => LinkTarget | null): string | null {
  const match = /^(.*\/app)(\/[^?#]+?)\/?$/.exec(pathname);
  if (!match) return null;
  const [, base, link] = match;
  const target = resolve(link);
  const hash = !target ? link : 'path' in target ? target.path : `/?open=${target.window.kind}/${encodeURIComponent(target.window.id)}`;
  return `${base}/#${hash}`;
}
