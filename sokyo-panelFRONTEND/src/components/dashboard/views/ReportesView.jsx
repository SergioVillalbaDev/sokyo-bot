// Seguridad · Reportes — ajustes del sistema de reportes + bandeja de reportes
// recibidos con gestión (resolver / descartar).
import {useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../ui/primitives';
import { Flag, Save, Check, X, Info, Ticket, EyeOff, Lock } from 'lucide-react';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import EstadoAutoguardado from '../EstadoAutoguardado';
import { OpcionCrear } from '../CrearAlVuelo';
import VistaDiscord from '../VistaDiscord';
import { useDesdeServidor } from '../../../hooks/useDesdeServidor';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const ESTADO_META = {
  pendiente: { color: 'text-warning', bg: 'bg-warning/10' },
  resuelto: { color: 'text-success', bg: 'bg-success/10' },
  descartado: { color: 'text-muted', bg: 'bg-elevated' },
};

export default function ReportesView({ dash }) {
  const { t } = useTranslation();
  const { canales, roles = [], configServidor, guardarReportes, reportes, actualizarReporte, abrirTicketReporte } = dash;

  const [cfg, setCfg] = useState({ activo: false, canalId: null, ocultarAutor: true, rolesVerAutor: [] });
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [filtro, setFiltro] = useState('pendiente');

  useDesdeServidor(configServidor, () => {
    if (!configServidor) return;
    const r = configServidor.reportes || {};
    setCfg({ activo: !!r.activo, canalId: r.canalId || null, ocultarAutor: r.ocultarAutor !== false, rolesVerAutor: Array.isArray(r.rolesVerAutor) ? r.rolesVerAutor : [] });
  });

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarReportes(cfg);
    setGuardando(false);
    setGuardado(ok);
    return ok;
  };
  // Se guarda solo al dejar de tocar algo (hooks/useAutoguardado.js).
  const autoguardado = useAutoguardado(cfg, guardar, { listo: !!configServidor, borrador: 'reportes', restaurar: setCfg });

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
      <div data-help="reportes-ajustes" className={card}>
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
            <OpcionCrear tipo="canal" />
          </select>
        </label>
        {/* Quién reportó: oculto para el reportado y para el resto del staff (utils/reportes.js) */}
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-fg"><EyeOff size={15} className="text-brand" /> {t('dashboard.reportes_v.hideAuthor')}</p>
              <p className="text-xs leading-snug text-muted">{t('dashboard.reportes_v.hideAuthorDesc')}</p>
            </div>
            <Toggle checked={cfg.ocultarAutor} onChange={(v) => { setGuardado(false); setCfg((p) => ({ ...p, ocultarAutor: v })); }} />
          </div>
          {cfg.ocultarAutor && (
            <div>
              <p className="text-sm font-semibold text-fg">{t('dashboard.reportes_v.rolesSee')}</p>
              <p className="mb-2 text-xs leading-snug text-muted">{t('dashboard.reportes_v.rolesSeeDesc')}</p>
              <div className="flex flex-wrap items-center gap-2">
                {cfg.rolesVerAutor.map((id) => (
                  <span key={id} className="flex items-center gap-1 rounded-full border border-line bg-bg py-1 pl-3 pr-1.5 text-xs font-semibold text-fg">
                    @{roles.find((r) => r.id === id)?.nombre || id}
                    <button type="button" onClick={() => { setGuardado(false); setCfg((p) => ({ ...p, rolesVerAutor: p.rolesVerAutor.filter((x) => x !== id) })); }}
                      className="rounded-full p-0.5 text-muted hover:text-danger" aria-label={t('dashboard.reportes_v.removeRole')}><X size={12} /></button>
                  </span>
                ))}
                <select value="" onChange={(e) => { const id = e.target.value; if (!id) return; setGuardado(false); setCfg((p) => ({ ...p, rolesVerAutor: [...new Set([...p.rolesVerAutor, id])] })); }}
                  className={input + ' max-w-[220px]'}>
                  <option value="">{t('dashboard.reportes_v.rolesSeePh')}</option>
                  {roles.filter((r) => !cfg.rolesVerAutor.includes(r.id)).map((r) => <option key={r.id} value={r.id}>@{r.nombre}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !configServidor}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} /> {guardando ? t('dashboard.reportes_v.saving') : t('dashboard.reportes_v.save')}
          </button>
          <EstadoAutoguardado estado={autoguardado} />
          {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.reportes_v.saved')}</span>}
        </div>
      </div>

      {/* Cómo le llega al staff (utils/reportes.js: avisar) */}
      <div data-help="reportes-previa" className={card}>
        <h3 className="mb-3 font-bold text-fg">{t('dashboard.reportes_v.prevTitle')}</h3>
        <VistaDiscord
          embed={{
            titulo: t('dashboard.reportes_v.prevName'), color: '#e67e22', pie: 'ID: 6720a1f3',
            campos: [
              { nombre: t('dashboard.reportes_v.prevReported'), valor: '@Marc', inline: true },
              { nombre: t('dashboard.reportes_v.prevBy'), valor: cfg.ocultarAutor ? t('dashboard.reportes_v.prevHidden') : '@Alex', inline: true },
              { nombre: t('dashboard.reportes_v.prevChannel'), valor: '#general', inline: true },
              { nombre: t('dashboard.reportes_v.prevReason'), valor: t('dashboard.reportes_v.prevReasonVal') },
              { nombre: t('dashboard.reportes_v.prevMessage'), valor: t('dashboard.reportes_v.prevMessageVal') },
            ],
          }}
          botones={[{ texto: t('dashboard.reportes_v.prevResolve'), estilo: 'verde' }, { texto: t('dashboard.reportes_v.prevTicket'), estilo: 'azul' }, { texto: t('dashboard.reportes_v.prevDismiss'), estilo: 'gris' },
            ...(cfg.ocultarAutor ? [{ texto: t('dashboard.reportes_v.prevSeeWho'), estilo: 'gris' }] : [])]} />
      </div>

      {/* Bandeja */}
      <div data-help="reportes-bandeja" className={card}>
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
                    {r.autorOculto
                      ? <span className="text-muted"> · <Lock size={11} className="inline" /> {t('dashboard.reportes_v.byHidden')}</span>
                      : <span className="text-muted"> · {t('dashboard.reportes_v.by')} {r.reportanteTag}</span>}
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
