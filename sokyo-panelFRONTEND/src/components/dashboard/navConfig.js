// Estructura de navegación del panel (solo estructura, iconos y palabras clave).
// Los TEXTOS salen de i18n: dashboard.nav.sections.<id>, dashboard.nav.groups.<id>,
// dashboard.nav.groupDesc.<id>, dashboard.nav.items.<tab> y dashboard.meta.<key>.
// Cada `tab` coincide con los valores de activeTab (y con la URL #dashboard/<tab>).
//
// Orden pensado para que nadie se pierda: primero lo del día a día (tickets y
// moderación), luego todo lo que hace la comunidad (llegada, roles, actividades,
// crecimiento, música, mensajes) y al final la administración (datos y ajustes).
//
// `area` = el área de permisos de "Acceso y permisos" que da acceso a ese ítem
// (las mismas claves que el backend: api/server.js → AREAS). Sin `area`, lo ve
// todo el staff. `kw` = sinónimos para el buscador (español e inglés).
import {
  Ticket, Inbox, Users, SlidersHorizontal, ShieldAlert, Gavel, Bot, Flag, History, ListChecks,
  DoorOpen, UserCheck, Sparkles, UserPlus, UsersRound, UserCog, MousePointerClick,
  PartyPopper, TrendingUp, Gift, CalendarDays, BarChart2, Lightbulb, ClipboardList, Gamepad2,
  Rocket, Send, ChevronsUp, Globe2, Radio, Music, Mic2, Megaphone, LayoutTemplate, MessagesSquare,
  BarChart3, Mail, ScrollText, Settings, FolderTree, Smile, KeyRound, Type, DatabaseBackup, Crown, Smartphone, CircleUserRound,
  Stethoscope, FileClock, Cake, ClipboardCheck, Star, Shield, MessageSquareHeart, Moon, Pin, Hash, Dices,
} from 'lucide-react';

export const navSections = [
  { id: 'diario', groups: ['tickets', 'moderacion'] },
  { id: 'comunidad', groups: ['entrada', 'roles', 'comunidad', 'diversion', 'crecimiento', 'musica', 'mensajes'] },
  { id: 'admin', groups: ['datos', 'config', 'propietario'] },
];

