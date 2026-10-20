// Cliente de la API del bot y gestión de la sesión guardada en el navegador.

// URL del bot. Defínela en .env (VITE_API_URL) si el bot corre en otra máquina, p. ej. http://192.168.1.50:3000
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const CLAVE_SESION = 'sokyo.sesion';

// La sesión es { tipo: 'discord' | 'apikey', token }.
export function leerSesion() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null');
    if (guardada?.token) return guardada;
    // Sesiones del portal de versiones anteriores
    const antigua = localStorage.getItem('portalToken');
    return antigua ? { tipo: 'discord', token: antigua } : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    localStorage.removeItem('portalToken');
  } catch { /* almacenamiento bloqueado: la sesión durará lo que la pestaña */ }
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE_SESION);
    localStorage.removeItem('portalToken');
  } catch { /* nada que borrar */ }
}

export class ErrorApi extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

export const EVENTO_SESION_CADUCADA = 'sokyo:sesion-caducada';

export async function api(ruta, { metodo = 'GET', body, sesion = leerSesion(), comoTexto = false } = {}) {
  const headers = {};
  if (sesion?.tipo === 'apikey') headers['x-api-key'] = sesion.token;
  else if (sesion?.token) headers.Authorization = `Bearer ${sesion.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${API_URL}${ruta}`, { method: metodo, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ErrorApi(`No se pudo conectar con el bot en ${API_URL}. Comprueba que está encendido.`, 0);
  }

  if (res.ok && comoTexto) return res.text();
  const esJson = (res.headers.get('content-type') || '').includes('application/json');
  const datos = esJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 && sesion) window.dispatchEvent(new Event(EVENTO_SESION_CADUCADA));
    throw new ErrorApi(datos?.error || `Error ${res.status} del servidor`, res.status);
  }
  return datos;
}

export const urlLoginDiscord = () => `${API_URL}/api/auth/discord`;

// Descarga un archivo de la API (con autenticación) y lo guarda en el equipo.
export async function descargar(ruta, nombre) {
  const contenido = await api(ruta, { comoTexto: true });
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/html;charset=utf-8' }));
  const enlace = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
