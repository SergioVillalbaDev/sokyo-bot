// Utilidades y hooks compartidos del panel.
import { useCallback, useEffect, useState } from 'react';

export const avatarDe = (url, nombre) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre || '?')}&background=2c3e50&color=fff`;

export const fechaCorta = (f) => (f ? new Date(f).toLocaleDateString('es-ES') : '—');
export const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '');

// Carga datos con una función async y permite recargar. No llama a setState de forma síncrona en el efecto.
export function useDatos(cargar, deps) {
  const [estado, setEstado] = useState({ datos: null, error: '', cargando: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    cargar()
      .then(datos => { if (vivo) setEstado({ datos, error: '', cargando: false }); })
      .catch(e => { if (vivo) setEstado(s => ({ ...s, error: e.message, cargando: false })); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const recargar = useCallback(() => setVersion(v => v + 1), []);
  const setDatos = useCallback((f) => setEstado(s => ({ ...s, datos: typeof f === 'function' ? f(s.datos) : f })), []);
  return { ...estado, recargar, setDatos };
}

// Ejecuta una acción async mostrando "ocupado" y el mensaje de error/éxito.
export function useAccion() {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const ejecutar = useCallback(async (fn, exito) => {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await fn();
      if (exito) setAviso({ tipo: 'exito', texto: exito });
      return r;
    } catch (e) {
      setAviso({ tipo: 'error', texto: e.message });
      return null;
    } finally {
      setOcupado(false);
    }
  }, []);
  return { ocupado, aviso, setAviso, ejecutar };
}
