import { features } from './features';
import { calendarSources, errors, links, navCatalog, preferences, theme, windows } from './lib/container';

/** One-time setup before the first render. */
export function bootstrap(): void {
  theme.apply(preferences.themeOverrides());
  features.registerMessages(errors);
  features.registerLinks(links);
  features.registerWindows(windows);
  features.registerCalendarSources(calendarSources);
  features.registerNavigation(navCatalog);
}
