// Estructura de navegación del dashboard (solo estructura + iconos).
// Los TEXTOS salen de i18n: dashboard.nav.groups.<id>, dashboard.nav.items.<tab>
// y dashboard.meta.<key>. Cada `tab` coincide con los valores de activeTab.
import {
  Ticket, Users, SlidersHorizontal, ScrollText, Globe, Trash2,
  Pencil, LogIn, LogOut, Settings, Type, Plug, LayoutGrid, SlidersVertical, ShieldCheck, Zap, UsersRound,
  UserCog, UserPlus, MousePointerClick, ShieldAlert, Gavel, ListChecks, History, KeyRound, Smile, TrendingUp, Bot,
  UserCheck, Flag, DatabaseBackup, FlaskConical,
  Sparkles, MessagesSquare, LayoutTemplate, Megaphone, Crown, BarChart3, Mail, DoorOpen,
  Music, Webhook, Gift, CalendarDays, PartyPopper, BarChart2, Lightbulb, ClipboardList, Gamepad2, Mic2,
} from 'lucide-react';

// Estructura agrupada por el RECORRIDO del miembro (lo más intuitivo posible):
// primero la cuenta y los datos, luego la puerta de entrada y la comunidad, el
// soporte (tickets), roles, moderación, su registro (logs), los mensajes
// automáticos y, al final, la configuración fina.
export const navGroups = [
  {
    id: 'cuenta',
    icon: Crown,
    items: [
      { tab: 'cuenta-plan', icon: Crown },
    ],
  },
  {
    id: 'datos',
    icon: BarChart3,
    items: [
      { tab: 'datos-analitica', icon: BarChart3, premium: true },
      { tab: 'datos-resumen', icon: Mail, premium: true },
    ],
  },
  {
    // NUEVO: todo lo que pasa "cuando alguien entra" vive aquí (onboarding).
    id: 'entrada',
    icon: DoorOpen,
    items: [
      { tab: 'seg-verificacion', icon: UserCheck },
      { tab: 'seg-embudo', icon: FlaskConical, premium: true },
      { tab: 'prod-bienvenidas', icon: Sparkles },
      { tab: 'roles-autorol', icon: UserPlus },
      { tab: 'config-niveles', icon: TrendingUp },
    ],
  },
  {
    id: 'comunidad',
    icon: PartyPopper,
    items: [
      { tab: 'com-sorteos', icon: Gift },
      { tab: 'com-eventos', icon: CalendarDays },
      { tab: 'com-encuestas', icon: BarChart2 },
      { tab: 'com-sugerencias', icon: Lightbulb },
      { tab: 'com-presentaciones', icon: ClipboardList },
      { tab: 'com-dinamicas', icon: Gamepad2 },
    ],
  },
  {
    id: 'musica',
    icon: Music,
    items: [
      { tab: 'musica', icon: Music },
      { tab: 'voz-temporal', icon: Mic2 },
    ],
  },
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
    id: 'roles',
    icon: UsersRound,
    items: [
      { tab: 'roles-gestion', icon: UserCog },
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
    // Antes "Productividad": los mensajes que el bot manda solo.
    id: 'mensajes',
    icon: MessagesSquare,
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
      { tab: 'config-macros', icon: Zap },
      { tab: 'config-textos', icon: Type },
      { tab: 'config-webhooks', icon: Webhook, premium: true },
      { tab: 'seg-backup', icon: DatabaseBackup, premium: true },
      { tab: 'config', icon: Plug },
    ],
  },
];

// Clave de i18n para el título/subtítulo del header según la pestaña activa.
// Los logs (logs-todos, logs-tickets…) comparten la misma cabecera "logs".
export const metaKey = (tab) => (tab.startsWith('logs') ? 'logs' : tab);
