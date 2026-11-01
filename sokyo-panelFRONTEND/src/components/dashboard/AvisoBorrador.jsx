// «Hemos recuperado lo que no se había guardado» (1.9.10): sale al volver a una
// sección cuyos cambios se quedaron sin guardar (recarga, pestaña cerrada, sin
// conexión…). Lo avisa useAutoguardado con el evento sokyo-borrador; «Descartar»
// vuelve a lo guardado. Va arriba para no taparse con «Guardado · Deshacer».
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, X, Undo2 } from 'lucide-react';

const DURA = 12000;

export default function AvisoBorrador() {
  const { t, i18n } = useTranslation();
  const [aviso, setAviso] = useState(null); // { hace (segundos, negativo), descartar, descartado }
  const temporizador = useRef(null);

  useEffect(() => {
    const alRecuperar = (e) => {
      setAviso({ hace: Math.round((e.detail.desde - Date.now()) / 1000), descartar: e.detail.descartar, descartado: false });
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setAviso(null), DURA);
    };
    window.addEventListener('sokyo-borrador', alRecuperar);
    return () => { window.removeEventListener('sokyo-borrador', alRecuperar); clearTimeout(temporizador.current); };
  }, []);

  if (!aviso) return null;

  // «hace 3 minutos», «ayer»… en el idioma del panel.
  const cuando = (() => {
    const seg = aviso.hace;
    const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
    const abs = Math.abs(seg);
    if (abs < 60) return rtf.format(seg, 'second');
    if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
    return rtf.format(Math.round(seg / 86400), 'day');
  })();

  const descartar = () => {
    aviso.descartar();
    setAviso({ ...aviso, descartado: true });
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(null), 4000);
  };

  return (
    <div role="status" aria-live="polite" className="sk-flotante sk-aparece fixed left-1/2 top-[4.5rem] z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-xl">
      <History size={18} className="shrink-0 text-brand" />
      <span className="min-w-0 flex-1 text-sm font-semibold text-fg">
        {aviso.descartado ? t('dashboard.borrador.descartado') : t('dashboard.borrador.recuperado', { cuando })}
      </span>
      {!aviso.descartado && (
        <button onClick={descartar} className="sk-foco flex shrink-0 items-center gap-1.5 rounded-xl bg-elevated px-3 py-1.5 text-sm font-semibold text-fg ring-1 ring-line hover:text-danger">
          <Undo2 size={15} /> {t('dashboard.borrador.descartar')}
        </button>
      )}
      <button onClick={() => setAviso(null)} className="sk-boton-icono shrink-0 !h-8 !w-8" aria-label={t('dashboard.borrador.cerrar')}><X size={15} /></button>
    </div>
  );
}