export const navGroups = [
  {
    id: 'tickets',
    icon: Ticket,
    color: '#60a5fa',
    items: [
      { tab: 'tickets-gestion', icon: Inbox, area: 'tickets', kw: 'tickets soporte bandeja chat responder ayuda support inbox reply' },
      { tab: 'tickets-usuarios', icon: Users, area: 'tickets', kw: 'usuarios clientes valoraciones csat satisfaccion users customers ratings' },
      { tab: 'tickets-config', icon: SlidersHorizontal, area: 'tickets', kw: 'panel de tickets categorias urgencias sla respuestas rapidas cierre transcripcion ticket settings categories priority' },
    ],
  },
  {
    id: 'moderacion',
    icon: ShieldAlert,
    color: '#f87171',
    items: [
      { tab: 'mod-miembros', icon: Users, area: 'moderacion', kw: 'miembros usuarios lista todos gente banear ban expulsar kick aislar timeout desbanear unban baneados members users people' },
      { tab: 'mod-centro', icon: Gavel, area: 'moderacion', kw: 'sancionar ban expulsar kick aislar timeout mute avisar warn buscar usuario punish' },
      { tab: 'mod-automod', icon: Bot, area: 'moderacion', kw: 'automod filtro palabras prohibidas enlaces spam menciones mayusculas insultos ia filter links' },
      { tab: 'mod-reportes', icon: Flag, area: 'moderacion', kw: 'reportes denuncias quejas report' },
      { tab: 'mod-registro', icon: History, area: 'moderacion', kw: 'historial sanciones registro auditoria bans revocar history log' },
      { tab: 'mod-tipos', icon: ListChecks, area: 'moderacion', kw: 'tipos de sancion plantillas duracion sanction types' },
    ],
  },
  {
    id: 'entrada',
    icon: DoorOpen,
    color: '#34d399',
    items: [
      { tab: 'seg-verificacion', icon: UserCheck, area: 'entrada', kw: 'verificacion captcha antibots raid nuevos verify verification' },
      { tab: 'prod-bienvenidas', icon: Sparkles, area: 'entrada', kw: 'bienvenida despedida welcome goodbye mensaje de entrada imagen' },
      { tab: 'roles-autorol', icon: UserPlus, area: 'entrada', kw: 'autorol rol automatico al entrar autorole join role' },
    ],
  },
  {
    id: 'roles',
    icon: UsersRound,
    color: '#a78bfa',
    items: [
      { tab: 'roles-gestion', icon: UserCog, area: 'roles', kw: 'roles permisos crear rol colores asignar quitar roles permissions' },
      { tab: 'roles-paneles', icon: MousePointerClick, area: 'roles', kw: 'paneles de roles reaccion botones menu autoasignar self roles reaction roles' },
    ],
  },
  {
    id: 'comunidad',
    icon: PartyPopper,
    color: '#f472b6',
    items: [
      { tab: 'com-micuenta', icon: CircleUserRound, area: 'config', kw: 'mi cuenta portal web de usuarios miembros boton abrir mi cuenta acceso /cuenta panel de usuario my account members portal button' },
      { tab: 'config-niveles', icon: TrendingUp, area: 'entrada', kw: 'niveles xp experiencia ranking rango tarjeta subir de nivel levels leaderboard rank' },
      { tab: 'com-sorteos', icon: Gift, kw: 'sorteos giveaway premios ganadores' },
      { tab: 'com-eventos', icon: CalendarDays, kw: 'eventos calendario quedadas recordatorio events' },
      { tab: 'com-encuestas', icon: BarChart2, kw: 'encuestas votaciones polls vote' },
      { tab: 'com-sugerencias', icon: Lightbulb, kw: 'sugerencias ideas votos suggestions' },
      { tab: 'com-presentaciones', icon: ClipboardList, kw: 'presentaciones formulario conocerse introductions' },
      { tab: 'com-cumpleanos', icon: Cake, kw: 'cumpleanos cumple felicitar fecha nacimiento birthday birthdays' },
      { tab: 'com-solicitudes', icon: ClipboardCheck, area: 'roles', kw: 'solicitudes postulaciones formulario entrar al staff moderador candidatos aplicar applications apply staff form' },
    ],
  },
  {
    id: 'diversion',
    icon: Dices,
    color: '#fb923c',
    items: [
      { tab: 'com-dinamicas', icon: Gamepad2, kw: 'dinamicas juegos trivia reto diario racha minijuegos games' },
      { tab: 'com-grupos', icon: Users, kw: 'buscar grupo jugar partida equipo gente lfg looking for group party' },
      { tab: 'com-clanes', icon: Shield, kw: 'clanes clan equipos competicion semanal puntos ranking teams' },
      { tab: 'com-salon', icon: Star, kw: 'salon de la fama estrellas destacados mejores mensajes starboard hall of fame' },
      { tab: 'com-confesiones', icon: MessageSquareHeart, kw: 'confesiones anonimo anonimas secretos confess confessions anonymous' },
    ],
  },
  {
    id: 'crecimiento',
    icon: Rocket,
    color: '#fbbf24',
    items: [
      { tab: 'crec-invitaciones', icon: Send, area: 'crecimiento', kw: 'invitaciones invites quien invito recompensas invitar' },
      { tab: 'crec-bump', icon: ChevronsUp, area: 'crecimiento', kw: 'bump disboard recordatorio' },
      { tab: 'crec-pagina', icon: Globe2, area: 'crecimiento', kw: 'pagina publica web directorio servidores landing public page' },
      { tab: 'crec-directos', icon: Radio, area: 'crecimiento', kw: 'directos twitch youtube kick reddit rss noticias blog streams videos alertas live feed' },
      { tab: 'crec-contadores', icon: Hash, area: 'crecimiento', kw: 'contadores estadisticas canal nombre miembros cuantos somos counter stats channel member count' },
    ],
  },
  {
    id: 'musica',
    icon: Music,
    color: '#ec4899',
    items: [
      { tab: 'musica', icon: Music, area: 'musica', kw: 'musica reproductor canciones dj cola spotify youtube music player' },
      { tab: 'voz-temporal', icon: Mic2, kw: 'voz temporal salas privadas canales de voz crear sala temp voice' },
    ],
  },
  {
    id: 'mensajes',
    icon: Megaphone,
    color: '#22d3ee',
    items: [
      { tab: 'prod-anuncios', icon: Megaphone, area: 'mensajes', kw: 'anuncios programados repetir publicar announcements schedule' },
      { tab: 'prod-embeds', icon: LayoutTemplate, kw: 'embeds creador de mensajes plantillas embed builder' },
      { tab: 'prod-autorespuestas', icon: MessagesSquare, area: 'mensajes', kw: 'auto respuestas faq respuestas automaticas palabras clave autoresponder' },
      { tab: 'prod-fijos', icon: Pin, area: 'mensajes', kw: 'mensaje fijo abajo siempre visible normas pegado sticky pinned message' },
      { tab: 'prod-ausente', icon: Moon, kw: 'ausente afk fuera no estoy mencion traducir traductor idioma translate away' },
    ],
  },
  {
    id: 'datos',
    icon: BarChart3,
    color: '#818cf8',
    items: [
      { tab: 'datos-analitica', icon: BarChart3, area: 'datos', premium: true, kw: 'analitica estadisticas graficas metricas analytics stats' },
      { tab: 'datos-resumen', icon: Mail, area: 'datos', premium: true, kw: 'resumen diario parte informe md daily report' },
      { tab: 'logs-todos', icon: ScrollText, area: 'logs', kw: 'logs registro eventos mensajes borrados editados entradas salidas auditoria audit' },
    ],
  },
  {
    id: 'config',
    icon: Settings,
    color: '#94a3b8',
    items: [
      { tab: 'config-diagnostico', icon: Stethoscope, kw: 'diagnostico por que no funciona no va error fallo problema permisos arreglar ayuda roto troubleshoot not working broken fix diagnose' },
      { tab: 'config-canales', icon: FolderTree, area: 'config', kw: 'canales categorias crear canal voz texto foro channels categories' },
      { tab: 'config-expresiones', icon: Smile, area: 'config', kw: 'emojis stickers expresiones' },
      { tab: 'config-acceso', icon: KeyRound, area: 'config', kw: 'acceso permisos staff quien entra al panel roles del panel access permissions' },
      { tab: 'config-textos', icon: Type, area: 'config', kw: 'comandos prefijo idioma textos marca blanca commands prefix language' },
      { tab: 'config-cambios', icon: FileClock, area: 'config', kw: 'historial de cambios quien cambio deshacer volver atras restaurar como estaba auditoria change history undo revert who changed' },
      { tab: 'seg-backup', icon: DatabaseBackup, area: 'config', premium: true, kw: 'copia de seguridad backup exportar importar' },
      { tab: 'cuenta-plan', icon: Crown, area: 'cuenta', kw: 'plan premium pro suscripcion pagar factura precio billing subscription' },
      { tab: 'config-app', icon: Smartphone, kw: 'app movil android apk iphone ipad ios descargar instalar telefono celular mobile phone download install' },
    ],
  },
  {
    // SOLO PROPIETARIOS DEL BOT (OWNER_IDS). El menú lo oculta a los demás.
    id: 'propietario',
    icon: Crown,
    color: '#f59e0b',
    owner: true,
    items: [
      { tab: 'owner-subs', icon: Crown, kw: 'suscripciones servidores propietario owner' },
    ],
  },
];

