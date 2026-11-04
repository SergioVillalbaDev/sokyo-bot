// Modo de los editores de permisos (Roles y Categorías y canales):
//   · 'simple'   → lo esencial, como hasta ahora (por defecto).
//   · 'avanzado' → todas las opciones que ofrece Discord (mencionable, degradado,
//                  emoji del rol, copiar/quitar permisos, permisos por miembro…).
// Se recuerda en este navegador y vale para las dos secciones.
import { useState } from 'react';

const CLAVE = 'sokyo:modoPermisos';

export function leerModoPermisos() {
  try { return localStorage.getItem(CLAVE) === 'avanzado' ? 'avanzado' : 'simple'; } catch { return 'simple'; }
}

export function useModoPermisos() {
  const [modo, setModoState] = useState(leerModoPermisos);
  const setModo = (nuevo) => {
    const valor = nuevo === 'avanzado' ? 'avanzado' : 'simple';
    setModoState(valor);
    try { localStorage.setItem(CLAVE, valor); } catch { /* sin almacenamiento: solo esta vez */ }
  };
  return [modo, setModo];
}
