// Estructura de navegación del dashboard (solo estructura + iconos).
// Los TEXTOS salen de i18n: dashboard.nav.groups.<id>, dashboard.nav.items.<tab>
// y dashboard.meta.<key>. Cada `tab` coincide con los valores de activeTab.
import {
  Ticket, Users, SlidersHorizontal, ScrollText, Globe, Trash2,
  Pencil, LogIn, LogOut, Settings, Type, Plug, LayoutGrid, SlidersVertical, ShieldCheck, Zap, UsersRound,
  UserCog, UserPlus, MousePointerClick, ShieldAlert, Gavel, ListChecks, History, KeyRound, Smile, TrendingUp, Bot,
  ShieldCheck as ShieldCheckIcon, UserCheck, Flag, DatabaseBackup,
  Sparkles, MessagesSquare, LayoutTemplate, Megaphone,
} from 'lucide-react';

export const navGroups = [
  {
    id: 'tickets',
    icon: Ticket,
    items: [
      { tab: 'tickets-gestion', icon: LayoutGrid },
      { tab: 'tickets-usuarios', icon: Users },
      { tab: 'tickets-config', icon: SlidersHorizontal },
    ],
  },
  {
    id: 'logs',
    icon: ScrollText,
    items: [
      { tab: 'logs-todos', icon: Globe },
      { tab: 'logs-tickets', icon: Ticket },
      { tab: 'logs-borrados', icon: Trash2 },
      { tab: 'logs-editados', icon: Pencil },
      { tab: 'logs-entradas', icon: LogIn },
      { tab: 'logs-salidas', icon: LogOut },
    ],
  },
  {
    id: 'roles',
    icon: UsersRound,
    items: [
      { tab: 'roles-gestion', icon: UserCog },
      { tab: 'roles-autorol', icon: UserPlus },
      { tab: 'roles-paneles', icon: MousePointerClick },
    ],
  },
  {
    id: 'moderacion',
    icon: ShieldAlert,
    items: [
      { tab: 'mod-centro', icon: Gavel },
      { tab: 'mod-tipos', icon: ListChecks },
      { tab: 'mod-automod', icon: Bot },
      { tab: 'mod-reportes', icon: Flag },
      { tab: 'mod-registro', icon: History },
    ],
  },
  {
    id: 'seguridad',
    icon: ShieldCheckIcon,
    items: [
      { tab: 'seg-verificacion', icon: UserCheck },
      { tab: 'seg-reportes', icon: Flag },
      { tab: 'seg-backup', icon: DatabaseBackup },
    ],
  },
  {
    id: 'productividad',
    icon: Sparkles,
    items: [
      { tab: 'prod-autorespuestas', icon: MessagesSquare },
      { tab: 'prod-embeds', icon: LayoutTemplate },
      { tab: 'prod-anuncios', icon: Megaphone },
    ],
  },
  {
    id: 'config',
    icon: Settings,
    items: [
      { tab: 'config-comportamiento', icon: SlidersVertical },
      { tab: 'config-reglas', icon: ShieldCheck },
      { tab: 'config-acceso', icon: KeyRound },
      { tab: 'config-expresiones', icon: Smile },
      { tab: 'config-niveles', icon: TrendingUp },
      { tab: 'config-macros', icon: Zap },
      { tab: 'config-textos', icon: Type },
      { tab: 'config', icon: Plug },
    ],
  },
];

// Clave de i18n para el título/subtítulo del header según la pestaña activa.
// Los logs (logs-todos, logs-tickets…) comparten la misma cabecera "logs".
export const metaKey = (tab) => (tab.startsWith('logs') ? 'logs' : tab);
