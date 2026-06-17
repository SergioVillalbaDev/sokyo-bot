// Registro de moderación — auditoría completa de todas las sanciones, con
// filtros, pruebas y revocación. Arriba, el ajuste del canal de mod-logs.
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { History, Hash, Save, Check, Search, Undo2, Clock, MessageSquare } from 'lucide-react';
import { Avatar, Badge, Toggle } from '../../ui/primitives';
import { ACCIONES, accionMeta, textoDuracion } from '../../../lib/sanciones';
import { API_URL } from '../../../lib/api';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const inputCls = 'w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand';
const srcPrueba = (p) => (/^https?:\/\//i.test(p) ? p : `${API_URL}${p}`);

// Cuenta atrás en vivo hasta `expiraEn` (se refresca cada segundo).
function CuentaAtras({ expiraEn }) {
  const { t } = useTranslation();
  const [ms, setMs] = useState(null);

  useEffect(() => {
    const tick = () => setMs(Math.max(0, new Date(expiraEn).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiraEn]);

  if (ms === null) return null; // primer render, antes del primer tick
  if (ms <= 0) {
    return <span className="flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted"><Clock size={11} /> {t('dashboard.mod_v.ended')}</span>;
  }

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const p2 = (n) => String(n).padStart(2, '0');
  const texto = d > 0 ? `${d}d ${p2(h)}:${p2(m)}:${p2(seg)}` : h > 0 ? `${h}:${p2(m)}:${p2(seg)}` : `${m}:${p2(seg)}`;

  return (
    <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
      <Clock size={11} /> {t('dashboard.mod_v.remaining')} {texto}
    </span>
  );
}

export default function RegistroSancionesView({ dash }) {
  const { t } = useTranslation();
  const { sanciones, canales, configServidor, guardarModLog, revocarSancion, cargarSanciones } = dash;

  // Ajustes de moderación (canal de registro + aviso por MD).
  const [canalSel, setCanalSel] = useState('');
  const [dmOverride, setDmOverride] = useState(null);
  const [guardado, setGuardado] = useState(false);
  // Valores actuales (de la config) con posible override local antes de guardar.
  const canalActual = configServidor?.canalModLogId || '';
  const canalValor = canalSel || canalActual;
  const dmActual = configServidor?.dmSancion !== false; // por defecto true
  const dmValor = dmOverride === null ? dmActual : dmOverride;

  // Filtros del registro.
  const [filtroAccion, setFiltroAccion] = useState('todos');
  const [filtroTexto, setFiltroTexto] = useState('');

  const guardarCanal = async () => {
    const ok = await guardarModLog({ canalModLogId: canalValor || null, dmSancion: dmValor });
    setGuardado(ok);
  };

  const lista = sanciones.filter((s) => {
    if (filtroAccion !== 'todos' && s.accion !== filtroAccion) return false;
    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase();
      return (s.usuarioTag || '').toLowerCase().includes(q) || (s.usuarioId || '').includes(q) || (s.motivo || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Canal de registro */}
      <div className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><Hash size={18} className="text-brand" /> {t('dashboard.mod_v.modLogChannel')}</h3>
        <p className="mb-3 text-xs text-muted">{t('dashboard.mod_v.modLogHint')}</p>
        <select value={canalValor} onChange={(e) => { setCanalSel(e.target.value); setGuardado(false); }} className={inputCls}>
          <option value="">{t('dashboard.mod_v.modLogNone')}</option>
          {canales.map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
        </select>

        {/* Aviso por MD al usuario sancionado */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg p-3">
          <div className="flex items-start gap-2.5">
            <MessageSquare size={16} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <p className="text-sm font-semibold text-fg">{t('dashboard.mod_v.dmTitle')}</p>
              <p className="text-xs text-muted">{t('dashboard.mod_v.dmHint')}</p>
            </div>
          </div>
          <Toggle checked={dmValor} onChange={(v) => { setDmOverride(v); setGuardado(false); }} />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={guardarCanal} className="flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
            <Save size={15} /> {t('dashboard.mod_v.save')}
          </button>
          {guardado && <span className="flex items-center gap-1.5 text-xs font-semibold text-success"><Check size={14} /> {t('dashboard.mod_v.saved')}</span>}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setFiltroAccion('todos')} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${filtroAccion === 'todos' ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}>{t('dashboard.mod_v.filterAll')}</button>
        {ACCIONES.map((a) => (
          <button key={a.id} onClick={() => setFiltroAccion(a.id)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${filtroAccion === a.id ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}>
            <a.icon size={13} style={{ color: a.color }} /> {t(`dashboard.mod_v.actions.${a.id}`)}
          </button>
        ))}
        <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} placeholder={t('dashboard.mod_v.filterUserPh')} className="w-full rounded-xl border border-line bg-bg py-2 pl-9 pr-3 text-sm text-fg outline-none focus:border-brand" />
        </div>
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-2 py-12 text-center`}>
          <History size={32} className="text-muted" />
          <p className="text-sm italic text-muted">{t('dashboard.mod_v.regEmpty')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {lista.map((s, i) => {
            const meta = accionMeta(s.accion);
            return (
              <motion.div key={s._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className={`${card} flex gap-4`} style={{ borderLeft: `4px solid ${meta.color}` }}>
                <Avatar src={s.usuarioAvatar} name={s.usuarioTag} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <meta.icon size={15} style={{ color: meta.color }} />
                    <span className="font-bold text-fg">{s.tipoNombre || t(`dashboard.mod_v.actions.${s.accion}`)}</span>
                    <Badge color={meta.color}>{t(`dashboard.mod_v.actions.${s.accion}`)}</Badge>
                    {s.duracionMin > 0 && <span className="text-xs text-muted">{textoDuracion(s.duracionMin, t)}</span>}
                    {!s.revocada && s.expiraEn && <CuentaAtras expiraEn={s.expiraEn} />}
                    {s.revocada && <Badge>{t('dashboard.mod_v.revoked')}</Badge>}
                    <span className="ml-auto text-xs text-muted">{new Date(s.fecha).toLocaleString('es-ES')}</span>
                  </div>
                  <p className="mt-1 text-sm text-fg">{s.usuarioTag} <span className="font-mono text-xs text-muted">({s.usuarioId})</span></p>
                  {s.motivo && <p className="mt-1 text-sm text-muted">{s.motivo}</p>}
                  <p className="mt-1 text-[11px] text-muted">{t('dashboard.mod_v.by')} {s.moderadorTag}{s.revocada ? ` · ${t('dashboard.mod_v.revoked')} ${s.revocadaPor || ''}` : ''}</p>
                  {s.pruebas?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.pruebas.map((p, j) => <a key={j} href={srcPrueba(p)} target="_blank" rel="noreferrer"><img src={srcPrueba(p)} alt="" className="h-12 w-12 rounded-lg border border-line object-cover" /></a>)}
                    </div>
                  )}
                </div>
                {!s.revocada && (s.accion === 'ban' || s.accion === 'timeout') && (
                  <button onClick={async () => { if (window.confirm(t('dashboard.mod_v.confirmRevoke'))) { await revocarSancion(s._id); cargarSanciones(); } }} className="flex h-9 shrink-0 items-center gap-1.5 self-start rounded-xl border border-line px-3 text-xs font-semibold text-muted transition-colors hover:border-brand/40 hover:text-fg" title={t('dashboard.mod_v.revoke')}>
                    <Undo2 size={14} /> {t('dashboard.mod_v.revoke')}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
