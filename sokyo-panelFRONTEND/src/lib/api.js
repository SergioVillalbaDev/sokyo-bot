// ============================================================================
// Cliente de API del panel de staff.
// Centraliza la URL base y la API key para que TODAS las llamadas lleven la
// cabecera de autenticación. Esta lógica es la misma que ya había en App.jsx;
// solo se ha movido aquí para reutilizarla desde los componentes/hooks.
// ============================================================================

// URL base de la API del bot. En producción la API y el panel se sirven en el
// MISMO dominio, así que por defecto usamos rutas relativas (mismo origen) y no
// dependemos de localhost. Para desarrollo, define VITE_API_URL en el .env
// (p. ej. 'http://localhost:3001') apuntando al servidor donde corre el bot.
export const API_URL = import.meta.env.VITE_API_URL || '';

// Clave de la API: debe coincidir con API_KEY del .env del bot. Se define en VITE_API_KEY.
export const API_KEY = import.meta.env.VITE_API_KEY || '';

// Token de sesión de staff (si el usuario inició sesión con Discord).
export const getStaffToken = () => localStorage.getItem('sokyoStaffToken') || '';

// Decodifica el payload del token de staff (solo para mostrar info en la UI,
// no es validación de seguridad — eso lo hace el servidor con la firma).
export const getStaffSession = () => {
  const tk = getStaffToken();
  if (!tk || !tk.includes('.')) return null;
  try {
    let b64 = tk.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
};

// Wrapper de fetch que añade la autenticación a todas las llamadas.
// Si hay sesión de staff, manda el token (Bearer); además incluye la API key
// del propietario (retrocompatible / modo dueño).
export const apiFetch = (path, options = {}) => {
  const token = getStaffToken();
  const headers = { ...(options.headers || {}), 'x-api-key': API_KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...options, headers });
};

// Comprueba la respuesta y lanza un error legible si algo va mal.
// Para el 401 distinguimos el motivo (lo manda el servidor en `code`):
//  - 'session_invalid'  -> el login de Discord caducó / no es válido.
//  - 'apikey_mismatch'  -> la VITE_API_KEY del panel no coincide con la del bot.
export const procesarRespuesta = async (res) => {
  if (res.status === 401) {
    let code = '';
    let msg = '';
    try { const b = await res.json(); code = b.code || ''; msg = b.error || ''; } catch { /* sin cuerpo JSON */ }
    if (code === 'session_invalid')
      throw new Error(msg || 'Tu sesión ha caducado. Cierra sesión y vuelve a entrar con Discord.');
    if (code === 'apikey_mismatch')
      throw new Error(msg || 'La VITE_API_KEY del panel no coincide con la API_KEY del bot.');
    throw new Error(msg || '401 No autorizado.');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
