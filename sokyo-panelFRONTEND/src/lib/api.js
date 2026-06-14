// ============================================================================
// Cliente de API del panel de staff.
// Centraliza la URL base y la API key para que TODAS las llamadas lleven la
// cabecera de autenticación. Esta lógica es la misma que ya había en App.jsx;
// solo se ha movido aquí para reutilizarla desde los componentes/hooks.
// ============================================================================

// URL base de la API del bot. Cambia este valor (o define VITE_API_URL en el .env)
// para apuntar al servidor donde corre el bot, p. ej. 'http://192.168.1.168:3000'.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Clave de la API: debe coincidir con API_KEY del .env del bot. Se define en VITE_API_KEY.
export const API_KEY = import.meta.env.VITE_API_KEY || '';

// Wrapper de fetch que añade la cabecera de autenticación a todas las llamadas.
export const apiFetch = (path, options = {}) =>
  fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), 'x-api-key': API_KEY },
  });

// Comprueba la respuesta y lanza un error legible si algo va mal.
export const procesarRespuesta = async (res) => {
  if (res.status === 401)
    throw new Error(
      '401 No autorizado: la VITE_API_KEY del panel no coincide con la API_KEY del bot.'
    );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
