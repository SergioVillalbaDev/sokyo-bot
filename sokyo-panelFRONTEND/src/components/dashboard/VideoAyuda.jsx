// «Ver cómo se hace»: ventana con el vídeo corto de la sección (se repite solo)
// y sus pasos. La abre el botón ▶ de la cabecera en las secciones que tienen
// vídeo (lib/videos.js → VIDEOS_PANEL). Textos: dashboard.videoAyuda.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, PlayCircle } from 'lucide-react';
import VideoDemo from '../VideoDemo';

export default function VideoAyuda({ video, seccion, onCerrar }) {
  const { t } = useTranslation();
  const cerrar = useRef(null);
  const pasos = t(`dashboard.videoAyuda.pasos.${video}`, { returnObjects: true });

  useEffect(() => {
    cerrar.current?.focus();
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div className="sk-velo flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="video-ayuda-titulo"
        className="sk-glass sk-brillo sk-aparece flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <PlayCircle size={20} className="shrink-0 text-brand" />
          <h2 id="video-ayuda-titulo" className="min-w-0 flex-1 truncate font-bold text-fg">
            {t('dashboard.videoAyuda.titulo')} · <span className="text-muted">{seccion}</span>
          </h2>
          <button ref={cerrar} onClick={onCerrar} className="sk-boton-icono shrink-0" aria-label={t('dashboard.videoAyuda.cerrar')} title={t('dashboard.videoAyuda.cerrar')}>
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto">
          <VideoDemo key={video} id={video} alt={seccion} className="bg-black/40" />
          <div className="p-4 sm:p-5">
            <ol className="grid gap-3 sm:grid-cols-3">
              {(Array.isArray(pasos) ? pasos : []).map((paso, i) => (
                <li key={paso} className="flex items-start gap-2.5 text-sm text-fg">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-brand text-xs font-bold text-on-brand">{i + 1}</span>
                  <span className="leading-relaxed">{paso}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs text-muted">{t('dashboard.videoAyuda.nota')}</p>
              <button onClick={onCerrar} className="sk-foco rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.02]">
                {t('dashboard.videoAyuda.entendido')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
