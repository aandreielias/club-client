import { features } from './features';
import { calendarSources, errors, homeSections, links, navCatalog, preferences, theme, windows } from './lib/container';
import { deepLink } from './lib/router/DeepLink';

/** One-time setup before the first render. */
export function bootstrap(): void {
  theme.apply(preferences.themeOverrides());
  features.registerMessages(errors);
  features.registerLinks(links);
  features.registerWindows(windows);
  features.registerCalendarSources(calendarSources);
  features.registerHome(homeSections);
  features.registerNavigation(navCatalog);
  // A link from a mail or e-mail notice (`/app/tasks/<id>`) becomes the route it stands for.
  const hash = location.hash ? null : deepLink(location.pathname, (link) => links.resolve(link));
  if (hash) history.replaceState(null, '', hash);
}
