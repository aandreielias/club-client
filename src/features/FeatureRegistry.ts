import type { ErrorMessages } from '../lib/errors/ErrorMessages';
import type { CalendarSources } from '../lib/calendar/CalendarSources';
import type { CalendarCategory } from '../lib/calendar/categories';
import type { HomeSections } from '../lib/home/HomeSections';
import type { LinkResolver } from '../lib/router/LinkResolver';
import type { NavCatalog } from '../lib/navigation/NavCatalog';
import { NavLayout } from '../lib/navigation/NavLayout';
import type { NavNode } from '../lib/navigation/NavTree';
import type { WindowService } from '../lib/window/WindowService.svelte';
import type { RecordActionRegistry } from '../lib/actions/RecordActions';
import type { GuestArea, Role } from '../lib/types';
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
  /** Entries of a group (two or more: tabs and subgroups), shown as a collapsible section. */
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

  /** Routes the member may open; guests (`guestAreas` not null) only those marked `guest` for all or one of their areas. */
  allowed(hasRole: (...roles: readonly Role[]) => boolean, guestAreas: readonly GuestArea[] | null = null): FeatureRoute[] {
    return this.routes.filter((r) =>
      guestAreas ? r.guest === true || (!!r.guest && guestAreas.includes(r.guest)) : (!r.roles || hasRole(...r.roles)) && (!r.visible || r.visible()),
    );
  }

  /** Sidebar rows; main rows follow the user's `order` (row keys) and are grouped, footer entries come last. */
  navigation(allowed: readonly FeatureRoute[], order: readonly string[] = []): NavItem[] {
    const items = allowed.flatMap((r): NavItem[] => {
      if (!r.nav) return [];
      const badge = r.badge?.() ?? 0;
      return [
        {
          key: r.path,
          path: r.path,
          label: r.nav,
          ...(r.icon ? { icon: r.icon } : {}),
          ...(badge > 0 ? { badge } : {}),
          ...(r.navFooter ? { footer: true } : {}),
        },
      ];
    });
    const toItem = (node: NavNode<NavItem>): NavItem => {
      if ('leaf' in node) return node.leaf;
      const children = node.children.map(toItem);
      const badge = children.reduce((sum, c) => sum + (c.badge ?? 0), 0);
      return {
        key: NavLayout.groupKey(node.group.id),
        path: children[0].path,
        label: node.group.label,
        icon: node.group.icon,
        ...(badge > 0 ? { badge } : {}),
        children,
      };
    };
    const main = this.layout
      .arrange(
        items.filter((i) => !i.footer),
        order,
      )
      .map((row): NavItem => ({ ...toItem(row.node), key: row.key }));
    return [...main, ...items.filter((i) => i.footer)];
  }

  /** Main sidebar entries for the reorder setting. */
  registerNavigation(catalog: NavCatalog): void {
    catalog.set(
      this.routes.filter((r) => r.nav && !r.navFooter).map((r) => ({ path: r.path, label: r.nav!, roles: r.roles })),
      this.layout,
    );
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

  registerActions(actions: RecordActionRegistry): void {
    for (const feature of this.features) {
      for (const [kind, provider] of Object.entries(feature.actions ?? {})) actions.register(kind, provider);
    }
  }

  registerCalendarSources(sources: CalendarSources): void {
    for (const feature of this.features) {
      for (const [category, style] of Object.entries(feature.calendar ?? {})) sources.style(category as CalendarCategory, style);
    }
  }

  registerHome(sections: HomeSections): void {
    for (const feature of this.features) for (const section of [feature.home ?? []].flat()) sections.register(section);
  }

  /** Starts every feature's session work; the returned function stops all of it. */
  start(guest: boolean): () => void {
    const stops = this.features.map((f) => f.start?.(guest)).filter((stop): stop is () => void => typeof stop === 'function');
    return () => stops.forEach((stop) => stop());
  }
}