// Pestañas que comparten la entrada de otra en el menú (los filtros del registro).
const ALIAS = { 'seg-reportes': 'mod-reportes' };
export const tabDeMenu = (tab) => (tab && tab.startsWith('logs-') ? 'logs-todos' : (ALIAS[tab] || tab));

// Grupo e ítem del menú de una pestaña (para la ruta "Grupo › Sección").
export function ubicacion(tab) {
  const t = tabDeMenu(tab);
  for (const g of navGroups) {
    const item = g.items.find((it) => it.tab === t);
    if (item) return { group: g, item };
  }
  return null;
}

// ¿Puede ver este ítem? Propietario: todo. Si no, según su área de permisos.
export const itemVisible = (item, permisos) => !item.area || !permisos || permisos[item.area] !== false;

// ¿Está bloqueado por el plan? (función de pago en un servidor Free; el propietario lo ve todo).
export const bloqueadoPorPlan = (item, esPremium, esOwner) => !!item.premium && !esPremium && !esOwner;

// Grupos visibles con solo los ítems a los que se tiene acceso (los vacíos fuera).
export function gruposVisibles(permisos, esOwner) {
  return navGroups
    .filter((g) => !g.owner || esOwner)
    .map((g) => ({ ...g, items: g.items.filter((it) => itemVisible(it, permisos)) }))
    .filter((g) => g.items.length > 0);
}

// Clave de i18n para el título/subtítulo del header según la pestaña activa.
// Los logs (logs-todos, logs-tickets…) comparten la misma cabecera "logs".
export const metaKey = (tab) => (tab.startsWith('logs') ? 'logs' : tab);

// Texto sin tildes y en minúsculas, para buscar "musica" y encontrar "Música".
export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
