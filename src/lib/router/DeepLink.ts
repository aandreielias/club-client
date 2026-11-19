import type { LinkTarget } from './LinkResolver';

/**
 * Links that reach the app from outside (mails, e-mail notices) as paths, `<app>/tasks/<id>` or `<app>/r/<code>`, while the app routes
 * by hash: the path becomes the hash route it stands for, so the record opens after sign-in. The host serves index.html for every path.
 * `base` is where the app lives (`/`, or `/<repo>/` on GitHub Pages).
 */
export function deepLink(pathname: string, resolve: (link: string) => LinkTarget | null, base = '/'): string | null {
  if (!pathname.startsWith(base)) return null;
  const link = pathname.slice(base.length - 1).replace(/\/+$/, '');
  if (!link || link === '/index.html') return null;
  const target = resolve(link);
  const hash = !target ? link : 'path' in target ? target.path : `/?open=${target.window.kind}/${encodeURIComponent(target.window.id)}`;
  return `${base}#${hash}`;
}
