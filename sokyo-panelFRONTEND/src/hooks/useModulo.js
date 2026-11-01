// Secciones de la 1.9.0 (cumpleaños, salón de la fama, grupos, clanes, confesiones,
// solicitudes, ausente): cargar la sección y su formulario con autoguardado.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoguardado } from './useAutoguardado';

// Cada cuánto se ponen al día las listas de la sección abierta.
const REFRESCO_MS = 5000;

// Carga /modulos/<ruta> y deja `form` con su config, que se guarda sola al dejar de tocarla.
export function useModulo(dash, ruta) {
  const { cargarModulo, guardarModulo } = dash;
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState('');

  const recargar = useCallback(async () => {
    const r = await cargarModulo(ruta);
    if (r.error) { setDatos({ error: r.error }); return; }
    setDatos(r);
    setForm(r.config || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { recargar(); }, [recargar]);

  // Las listas (ausentes, grupos, solicitudes, confesiones…) cambian desde Discord:
  // se ponen al día solas cada REFRESCO_MS mientras la sección está a la vista y en
  // cuanto se vuelve a la pestaña. Solo los datos: `form` (lo que se está editando)
  // no se toca. Se usa siempre el `cargarModulo` último (el del servidor elegido ahora).
  const cargarUltimo = useRef(cargarModulo);
  useEffect(() => { cargarUltimo.current = cargarModulo; });
  useEffect(() => {
    let activo = true;
    let enCurso = false;
    const refrescar = async () => {
      if (document.hidden || enCurso) return;
      enCurso = true;
      const r = await cargarUltimo.current(ruta).catch(() => ({ error: true }));
      enCurso = false;
      if (!activo || r.error) return;
      setDatos(r);
      setForm((f) => f ?? (r.config || null));
    };
    const id = setInterval(refrescar, REFRESCO_MS);
    const alVolver = () => { if (!document.hidden) refrescar(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      activo = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [ruta]);

  const guardar = async () => {
    setEstado('guardando');
    const r = await guardarModulo(ruta, form);
    if (r.error) { setEstado(r.error); return false; }
    setEstado('ok');
    // `form` no se pisa con la respuesta: tiene lo que se está escribiendo y lo que está a
    // medias (la pregunta vacía recién añadida, el nombre que se está cambiando…), que el
    // servidor no guarda todavía. Ver hooks/useDesdeServidor.js.
    return true;
  };
  const autoguardado = useAutoguardado(form, guardar, { listo: !!form, borrador: `modulo:${ruta}`, restaurar: setForm });
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setEstado(''); };
  return { datos, setDatos, form, set, guardar, estado, autoguardado, recargar };
}

// «Hace 3 h», «en 2 días»… en el idioma del panel.
export function useRelativo() {
  const { i18n } = useTranslation();
  return (fecha) => {
    if (!fecha) return '';
    const ms = new Date(fecha).getTime();
    if (Number.isNaN(ms)) return ''; // fecha a medias: nada, en vez de romper
    const seg = Math.round((ms - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
    const abs = Math.abs(seg);
    if (abs < 60) return rtf.format(seg, 'second');
    if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
    return rtf.format(Math.round(seg / 86400), 'day');
  };
}
