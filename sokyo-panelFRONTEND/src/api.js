// Acceso a la API del bot desde el panel y el portal.
// Si la web la sirve el propio bot (build en dist/), VITE_API_URL puede quedar vacío.
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const CLAVE_PANEL = 'sokyoPanelToken';
const CLAVE_PORTAL = 'portalToken';
const CLAVE_SERVIDOR = 'sokyoServidor';

const leer = (clave) => { try { return localStorage.getItem(clave) || ''; } catch { return ''; } };
const guardar = (clave, valor) => { try { valor ? localStorage.setItem(clave, valor) : localStorage.removeItem(clave); } catch { /* sin almacenamiento */ } };

// Al volver del login de Discord la URL trae ?token=... (o ?error=...). Se guarda y se limpia la URL.
const parametros = new URLSearchParams(window.location.search);
export const ES_PORTAL = parametros.has('portal');
export const ERROR_LOGIN = parametros.get('error') || '';
if (parametros.has('token') || parametros.has('error')) {
  const token = parametros.get('token');
  if (token) guardar(ES_PORTAL ? CLAVE_PORTAL : CLAVE_PANEL, token);
  parametros.delete('token');
  parametros.delete('error');
  const resto = parametros.toString();
  window.history.replaceState({}, '', window.location.pathname + (resto ? `?${resto}` : ''));
}

export const tokenPanel = () => leer(CLAVE_PANEL);
export const tokenPortal = () => leer(CLAVE_PORTAL);
export const cerrarSesionPanel = () => { guardar(CLAVE_PANEL, ''); guardar(CLAVE_SERVIDOR, ''); };
export const cerrarSesionPortal = () => guardar(CLAVE_PORTAL, '');
export const servidorGuardado = () => leer(CLAVE_SERVIDOR);
export const guardarServidor = (id) => guardar(CLAVE_SERVIDOR, id);

export const urlLogin = (modo = 'panel') => `${API_URL}/api/auth/discord?modo=${modo}`;

export const MENSAJES_ERROR_LOGIN = {
  denegado: 'Has cancelado el inicio de sesión.',
  oauth: 'No se pudo iniciar sesión con Discord. Inténtalo de nuevo.',
  estado: 'El enlace de inicio de sesión ha caducado. Inténtalo de nuevo.'
};

export class ErrorSesion extends Error {}

export async function api(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  const t = token ?? tokenPanel();
  let res;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
  } catch {
    throw new Error('No se pudo conectar con el bot. ¿Está encendido?');
  }
  const datos = await res.json().catch(() => null);
  if (res.status === 401) throw new ErrorSesion(datos?.error || 'Tu sesión ha caducado');
  if (!res.ok) {
    const error = new Error(datos?.error || `Error ${res.status}`);
    error.status = res.status;
    error.codigo = datos?.codigo;
    throw error;
  }
  return datos;
}
