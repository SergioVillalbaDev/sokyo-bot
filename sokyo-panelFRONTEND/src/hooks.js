import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

// ------------------------------------------------------------- router por hash
// Rutas tipo "#/tickets/123?q=hola". Usar el hash permite enlaces directos y que el
// botón "atrás" del navegador funcione sin configurar nada en el servidor.

const suscribirHash = (callback) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};
const leerHash = () => window.location.hash.slice(1) || '/';

export function useRuta() {
  const hash = useSyncExternalStore(suscribirHash, leerHash);
  const [ruta, consulta = ''] = hash.split('?');
  return { ruta: ruta || '/', partes: ruta.split('/').filter(Boolean), consulta: new URLSearchParams(consulta) };
}

export const navegar = (ruta) => { window.location.hash = ruta; };

// ------------------------------------------------------------- reloj compartido
// Un único intervalo para todos los "hace 5 min" de la página.

let ahoraActual = Date.now();
const relojes = new Set();
setInterval(() => { ahoraActual = Date.now(); relojes.forEach(fn => fn()); }, 30 * 1000);
const suscribirReloj = (fn) => { relojes.add(fn); return () => relojes.delete(fn); };

export const useAhora = () => useSyncExternalStore(suscribirReloj, () => ahoraActual);

// ------------------------------------------------------------- carga de datos
// Carga datos cuando cambian las dependencias y, opcionalmente, los refresca cada
// `intervalo` ms (pausado mientras la pestaña está oculta). No parpadea al refrescar.

export function useCarga(cargar, deps, { intervalo = 0 } = {}) {
  const [estado, setEstado] = useState({ clave: null, datos: undefined, error: null });
  const [version, setVersion] = useState(0);
  const cargarRef = useRef(cargar);
  useEffect(() => { cargarRef.current = cargar; });

  const clave = JSON.stringify(deps);
  useEffect(() => {
    let activo = true;
    const ejecutar = () => cargarRef.current().then(
      (datos) => { if (activo) setEstado({ clave, datos, error: null }); },
      (error) => { if (activo) setEstado(prev => ({ clave, datos: prev.clave === clave ? prev.datos : undefined, error })); }
    );
    ejecutar();
    const id = intervalo ? setInterval(() => { if (!document.hidden) ejecutar(); }, intervalo) : null;
    return () => { activo = false; if (id) clearInterval(id); };
  }, [clave, version, intervalo]);

  const vigente = estado.clave === clave;
  const recargar = useCallback(() => setVersion(v => v + 1), []);
  const mutar = useCallback((valor) => setEstado(prev => ({
    ...prev,
    datos: typeof valor === 'function' ? valor(prev.datos) : valor
  })), []);

  return {
    datos: vigente ? estado.datos : undefined,
    error: vigente ? estado.error : null,
    cargando: !vigente,
    recargar,
    mutar
  };
}

// ------------------------------------------------------------------- utilidades

// Valor "retrasado": útil para no lanzar una búsqueda por cada tecla.
export function useDebounce(valor, ms = 300) {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return retrasado;
}

// Estado persistido en localStorage (preferencias del usuario).
export function usePreferencia(clave, inicial) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = localStorage.getItem(clave);
      return guardado === null ? inicial : JSON.parse(guardado);
    } catch {
      return inicial;
    }
  });
  const guardar = useCallback((nuevo) => {
    setValor(prev => {
      const siguiente = typeof nuevo === 'function' ? nuevo(prev) : nuevo;
      try { localStorage.setItem(clave, JSON.stringify(siguiente)); } catch { /* sin almacenamiento */ }
      return siguiente;
    });
  }, [clave]);
  return [valor, guardar];
}

// Tema claro/oscuro aplicado al <html>.
export function useTema() {
  const [tema, setTema] = useState(() => document.documentElement.dataset.theme || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try { localStorage.setItem('sokyo.tema', tema); } catch { /* sin almacenamiento */ }
  }, [tema]);
  const alternar = useCallback(() => setTema(t => (t === 'dark' ? 'light' : 'dark')), []);
  return [tema, alternar];
}

// Avisa antes de cerrar la pestaña si hay cambios sin guardar.
export function useAvisoSalida(activo) {
  useEffect(() => {
    if (!activo) return;
    const aviso = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [activo]);
}
