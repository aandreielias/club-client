/**
 * The app's icon set in one place: name → Lucide icon. Components use `<Icon name="..." />`, never a
 * Lucide import, so the set stays small, consistent and swappable. Only add icons that carry meaning.
 */
import AppWindow from '@lucide/svelte/icons/app-window';
import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
import Bell from '@lucide/svelte/icons/bell';
import BookUser from '@lucide/svelte/icons/book-user';
import Calendar from '@lucide/svelte/icons/calendar';
import Check from '@lucide/svelte/icons/check';
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import ChevronLeft from '@lucide/svelte/icons/chevron-left';
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import CircleAlert from '@lucide/svelte/icons/circle-alert';
import Command from '@lucide/svelte/icons/command';
import Copy from '@lucide/svelte/icons/copy';
import Download from '@lucide/svelte/icons/download';
import ExternalLink from '@lucide/svelte/icons/external-link';
import FileText from '@lucide/svelte/icons/file-text';
import Folder from '@lucide/svelte/icons/folder';
import FolderInput from '@lucide/svelte/icons/folder-input';
import House from '@lucide/svelte/icons/house';
import Inbox from '@lucide/svelte/icons/inbox';
import ListChecks from '@lucide/svelte/icons/list-checks';
import LogOut from '@lucide/svelte/icons/log-out';
import Menu from '@lucide/svelte/icons/menu';
import Package from '@lucide/svelte/icons/package';
import PanelBottom from '@lucide/svelte/icons/panel-bottom';
import PanelLeft from '@lucide/svelte/icons/panel-left';
import PanelRight from '@lucide/svelte/icons/panel-right';
import Pencil from '@lucide/svelte/icons/pencil';
import Plus from '@lucide/svelte/icons/plus';
import Search from '@lucide/svelte/icons/search';
import Settings from '@lucide/svelte/icons/settings';
import Trash from '@lucide/svelte/icons/trash-2';
import UserRound from '@lucide/svelte/icons/user-round';
import Users from '@lucide/svelte/icons/users';
import X from '@lucide/svelte/icons/x';

export const ICONS = {
  home: House,
  calendar: Calendar,
  tasks: ListChecks,
  files: Folder,
  move: FolderInput,
  inventory: Package,
  teams: Users,
  notifications: Bell,
  members: BookUser,
  account: UserRound,
  settings: Settings,
  search: Search,
  commands: Command,
  logout: LogOut,
  menu: Menu,
  add: Plus,
  edit: Pencil,
  delete: Trash,
  close: X,
  back: ChevronLeft,
  next: ChevronRight,
  expand: ChevronDown,
  sort: ArrowUpDown,
  check: Check,
  alert: CircleAlert,
  empty: Inbox,
  copy: Copy,
  download: Download,
  document: FileText,
  page: ExternalLink,
  dockCenter: AppWindow,
  dockSide: PanelRight,
  dockBottom: PanelBottom,
  sidebar: PanelLeft,
} as const;

export type IconName = keyof typeof ICONS;
