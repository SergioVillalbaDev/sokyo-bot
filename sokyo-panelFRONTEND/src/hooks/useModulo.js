// Secciones de la 1.9.0 (cumpleaños, salón de la fama, grupos, clanes, confesiones,
// solicitudes, ausente): cargar la sección y su formulario con autoguardado.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoguardado } from './useAutoguardado';

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

  const guardar = async () => {
    setEstado('guardando');
    const r = await guardarModulo(ruta, form);
    if (r.error) { setEstado(r.error); return false; }
    setEstado('ok');
    setForm(r.config);
    return true;
  };
  const autoguardado = useAutoguardado(form, guardar, { listo: !!form });
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setEstado(''); };
  return { datos, setDatos, form, set, guardar, estado, autoguardado, recargar };
}

// «Hace 3 h», «en 2 días»… en el idioma del panel.
export function useRelativo() {
  const { i18n } = useTranslation();
  return (fecha) => {
    if (!fecha) return '';
    const seg = Math.round((new Date(fecha).getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
    const abs = Math.abs(seg);
    if (abs < 60) return rtf.format(seg, 'second');
    if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
    return rtf.format(Math.round(seg / 86400), 'day');
  };
}
