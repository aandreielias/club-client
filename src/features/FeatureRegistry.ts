import type { ErrorMessages } from '../lib/errors/ErrorMessages';
import type { CalendarSources } from '../lib/calendar/CalendarSources';
import type { HomeSections } from '../lib/home/HomeSections';
import type { LinkResolver } from '../lib/router/LinkResolver';
import type { NavCatalog } from '../lib/navigation/NavCatalog';
import { NavLayout } from '../lib/navigation/NavLayout';
import type { WindowService } from '../lib/window/WindowService.svelte';
import type { Role } from '../lib/types';
import type { Feature, FeatureRoute } from './Feature';
import type { IconName } from '../icons';

export interface NavItem {
  /** Row key for ordering and rendering: the path, or `group:<id>` (see NavLayout). */
  key: string;
  /** For a group: its first tab. */
  path: string;
  label: string;
  icon?: IconName;
  /** e.g. unread count; omitted when zero. */
  badge?: number;
  /** Bottom of the sidebar instead of the main list. */
  footer?: boolean;
  /** Tabs of a group row (two or more), shown in its flyout. */
  children?: NavItem[];
}

/** Holds the enabled features and answers routing/navigation questions for the shell. */
export class FeatureRegistry {
  readonly routes: readonly FeatureRoute[];

  constructor(
    readonly features: readonly Feature[],
    readonly layout: NavLayout = new NavLayout(),
  ) {
    const ids = new Set<string>();
    for (const feature of features) {
      if (ids.has(feature.id)) throw new Error(`Duplicate feature id "${feature.id}"`);
      ids.add(feature.id);
    }
    this.routes = features.flatMap((f) => f.routes);
  }

  /** Routes the member may open; tournament guests only those marked `guest`. */
  allowed(hasRole: (...roles: readonly Role[]) => boolean, guest = false): FeatureRoute[] {
    return this.routes.filter((r) => (guest ? !!r.guest : !r.roles || hasRole(...r.roles)));
  }

  /** Sidebar rows; main rows follow the user's `order` (row keys) and are grouped, footer entries come last. */
  navigation(allowed: readonly FeatureRoute[], order: readonly string[] = []): NavItem[] {
    const items = allowed.flatMap((r): NavItem[] => {
      if (!r.nav) return [];
      const badge = r.badge?.() ?? 0;
      return [{ key: r.path, path: r.path, label: r.nav, ...(r.icon ? { icon: r.icon } : {}), ...(badge > 0 ? { badge } : {}), ...(r.navFooter ? { footer: true } : {}) }];
    });
    const main = this.layout.arrange(items.filter((i) => !i.footer), order).map((row): NavItem => {
      if (!row.group) return { ...row.entries[0], key: row.key };
      const badge = row.entries.reduce((sum, e) => sum + (e.badge ?? 0), 0);
      return { key: row.key, path: row.entries[0].path, label: row.group.label, icon: row.group.icon, ...(badge > 0 ? { badge } : {}), children: row.entries };
    });
    return [...main, ...items.filter((i) => i.footer)];
  }

  /** Main sidebar entries for the reorder setting. */
  registerNavigation(catalog: NavCatalog): void {
    catalog.set(this.routes.filter((r) => r.nav && !r.navFooter).map((r) => ({ path: r.path, label: r.nav!, roles: r.roles })), this.layout);
  }

  registerMessages(errors: ErrorMessages): void {
    for (const feature of this.features) if (feature.messages) errors.register(feature.messages);
  }

  registerLinks(links: LinkResolver): void {
    for (const feature of this.features) if (feature.links) links.register(feature.links);
  }

  registerWindows(windows: WindowService): void {
    for (const feature of this.features) {
      for (const [kind, content] of Object.entries(feature.windows ?? {})) windows.register(kind, content);
    }
  }

  registerCalendarSources(sources: CalendarSources): void {
    for (const feature of this.features) if (feature.calendar) sources.register(feature.calendar);
  }

  registerHome(sections: HomeSections): void {
    for (const feature of this.features) for (const section of [feature.home ?? []].flat()) sections.register(section);
  }

  /** Starts every feature's session work; the returned function stops all of it. */
  start(): () => void {
    const stops = this.features.map((f) => f.start?.()).filter((stop): stop is () => void => typeof stop === 'function');
    return () => stops.forEach((stop) => stop());
  }
}
