// «Guardado · Deshacer»: justo después de guardar algo de la configuración, un
// aviso abajo durante unos segundos con el botón para dejarlo como estaba. La
// API manda el id del cambio en X-Sokyo-Cambio y lib/api.js lo avisa con el
// evento sokyo-cambio. Más atrás en el tiempo: sección «Historial de cambios».
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Undo2, Loader2, X, History } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const DURA = 8000;

export default function AvisoDeshacer({ guildId, onDeshecho, onHistorial }) {
  const { t } = useTranslation();
  const [aviso, setAviso] = useState(null); // { id, estado: 'guardado'|'deshaciendo'|'deshecho'|'conflicto'|'error' }
  const temporizador = useRef(null);

  const programarCierre = (ms = DURA) => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(null), ms);
  };

  useEffect(() => {
    const alCambiar = (e) => { setAviso({ id: e.detail.id, estado: 'guardado' }); programarCierre(); };
    window.addEventListener('sokyo-cambio', alCambiar);
    return () => { window.removeEventListener('sokyo-cambio', alCambiar); clearTimeout(temporizador.current); };
  }, []);

  if (!aviso) return null;

  const deshacer = async () => {
    clearTimeout(temporizador.current);
    setAviso({ ...aviso, estado: 'deshaciendo' });
    try {
      const res = await apiFetch(`/api/cambios/${aviso.id}/deshacer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId }) });
      const estado = res.ok ? 'deshecho' : res.status === 409 ? 'conflicto' : 'error';
      setAviso({ ...aviso, estado });
      if (res.ok) await onDeshecho?.();
    } catch { setAviso({ ...aviso, estado: 'error' }); }
    programarCierre(5000);
  };

  const texto = {
    guardado: t('dashboard.deshacer.guardado'),
    deshaciendo: t('dashboard.deshacer.deshaciendo'),
    deshecho: t('dashboard.deshacer.deshecho'),
    conflicto: t('dashboard.deshacer.conflicto'),
    error: t('dashboard.deshacer.error'),
  }[aviso.estado];

  return (
    <div role="status" aria-live="polite" className="sk-flotante sk-aparece fixed bottom-[4.5rem] left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-xl lg:bottom-5 lg:left-auto lg:right-24 lg:translate-x-0">
      {aviso.estado === 'deshaciendo' ? <Loader2 size={18} className="shrink-0 animate-spin text-muted" /> : <CheckCircle2 size={18} className="shrink-0 text-success" />}
      <span className="min-w-0 flex-1 text-sm font-semibold text-fg">{texto}</span>
      {aviso.estado === 'guardado' && (
        <button onClick={deshacer} className="sk-foco flex shrink-0 items-center gap-1.5 rounded-xl bg-elevated px-3 py-1.5 text-sm font-semibold text-fg ring-1 ring-line hover:text-brand">
          <Undo2 size={15} /> {t('dashboard.deshacer.boton')}
        </button>
      )}
      {(aviso.estado === 'conflicto' || aviso.estado === 'error') && onHistorial && (
        <button onClick={() => { setAviso(null); onHistorial(); }} className="sk-foco flex shrink-0 items-center gap-1.5 rounded-xl bg-elevated px-3 py-1.5 text-sm font-semibold text-fg ring-1 ring-line hover:text-brand">
          <History size={15} /> {t('dashboard.deshacer.historial')}
        </button>
      )}
      <button onClick={() => setAviso(null)} className="sk-boton-icono shrink-0 !h-8 !w-8" aria-label={t('dashboard.deshacer.cerrar')}><X size={15} /></button>
    </div>
  );
}
