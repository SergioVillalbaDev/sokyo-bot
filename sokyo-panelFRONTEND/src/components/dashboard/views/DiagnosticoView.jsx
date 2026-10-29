// «¿Por qué no funciona?»: el bot repasa lo que suele fallar sin que nadie lo
// note (permisos, canales o roles borrados, roles que no puede dar, módulos a
// medio configurar, la música) y dice cómo arreglarlo, con botón cuando se puede.
// Los textos de cada problema los manda la API en el idioma del panel.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stethoscope, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Wrench, ExternalLink, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch, procesarRespuesta } from '../../../lib/api';
import { cn } from '../../../lib/cn';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

export default function DiagnosticoView({ dash }) {
  const { t } = useTranslation();
  const { guildId, setActiveTab } = dash;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [arreglando, setArreglando] = useState(null);
  const [invitado, setInvitado] = useState(false);

  const comprobar = useCallback(async () => {
    if (!guildId) return;
    setCargando(true);
    try {
      const d = await apiFetch(`/api/diagnostico?guildId=${encodeURIComponent(guildId)}`).then(procesarRespuesta);
      setDatos(d); setError(false);
    } catch { setError(true); }
    setCargando(false);
  }, [guildId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la sección
  useEffect(() => { comprobar(); }, [comprobar]);

  const arreglar = async (p) => {
    setArreglando(p.id);
    try {
      const res = await apiFetch('/api/diagnostico/arreglar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, arreglo: p.arreglo }) });
      if (res.ok) await comprobar();
    } finally { setArreglando(null); }
  };

  const problemas = datos?.problemas || [];
  const errores = problemas.filter((p) => p.nivel === 'error').length;
  const avisos = problemas.length - errores;

  return (
    <div className="space-y-5">
      <div data-help="diag-resumen" className={cn(card, 'flex flex-col gap-4 sm:flex-row sm:items-center')}>
        <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-2xl', !datos ? 'bg-elevated text-muted' : errores ? 'bg-danger/15 text-danger' : avisos ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success')}>
          {cargando && !datos ? <Loader2 size={26} className="animate-spin" /> : errores ? <XCircle size={26} /> : avisos ? <AlertTriangle size={26} /> : <CheckCircle2 size={26} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold tracking-tight text-fg">
            {!datos ? t('dashboard.diagnostico.comprobando')
              : !problemas.length ? t('dashboard.diagnostico.todoBien')
                : t('dashboard.diagnostico.resumen', { errores, avisos })}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {datos ? t('dashboard.diagnostico.comprobados', { count: datos.comprobados }) : t('dashboard.diagnostico.queMira')}
          </p>
        </div>
        <button onClick={comprobar} disabled={cargando} className="sk-foco flex shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-elevated px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand/40 disabled:opacity-60">
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} /> {t('dashboard.diagnostico.otraVez')}
        </button>
      </div>

      {error && (
        <p className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{t('dashboard.diagnostico.error')}</p>
      )}

      {invitado && (
        <p className="rounded-2xl border border-brand/40 bg-brand/10 p-4 text-sm text-fg">{t('dashboard.diagnostico.trasInvitar')}</p>
      )}

      {datos && !problemas.length && (
        <div className={cn(card, 'text-center')}>
          <CheckCircle2 size={36} className="mx-auto text-success" />
          <p className="mt-2 font-semibold text-fg">{t('dashboard.diagnostico.todoBienSub')}</p>
          <p className="mt-1 text-sm text-muted">{t('dashboard.diagnostico.siAunFalla')}</p>
        </div>
      )}

      <ul data-help="diag-lista" className="space-y-3">
        {problemas.map((p) => {
          const esError = p.nivel === 'error';
          return (
            <li key={p.id} className={cn(card, 'border-l-4', esError ? 'border-l-danger' : 'border-l-warning')}>
              <div className="flex items-start gap-3">
                {esError ? <XCircle size={20} className="mt-0.5 shrink-0 text-danger" /> : <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning" />}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-fg">{p.titulo}</h3>
                  {p.detalle && <p className="mt-1 whitespace-pre-line text-sm text-muted">{p.detalle}</p>}
                  {p.solucion && (
                    <p className="mt-2 flex items-start gap-2 rounded-xl bg-elevated px-3 py-2 text-sm text-fg">
                      <Wrench size={15} className="mt-0.5 shrink-0 text-brand" /> <span>{p.solucion}</span>
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.arreglo?.accion === 'invitar' && (
                      <a href={p.arreglo.url} target="_blank" rel="noreferrer" onClick={() => setInvitado(true)}
                        className="sk-foco flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.02]">
                        <ExternalLink size={15} /> {t('dashboard.diagnostico.darPermisos')}
                      </a>
                    )}
                    {(p.arreglo?.accion === 'quitar' || p.arreglo?.accion === 'quitarDeLista') && (
                      <button onClick={() => arreglar(p)} disabled={arreglando === p.id}
                        className="sk-foco flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.02] disabled:opacity-60">
                        {arreglando === p.id ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />} {t('dashboard.diagnostico.quitar')}
                      </button>
                    )}
                    {p.tab && (
                      <button onClick={() => setActiveTab(p.tab)}
                        className="sk-foco flex items-center gap-1.5 rounded-xl border border-line bg-elevated px-3.5 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand/40">
                        {t('dashboard.diagnostico.irA', { seccion: t(`dashboard.nav.items.${p.tab}`) })} <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="flex items-center gap-2 text-xs text-muted"><Stethoscope size={14} /> {t('dashboard.diagnostico.nota')}</p>
    </div>
  );
}
