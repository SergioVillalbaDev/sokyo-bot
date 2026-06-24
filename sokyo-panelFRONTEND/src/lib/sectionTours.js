// ============================================================================
// SOKYO — MINI-TOURS POR SECCIÓN
// ----------------------------------------------------------------------------
// Para cada sección del panel, define los PASOS de su tour guiado: qué elemento
// señala cada paso (selector CSS) y por qué lado sale el popover. El texto de
// cada paso vive en i18n: dashboard.sectionTours.<seccion>.steps.<id>.{title,desc}
//
// • `sel`  : selector del elemento a resaltar. Normalmente data-help="..."
//            puesto en la vista; algunos reutilizan data-tour del tour global.
// • `id`   : identificador del paso → clave i18n.
// • `side` / `align`: posición del popover (igual que driver.js).
//
// El motor (onboarding.js → startSectionTour) descarta los pasos cuyo elemento
// no esté visible, así que es seguro listar partes que solo existen a veces.
// Las secciones sin entrada aquí caen al popover-resumen (dashboard.sectionHelp).
// ============================================================================
export const sectionTours = {
  inicio: [
    { id: 'stats', sel: '[data-tour="stats"]', side: 'bottom', align: 'start' },
    { id: 'team', sel: '[data-help="inicio-team"]', side: 'bottom', align: 'start' },
    { id: 'recientes', sel: '[data-help="inicio-recientes"]', side: 'top', align: 'start' },
    { id: 'rail', sel: '[data-help="inicio-rail"]', side: 'left', align: 'start' },
  ],

  'datos-analitica': [
    { id: 'periodo', sel: '[data-help="analitica-periodo"]', side: 'bottom', align: 'end' },
    { id: 'kpis', sel: '[data-help="analitica-kpis"]', side: 'bottom', align: 'start' },
    { id: 'graficas', sel: '[data-help="analitica-graficas"]', side: 'top', align: 'start' },
  ],

  'datos-resumen': [
    { id: 'toggle', sel: '[data-help="resumen-toggle"]', side: 'bottom', align: 'start' },
    { id: 'cuando', sel: '[data-help="resumen-cuando"]', side: 'top', align: 'start' },
    { id: 'acciones', sel: '[data-help="resumen-acciones"]', side: 'top', align: 'start' },
  ],

  musica: [
    { id: 'player', sel: '[data-help="musica-player"]', side: 'bottom', align: 'start' },
    { id: 'tabs', sel: '[data-help="musica-tabs"]', side: 'bottom', align: 'start' },
    { id: 'config', sel: '[data-help="musica-config"]', side: 'top', align: 'start' },
  ],

  'seg-verificacion': [
    { id: 'enable', sel: '[data-help="verif-enable"]', side: 'bottom', align: 'start' },
    { id: 'modo', sel: '[data-help="verif-modo"]', side: 'bottom', align: 'start' },
    { id: 'campos', sel: '[data-help="verif-campos"]', side: 'top', align: 'start' },
    { id: 'acciones', sel: '[data-help="verif-acciones"]', side: 'top', align: 'start' },
  ],

  'cuenta-plan': [
    { id: 'actual', sel: '[data-help="planes-actual"]', side: 'bottom', align: 'start' },
    { id: 'intervalo', sel: '[data-help="planes-intervalo"]', side: 'bottom', align: 'center' },
    { id: 'tarjetas', sel: '[data-help="planes-tarjetas"]', side: 'top', align: 'start' },
  ],

  'config-niveles': [
    { id: 'enable', sel: '[data-help="niveles-enable"]', side: 'bottom', align: 'start' },
    { id: 'xp', sel: '[data-help="niveles-xp"]', side: 'bottom', align: 'start' },
    { id: 'anuncios', sel: '[data-help="niveles-anuncios"]', side: 'top', align: 'start' },
    { id: 'recompensas', sel: '[data-help="niveles-recompensas"]', side: 'top', align: 'start' },
    { id: 'ranking', sel: '[data-help="niveles-ranking"]', side: 'left', align: 'start' },
  ],

  'roles-autorol': [
    { id: 'personas', sel: '[data-help="autorol-personas"]', side: 'bottom', align: 'start' },
    { id: 'bots', sel: '[data-help="autorol-bots"]', side: 'top', align: 'start' },
    { id: 'guardar', sel: '[data-help="autorol-guardar"]', side: 'top', align: 'start' },
  ],

  'seg-embudo': [
    { id: 'config', sel: '[data-help="embudo-config"]', side: 'bottom', align: 'start' },
    { id: 'variantes', sel: '[data-help="embudo-variantes"]', side: 'top', align: 'start' },
    { id: 'acciones', sel: '[data-help="embudo-acciones"]', side: 'top', align: 'start' },
  ],

  'prod-bienvenidas': [
    { id: 'tabs', sel: '[data-help="bienvenida-tabs"]', side: 'bottom', align: 'start' },
    { id: 'mensaje', sel: '[data-help="bienvenida-mensaje"]', side: 'top', align: 'start' },
    { id: 'embed', sel: '[data-help="bienvenida-embed"]', side: 'top', align: 'start' },
    { id: 'acciones', sel: '[data-help="bienvenida-acciones"]', side: 'top', align: 'start' },
  ],

  'tickets-gestion': [
    { id: 'filtro', sel: '[data-help="tickets-filtro"]', side: 'bottom', align: 'start' },
    { id: 'grid', sel: '[data-help="tickets-grid"]', side: 'top', align: 'start' },
  ],

  'tickets-usuarios': [
    { id: 'tabla', sel: '[data-help="users-tabla"]', side: 'top', align: 'start' },
  ],

  'tickets-config': [
    { id: 'guardar', sel: '[data-help="incidents-guardar"]', side: 'bottom', align: 'start' },
    { id: 'urgencias', sel: '[data-help="incidents-urgencias"]', side: 'top', align: 'start' },
    { id: 'categorias', sel: '[data-help="incidents-categorias"]', side: 'top', align: 'start' },
  ],

  'roles-gestion': [
    { id: 'crear', sel: '[data-help="roles-crear"]', side: 'bottom', align: 'end' },
    { id: 'lista', sel: '[data-help="roles-lista"]', side: 'top', align: 'start' },
  ],

  'roles-paneles': [
    { id: 'crear', sel: '[data-help="paneles-crear"]', side: 'bottom', align: 'end' },
    { id: 'lista', sel: '[data-help="paneles-lista"]', side: 'top', align: 'start' },
  ],

  'mod-centro': [
    { id: 'stats', sel: '[data-help="modcentro-stats"]', side: 'bottom', align: 'start' },
    { id: 'buscar', sel: '[data-help="modcentro-buscar"]', side: 'bottom', align: 'start' },
    { id: 'aplicar', sel: '[data-help="modcentro-aplicar"]', side: 'left', align: 'start' },
  ],

  'mod-tipos': [
    { id: 'crear', sel: '[data-help="tipos-crear"]', side: 'bottom', align: 'end' },
    { id: 'lista', sel: '[data-help="tipos-lista"]', side: 'top', align: 'start' },
  ],

  'mod-automod': [
    { id: 'presets', sel: '[data-help="automod-presets"]', side: 'bottom', align: 'start' },
    { id: 'master', sel: '[data-help="automod-master"]', side: 'top', align: 'start' },
    { id: 'entradas', sel: '[data-help="automod-entradas"]', side: 'bottom', align: 'start' },
    { id: 'mensajes', sel: '[data-help="automod-mensajes"]', side: 'bottom', align: 'start' },
    { id: 'guardar', sel: '[data-help="automod-guardar"]', side: 'top', align: 'start' },
  ],

  'mod-reportes': [
    { id: 'ajustes', sel: '[data-help="reportes-ajustes"]', side: 'bottom', align: 'start' },
    { id: 'bandeja', sel: '[data-help="reportes-bandeja"]', side: 'top', align: 'start' },
  ],

  'seg-reportes': [
    { id: 'ajustes', sel: '[data-help="reportes-ajustes"]', side: 'bottom', align: 'start' },
    { id: 'bandeja', sel: '[data-help="reportes-bandeja"]', side: 'top', align: 'start' },
  ],

  'mod-registro': [
    { id: 'canal', sel: '[data-help="modreg-canal"]', side: 'bottom', align: 'start' },
    { id: 'filtros', sel: '[data-help="modreg-filtros"]', side: 'bottom', align: 'start' },
    { id: 'lista', sel: '[data-help="modreg-lista"]', side: 'top', align: 'start' },
  ],

  'prod-autorespuestas': [
    { id: 'reglas', sel: '[data-help="autoresp-reglas"]', side: 'bottom', align: 'end' },
    { id: 'guardar', sel: '[data-help="autoresp-guardar"]', side: 'top', align: 'start' },
  ],

  'prod-embeds': [
    { id: 'tipo', sel: '[data-help="embeds-tipo"]', side: 'bottom', align: 'start' },
    { id: 'destino', sel: '[data-help="embeds-destino"]', side: 'top', align: 'start' },
    { id: 'builder', sel: '[data-help="embeds-builder"]', side: 'top', align: 'start' },
    { id: 'enviar', sel: '[data-help="embeds-enviar"]', side: 'top', align: 'start' },
  ],

  'prod-anuncios': [
    { id: 'lista', sel: '[data-help="anuncios-lista"]', side: 'bottom', align: 'start' },
    { id: 'crear', sel: '[data-help="anuncios-crear"]', side: 'top', align: 'start' },
  ],

  'config-comportamiento': [
    { id: 'cierre', sel: '[data-help="comp-cierre"]', side: 'bottom', align: 'start' },
    { id: 'notif', sel: '[data-help="comp-notif"]', side: 'top', align: 'start' },
    { id: 'logs', sel: '[data-help="comp-logs"]', side: 'top', align: 'start' },
  ],

  'config-reglas': [
    { id: 'staff', sel: '[data-help="reglas-staff"]', side: 'bottom', align: 'start' },
    { id: 'categoria', sel: '[data-help="reglas-categoria"]', side: 'top', align: 'start' },
    { id: 'limite', sel: '[data-help="reglas-limite"]', side: 'top', align: 'start' },
    { id: 'autoasignar', sel: '[data-help="reglas-autoasignar"]', side: 'top', align: 'start' },
  ],

  'config-acceso': [
    { id: 'panel', sel: '[data-help="acceso-panel"]', side: 'bottom', align: 'start' },
    { id: 'moderacion', sel: '[data-help="acceso-moderacion"]', side: 'top', align: 'start' },
    { id: 'areas', sel: '[data-help="acceso-areas"]', side: 'top', align: 'start' },
    { id: 'guardar', sel: '[data-help="acceso-guardar"]', side: 'top', align: 'start' },
  ],

  'config-expresiones': [
    { id: 'emojis', sel: '[data-help="expr-emojis"]', side: 'bottom', align: 'start' },
    { id: 'stickers', sel: '[data-help="expr-stickers"]', side: 'top', align: 'start' },
  ],

  'config-macros': [
    { id: 'crear', sel: '[data-help="macros-crear"]', side: 'bottom', align: 'start' },
  ],

  'config-textos': [
    { id: 'guardar', sel: '[data-help="texts-guardar"]', side: 'bottom', align: 'start' },
    { id: 'form', sel: '[data-help="texts-form"]', side: 'right', align: 'start' },
    { id: 'avanzado', sel: '[data-help="texts-avanzado"]', side: 'top', align: 'start' },
  ],

  logs: [
    { id: 'capacidad', sel: '[data-help="logs-capacidad"]', side: 'bottom', align: 'start' },
    { id: 'filtros', sel: '[data-help="logs-filtros"]', side: 'bottom', align: 'start' },
    { id: 'timeline', sel: '[data-help="logs-timeline"]', side: 'top', align: 'start' },
  ],

  'seg-backup': [
    { id: 'exportar', sel: '[data-help="backup-exportar"]', side: 'bottom', align: 'start' },
    { id: 'importar', sel: '[data-help="backup-importar"]', side: 'bottom', align: 'start' },
  ],
};
