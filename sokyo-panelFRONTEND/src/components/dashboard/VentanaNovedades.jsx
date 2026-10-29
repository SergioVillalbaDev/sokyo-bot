// «Novedades»: la primera vez que se entra al panel después de actualizar el
// bot, una ventana con lo nuevo (lo mismo que el aviso «Bot actualizado» de
// Discord) y un botón para ir a cada cosa. Se vuelve a abrir desde Preferencias.
// Las novedades salen de utils/novedades.js (GET /api/novedades).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch, procesarRespuesta } from '../../lib/api';
import { ubicacion } from './navConfig';

export default function VentanaNovedades({ onCerrar, irA, puedeVer = () => true }) {
  const { t } = useTranslation();
  const [datos, setDatos] = useState(null);
  const [verAnteriores, setVerAnteriores] = useState(false);

  useEffect(() => {
    let vivo = true;
    apiFetch('/api/novedades').then(procesarRespuesta).then((d) => {
      if (!vivo) return;
      if (!d?.versiones?.length) { onCerrar(); return; }
      setDatos(d);
    }).catch(() => { if (vivo) onCerrar(); });
    return () => { vivo = false; };
  }, [onCerrar]);

  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCerrar]);

  const actual = datos?.versiones.find((v) => v.version === datos.version) || datos?.versiones[0];
  const anteriores = datos?.versiones.filter((v) => v !== actual) || [];

  const lista = (v) => (
    <ul className="space-y-2">
      {v.novedades.map((n) => {
        const visible = n.tab && ubicacion(n.tab) && puedeVer(n.tab);
        return (
          <li key={n.texto} className="flex items-start gap-3 rounded-2xl bg-elevated px-3 py-2.5 text-sm text-fg">
            <span className="min-w-0 flex-1 leading-relaxed">{n.texto}</span>
            {visible && (
              <button onClick={() => { onCerrar(); irA(n.tab); }} className="sk-foco flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-card">
                {t('dashboard.novedades.ver')} <ChevronRight size={13} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="sk-velo flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="novedades-titulo" className="sk-glass sk-brillo sk-aparece flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-on-brand"><Sparkles size={19} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="novedades-titulo" className="text-lg font-extrabold tracking-tight text-fg">{t('dashboard.novedades.titulo')}</h2>
            {actual && <p className="text-xs text-muted">{t('dashboard.novedades.version', { version: actual.version })}</p>}
          </div>
          <button onClick={onCerrar} autoFocus className="sk-boton-icono shrink-0" aria-label={t('dashboard.novedades.cerrar')}><X size={17} /></button>
        </div>
        <div className="overflow-y-auto p-5">
          {!datos ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted" /></div> : (
            <>
              {lista(actual)}
              {anteriores.length > 0 && (
                <div className="mt-5">
                  <button onClick={() => setVerAnteriores((v) => !v)} className="sk-foco text-sm font-semibold text-muted hover:text-fg" aria-expanded={verAnteriores}>
                    {verAnteriores ? t('dashboard.novedades.ocultarAnteriores') : t('dashboard.novedades.anteriores')}
                  </button>
                  {verAnteriores && anteriores.map((v) => (
                    <div key={v.version} className="mt-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{t('dashboard.novedades.version', { version: v.version })}</p>
                      {lista(v)}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <a href="/novedades" target="_blank" rel="noreferrer" className="text-xs font-semibold text-muted hover:text-fg">{t('dashboard.novedades.pagina')}</a>
          <button onClick={onCerrar} className="sk-foco rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand">{t('dashboard.novedades.entendido')}</button>
        </div>
      </div>
    </div>
  );
}
