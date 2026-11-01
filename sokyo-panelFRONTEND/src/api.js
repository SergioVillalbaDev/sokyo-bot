// Capa de acceso a la API del bot. La sesión es un token firmado por el servidor tras entrar con Discord;
// ya NO hay ninguna clave compartida dentro del frontend.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const TOKEN_KEY = 'sokyoStaffToken';
const GUILD_KEY = 'sokyoGuild';

const leer = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const escribir = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* modo privado */ } };

export const getToken = () => leer(TOKEN_KEY);
export const setToken = (t) => escribir(TOKEN_KEY, t);
export const getGuild = () => leer(GUILD_KEY);
export const setGuild = (g) => escribir(GUILD_KEY, g);

export const urlLogin = `${API_URL}/api/auth/staff`;

// fetch con sesión + servidor activo. Si la sesión caduca avisa a la app para volver al login.
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.headers || {})['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${getToken()}`,
      'x-guild-id': getGuild(),
    },
  });
  if (res.status === 401) window.dispatchEvent(new Event('sokyo:sesion-caducada'));
  return res;
}

// Igual que apiFetch pero devuelve el JSON y lanza un Error legible si algo falla.
export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const enviar = (metodo, path, cuerpo) =>
  apiJson(path, { method: metodo, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });

// Descarga un fichero protegido (CSV, transcripción) con la sesión actual.
export async function descargar(path, nombre) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error('No se pudo descargar');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Escucha eventos en vivo (SSE). Usa fetch + stream para poder enviar la cabecera Authorization.
// Devuelve una función para cerrar la conexión.
export function escucharEventos(onEvento, onEstado = () => {}) {
  const ctl = new AbortController();
  let cerrado = false;

  const conectar = async () => {
    try {
      const res = await fetch(`${API_URL}/api/eventos`, { headers: { Authorization: `Bearer ${getToken()}` }, signal: ctl.signal });
      if (!res.ok || !res.body) throw new Error('sse');
      onEstado(true);
      const lector = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const bloque = buf.slice(0, i); buf = buf.slice(i + 2);
          const tipo = /^event: (.+)$/m.exec(bloque)?.[1];
          const datos = /^data: (.+)$/m.exec(bloque)?.[1];
          if (tipo && datos) { try { onEvento(tipo, JSON.parse(datos)); } catch { /* evento mal formado */ } }
        }
      }
    } catch { /* se reintenta abajo */ }
    onEstado(false);
    if (!cerrado) setTimeout(conectar, 5000);
  };
  conectar();
  return () => { cerrado = true; ctl.abort(); };
}

export const avatarPorDefecto = (nombre) => `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre || '?')}&background=2c3e50&color=fff`;

export const formatDuracion = (ms) => {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const m = Math.round(ms / 60000);
  if (m < 1) return `${Math.max(1, Math.round(ms / 1000))} s`;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
};

// Sustituye {usuario} {staff} {ticket} {servidor} (en el panel se muestran como texto legible).
export const renderPlantilla = (texto, vars) =>
  String(texto || '').replace(/\{(usuario|staff|ticket|servidor)\}/gi, (_, k) => vars[k.toLowerCase()] ?? `{${k}}`);
