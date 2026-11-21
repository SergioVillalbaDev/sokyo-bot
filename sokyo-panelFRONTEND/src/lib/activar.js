// Activar una sección con lo recomendado en un clic (1.17.1). Lo usan el aviso
// «Esto está apagado» de cada sección (AvisoApagado.jsx) y la lista del Inicio
// (AsistenteInicio.jsx). Por detrás es el setup rápido con `uno: true`
// (POST /api/config/:guildId/setup-rapido; utils/setupRapido.js, MODULOS).
import { apiFetch } from './api';

// Sección del panel → lo que el setup rápido sabe dejar funcionando solo.
export const ACTIVABLE = {
  'prod-bienvenidas': 'bienvenidas', 'logs-todos': 'registro', 'config-niveles': 'niveles', 'mod-automod': 'automod',
  'tickets-config': 'tickets', 'com-temporadas': 'temporadas', 'com-cumpleanos': 'cumpleanos', 'crec-votos': 'votos',
  'com-sugerencias': 'sugerencias', 'com-salon': 'salon', 'crec-contadores': 'contadores', 'com-mascota': 'mascota',
  'com-casino': 'casino', 'com-bromas': 'bromas', 'crec-liga': 'liga', 'com-clanes': 'clanes',
};

// Devuelve { ok, pasos, creados } o { ok: false, motivo: 'admin'|'permisos'|'espera'|'error', permisos, detalle }.
export async function activarSeccion(guildId, tab, { idioma = 'es', tipo = 'comunidad' } = {}) {
  const modulo = ACTIVABLE[tab];
  if (!modulo) return { ok: false, motivo: 'error' };
  const res = await apiFetch(`/api/config/${guildId}/setup-rapido`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uno: true, modulos: [modulo], idioma: idioma === 'es' ? 'es' : 'en', tipo }),
  }).catch(() => null);
  const d = res ? await res.json().catch(() => ({})) : {};
  if (!res) return { ok: false, motivo: 'error' };
  if (res.status === 403) return { ok: false, motivo: 'admin' };
  if (d.codigo === 'permisos_bot') return { ok: false, motivo: 'permisos', permisos: d.permisos || [] };
  if (res.status === 429) return { ok: false, motivo: 'espera' };
  const fallo = (d.pasos || []).find((p) => p.estado === 'error');
  if (!res.ok || fallo) return { ok: false, motivo: 'error', detalle: fallo?.detalle || d.error };
  return { ok: true, pasos: d.pasos || [], creados: d.creados || [] };
}
