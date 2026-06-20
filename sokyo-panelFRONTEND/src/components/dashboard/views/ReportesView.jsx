// Seguridad · Reportes — ajustes del sistema de reportes + bandeja de reportes
// recibidos con gestión (resolver / descartar).
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../ui/primitives';
import { Flag, Save, Check, X, Info, Ticket } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const ESTADO_META = {
  pendiente: { color: 'text-warning', bg: 'bg-warning/10' },
  resuelto: { color: 'text-success', bg: 'bg-success/10' },
  descartado: { color: 'text-muted', bg: 'bg-elevated' },
};

export default function ReportesView({ dash }) {
  const { t } = useTranslation();
  const { canales, configServidor, guardarReportes, reportes, actualizarReporte, abrirTicketReporte } = dash;

  const [cfg, setCfg] = useState({ activo: false, canalId: null });
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [filtro, setFiltro] = useState('pendiente');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor) setCfg({ activo: !!(configServidor.reportes && configServidor.reportes.activo), canalId: (configServidor.reportes && configServidor.reportes.canalId) || null });
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarReportes(cfg);
    setGuardando(false);
    setGuardado(ok);
  };

  const lista = (reportes || []).filter((r) => filtro === 'todos' || r.estado === filtro);
  const fecha = (d) => new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.reportes_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.reportes_v.note')}</p>
      </div>

      {/* Ajustes */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold text-fg"><Flag size={18} className="text-brand" /> {t('dashboard.reportes_v.enable')}</h3>
          <Toggle checked={cfg.activo} onChange={(v) => { setGuardado(false); setCfg((p) => ({ ...p, activo: v })); }} />
        </div>
        <label className="mt-4 block border-t border-line pt-4">
          <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.reportes_v.channel')}</span>
          <select
            value={cfg.canalId || ''}
            onChange={(e) => { setGuardado(false); setCfg((p) => ({ ...p, canalId: e.target.value || null })); }}
            className={input + ' max-w-xs'}
          >
            <option value="">{t('dashboard.reportes_v.channelPh')}</option>
            {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !configServidor}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} /> {guardando ? t('dashboard.reportes_v.saving') : t('dashboard.reportes_v.save')}
          </button>
          {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.reportes_v.saved')}</span>}
        </div>
      </div>

      {/* Bandeja */}
      <div className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-fg">{t('dashboard.reportes_v.inbox')}</h3>
          <div className="flex gap-1.5">
            {['pendiente', 'resuelto', 'descartado', 'todos'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filtro === f ? 'bg-brand text-on-brand' : 'bg-bg text-muted hover:text-fg'}`}
              >
                {t(`dashboard.reportes_v.filter.${f}`)}
              </button>
            ))}
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-muted">{t('dashboard.reportes_v.empty')}</p>
        ) : (
          <div className="space-y-3">
            {lista.map((r) => {
              const meta = ESTADO_META[r.estado] || ESTADO_META.pendiente;
              return (
                <div key={r._id} className="rounded-2xl border border-line bg-bg p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.bg} ${meta.color}`}>{t(`dashboard.reportes_v.filter.${r.estado}`)}</span>
                    <span className="text-xs text-muted">{fecha(r.fecha)}</span>
                  </div>
                  <p className="mt-2 text-sm text-fg">
                    <span className="font-semibold">{r.reportadoTag || r.reportadoId || '—'}</span>
                    <span className="text-muted"> · {t('dashboard.reportes_v.by')} {r.reportanteTag}</span>
                  </p>
                  {r.motivo && <p className="mt-1 text-sm text-muted"><span className="font-semibold text-fg">{t('dashboard.reportes_v.reason')}:</span> {r.motivo}</p>}
                  {r.mensajeContenido && <p className="mt-1 rounded-lg bg-elevated px-3 py-2 text-xs italic text-muted">“{r.mensajeContenido}”</p>}
                  {r.estado === 'pendiente' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => actualizarReporte(r._id, 'resuelto')} className="flex items-center gap-1.5 rounded-xl bg-success/15 px-3 py-1.5 text-sm font-semibold text-success transition-colors hover:bg-success/25">
                        <Check size={15} /> {t('dashboard.reportes_v.resolve')}
                      </button>
                      <button type="button" onClick={() => abrirTicketReporte(r._id)} className="flex items-center gap-1.5 rounded-xl bg-brand/15 px-3 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/25">
                        <Ticket size={15} /> {t('dashboard.reportes_v.openTicket')}
                      </button>
                      <button type="button" onClick={() => actualizarReporte(r._id, 'descartado')} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg">
                        <X size={15} /> {t('dashboard.reportes_v.dismiss')}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {r.resueltoPor && <p className="text-xs text-muted">{t('dashboard.reportes_v.handledBy')} {r.resueltoPor}</p>}
                      {r.canalTicketId && <p className="flex items-center gap-1.5 text-xs font-semibold text-brand"><Ticket size={13} /> {t('dashboard.reportes_v.ticketLinked')}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
