// Presets del automoderador: configuraciones completas listas para aplicar.
// Cada preset define SOLO lo que cambia respecto a los valores por defecto;
// al aplicarlo, el resto vuelve a su default (el usuario puede retocar después).
// El nombre y la descripción se traducen en i18n: dashboard.automod_v.presets.<id>.
export const PRESETS = [
  {
    id: 'equilibrado',
    emoji: '⚖️',
    config: {
      activo: true,
      avisarEnCanal: true,
      invitaciones: { activo: true, accion: 'borrar' },
      spam: { activo: true, accion: 'timeout', timeoutMin: 5, maxMensajes: 5, enSegundos: 5, repetidos: true },
      menciones: { activo: true, accion: 'borrar', max: 6, bloquearEveryone: true },
      estafas: { activo: true, accion: 'ban', conEnlace: true, conImagen: true, nitroFalso: true, borrarHoras: 1 },
      antiRaid: { activo: true, uniones: 8, enSegundos: 10, accion: 'kick', lockdownMin: 10 },
      cuentasNuevas: { activo: true, edadMinHoras: 72, sinAvatar: true, accion: 'alerta' },
    },
  },
  {
    id: 'relajado',
    emoji: '🌿',
    config: {
      activo: true,
      avisarEnCanal: true,
      invitaciones: { activo: true, accion: 'borrar' },
      spam: { activo: true, accion: 'timeout', timeoutMin: 5, maxMensajes: 8, enSegundos: 5, repetidos: true },
      estafas: { activo: true, accion: 'ban', conEnlace: true, conImagen: true, nitroFalso: true, borrarHoras: 1 },
    },
  },
  {
    id: 'estricto',
    emoji: '🛡️',
    config: {
      activo: true,
      avisarEnCanal: true,
      invitaciones: { activo: true, accion: 'timeout', timeoutMin: 10 },
      enlaces: { activo: true, accion: 'borrar' },
      spam: { activo: true, accion: 'timeout', timeoutMin: 10, maxMensajes: 4, enSegundos: 5, repetidos: true },
      menciones: { activo: true, accion: 'timeout', timeoutMin: 10, max: 4, bloquearEveryone: true },
      mayusculas: { activo: true, accion: 'borrar', porcentaje: 70, minLongitud: 10 },
      estafas: { activo: true, accion: 'ban', conEnlace: true, conImagen: true, nitroFalso: true, borrarHoras: 6 },
      antiRaid: { activo: true, uniones: 5, enSegundos: 10, accion: 'ban', lockdownMin: 15 },
      cuentasNuevas: { activo: true, edadMinHoras: 168, sinAvatar: true, accion: 'timeout', timeoutMin: 60 },
    },
  },
  {
    id: 'antiraid',
    emoji: '🚨',
    config: {
      activo: true,
      avisarEnCanal: true,
      invitaciones: { activo: true, accion: 'borrar' },
      spam: { activo: true, accion: 'timeout', timeoutMin: 10, maxMensajes: 5, enSegundos: 5, repetidos: true },
      estafas: { activo: true, accion: 'ban', conEnlace: true, conImagen: true, nitroFalso: true, borrarHoras: 6 },
      antiRaid: { activo: true, uniones: 5, enSegundos: 8, accion: 'ban', lockdownMin: 20 },
      cuentasNuevas: { activo: true, edadMinHoras: 168, sinAvatar: true, accion: 'kick' },
    },
  },
  {
    id: 'antiestafa',
    emoji: '🪤',
    config: {
      activo: true,
      avisarEnCanal: true,
      invitaciones: { activo: true, accion: 'borrar' },
      estafas: { activo: true, accion: 'ban', conEnlace: false, conImagen: true, nitroFalso: true, borrarHoras: 6 },
      cuentasNuevas: { activo: true, edadMinHoras: 72, sinAvatar: true, accion: 'alerta' },
    },
  },
];
