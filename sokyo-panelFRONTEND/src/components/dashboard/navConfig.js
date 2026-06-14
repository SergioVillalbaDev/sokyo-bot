// Estructura de navegación del dashboard. Cada "tab" coincide EXACTAMENTE con
// los valores de activeTab que espera la lógica (useDashboard).
import {
  Ticket, Users, SlidersHorizontal, ScrollText, Globe, Trash2,
  Pencil, LogIn, LogOut, Settings, Type, Plug, LayoutGrid,
} from 'lucide-react';

export const navGroups = [
  {
    id: 'tickets',
    label: 'Sistema de Tickets',
    icon: Ticket,
    items: [
      { tab: 'tickets-gestion', label: 'Gestión', icon: LayoutGrid },
      { tab: 'tickets-usuarios', label: 'Registro de usuarios', icon: Users },
      { tab: 'tickets-config', label: 'Ajustes de Incidencias', icon: SlidersHorizontal },
    ],
  },
  {
    id: 'logs',
    label: 'Logs del Bot',
    icon: ScrollText,
    items: [
      { tab: 'logs-todos', label: 'Todos los eventos', icon: Globe },
      { tab: 'logs-tickets', label: 'Actividad de Tickets', icon: Ticket },
      { tab: 'logs-borrados', label: 'Mensajes Eliminados', icon: Trash2 },
      { tab: 'logs-editados', label: 'Mensajes Editados', icon: Pencil },
      { tab: 'logs-entradas', label: 'Entradas al Servidor', icon: LogIn },
      { tab: 'logs-salidas', label: 'Salidas del Servidor', icon: LogOut },
    ],
  },
  {
    id: 'config',
    label: 'Configuración',
    icon: Settings,
    items: [
      { tab: 'config-textos', label: 'Configuración de Textos', icon: Type },
      { tab: 'config', label: 'Módulos del Bot', icon: Plug },
    ],
  },
];

// Título + subtítulo del header según la pestaña activa.
export const tabMeta = {
  'inicio': { title: 'Inicio', subtitle: 'Resumen de tu sistema de soporte.' },
  'tickets-gestion': { title: 'Gestión de Tickets', subtitle: 'Administra las solicitudes activas de tu servidor.' },
  'tickets-usuarios': { title: 'Registro de Usuarios', subtitle: 'Estadísticas y recuento global de los usuarios en tu servidor.' },
  'tickets-config': { title: 'Ajustes de Incidencias', subtitle: 'Configura las reglas, prioridades y motivos de los tickets.' },
  'config-textos': { title: 'Configuración de Textos', subtitle: 'Personaliza los títulos y descripciones de marca blanca para el bot.' },
  'config': { title: 'Configuración General', subtitle: 'Activa o desactiva módulos globales del bot.' },
};

export const metaForTab = (tab) => {
  if (tab.startsWith('logs')) return { title: 'Registro de Auditoría', subtitle: 'Supervisa el funcionamiento interno y eventos clave del servidor.' };
  return tabMeta[tab] || { title: 'Panel', subtitle: '' };
};
