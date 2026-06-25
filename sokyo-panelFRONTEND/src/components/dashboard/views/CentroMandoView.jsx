// Centro de Mando — el panel "espectacular" de moderación.
// Tarjetas de estado + buscador de usuario + ficha del usuario + historial +
// botones de sanción (tus tipos) que aplican al instante con motivo y pruebas.
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Search, ShieldAlert, Hammer, Clock, ListChecks, Crown, CalendarDays, UserCheck, X, Send, Upload, Loader2, Undo2, Gavel, Activity, MessageSquare, Mic,
  Users, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Avatar, Badge } from '../../ui/primitives';
import { ACCIONES, accionMeta, textoDuracion, aUnidad, aMinutos } from '../../../lib/sanciones';
import { API_URL } from '../../../lib/api';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const srcPrueba = (p) => (/^https?:\/\//i.test(p) ? p : `${API_URL}${p}`);
const fecha = (ts) => (ts ? new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fechaHora = (ts) => (ts ? new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export default function CentroMandoView({ dash }) {
  const { t } = useTranslation();
  const {
    tiposSancion, statsSancion, sanciones, buscarMiembros, cargarMiembro,
    cargarActividad, cargarMensajesUsuario, revocarSancion, cargarSanciones, cargarStatsSancion, setActiveTab,
    objetivoMod, setObjetivoMod,
  } = dash;

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [actividad, setActividad] = useState(null);
  const [mensajesUsuario, setMensajesUsuario] = useState([]);
  const [tipoAplicar, setTipoAplicar] = useState(null);
  const [bulkAbierto, setBulkAbierto] = useState(false);

  const historial = usuario ? sanciones.filter((s) => s.usuarioId === usuario.id) : [];

  const buscar = async (q) => {
    setBusqueda(q);
    setBuscando(true);
    setResultados(await buscarMiembros(q));
    setBuscando(false);
  };

  // Carga ficha + actividad + registro de mensajes de un usuario a la vez.
  const cargarTodo = async (userId) => {
    const [ficha, act, msgs] = await Promise.all([cargarMiembro(userId), cargarActividad(userId), cargarMensajesUsuario(userId)]);
    setUsuario(ficha);
    setActividad(act);
    setMensajesUsuario(msgs);
  };

  const seleccionar = async (m) => {
    setResultados([]);
    setBusqueda('');
    await cargarTodo(m.id);
  };

  // Si se llega desde "Ver en moderación" (otra vista), preselecciona ese usuario.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (objetivoMod) {
      cargarTodo(objetivoMod);
      setObjetivoMod(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivoMod]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const refrescar = async () => {
    await cargarSanciones();
    cargarStatsSancion();
    if (usuario) await cargarTodo(usuario.id);
  };

  const stats = statsSancion || { total: 0, bansActivos: 0, recientes7d: 0, porAccion: {} };
  const tarjetas = [
    { id: 'total', label: t('dashboard.mod_v.statTotal'), value: stats.total, icon: ShieldAlert, color: 'var(--accent-color)' },
    { id: 'bans', label: t('dashboard.mod_v.statActiveBans'), value: stats.bansActivos, icon: Hammer, color: '#ef4444' },
    { id: 'recientes', label: t('dashboard.mod_v.statLast7'), value: stats.recientes7d, icon: Clock, color: '#f59e0b' },
    { id: 'tipos', label: t('dashboard.mod_v.statTypes'), value: tiposSancion.length, icon: ListChecks, color: '#10b981' },
  ];

  return (
    <div className="space-y-5">
      {/* Tarjetas de estado */}
      <div data-help="modcentro-stats" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tarjetas.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-3xl border border-line bg-card p-4 shadow-soft">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${s.color}1f`, color: s.color }}><s.icon size={18} /></span>
            <p className="mt-3 text-2xl font-extrabold text-fg">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        {/* ===== Columna izquierda: usuario + historial ===== */}
        <div className="space-y-5">
          {/* Buscador */}
          <div data-help="modcentro-buscar" className={card}>
            <h3 className="mb-3 flex items-center gap-2 font-bold text-fg"><Search size={18} className="text-brand" /> {t('dashboard.mod_v.searchUser')}</h3>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={busqueda} onChange={(e) => buscar(e.target.value)} onFocus={() => { if (!resultados.length) buscar(busqueda); }} placeholder={t('dashboard.mod_v.searchPlaceholder')} className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-3 text-sm text-fg outline-none focus:border-brand" />
              {buscando && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />}
            </div>
            {resultados.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {resultados.map((m) => (
                  <button key={m.id} onClick={() => seleccionar(m)} className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-bg px-3 py-2 text-left transition-colors hover:border-brand/40">
                    <Avatar src={m.avatar} name={m.displayName} size={28} />
                    <span className="truncate text-sm text-fg">{m.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ficha del usuario */}
          {!usuario ? (
            <div className={`${card} flex flex-col items-center gap-2 py-12 text-center`}>
              <Gavel size={32} className="text-muted" />
              <p className="text-sm italic text-muted">{t('dashboard.mod_v.selectUserHint')}</p>
            </div>
          ) : (
            <>
              <div className={card}>
                <div className="flex items-center gap-4">
                  <Avatar src={usuario.avatar} name={usuario.displayName} size={64} />
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-2 truncate text-lg font-extrabold text-fg">
                      {usuario.displayName}
                      {usuario.esDueño && <Crown size={16} className="text-amber-400" title={t('dashboard.mod_v.owner')} />}
                    </h3>
                    <p className="truncate text-xs text-muted">@{usuario.tag} · <span className="font-mono">{usuario.id}</span></p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {usuario.baneado && <Badge color="#ef4444">{t('dashboard.mod_v.banned')}</Badge>}
                      <Badge color={usuario.enServidor ? 'var(--success)' : undefined}>{usuario.enServidor ? t('dashboard.mod_v.inServer') : t('dashboard.mod_v.notInServer')}</Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-line bg-bg px-3 py-2">
                    <p className="flex items-center gap-1.5 text-muted"><UserCheck size={13} /> {t('dashboard.mod_v.joined')}</p>
                    <p className="mt-0.5 font-semibold text-fg">{fecha(usuario.entradaTimestamp)}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-bg px-3 py-2">
                    <p className="flex items-center gap-1.5 text-muted"><CalendarDays size={13} /> {t('dashboard.mod_v.created')}</p>
                    <p className="mt-0.5 font-semibold text-fg">{fecha(usuario.creadoTimestamp)}</p>
                  </div>
                </div>
                {usuario.roles?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {usuario.roles.slice(0, 12).map((r) => (
                      <span key={r.id} className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold" style={{ color: r.color !== '#000000' ? r.color : undefined }}>{r.nombre}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actividad del usuario (vigilancia) */}
              <div className={card}>
                <h3 className="mb-3 flex items-center gap-2 font-bold text-fg"><Activity size={18} className="text-brand" /> {t('dashboard.mod_v.activityTitle')}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-bg px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted"><MessageSquare size={13} /> {t('dashboard.mod_v.lastMessage')}</p>
                    <p className="mt-0.5 text-sm font-semibold text-fg">{actividad?.ultimoMensajeFecha ? fechaHora(actividad.ultimoMensajeFecha) : t('dashboard.mod_v.noData')}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-bg px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted"><Mic size={13} /> {t('dashboard.mod_v.voice')}</p>
                    <p className="mt-0.5 text-sm font-semibold text-fg">
                      {usuario.vozCanal ? <span className="text-success">🟢 {usuario.vozCanal.nombre}</span>
                        : actividad?.ultimaVozFecha ? fechaHora(actividad.ultimaVozFecha) : t('dashboard.mod_v.noData')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-bg px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted"><MessageSquare size={13} /> {t('dashboard.mod_v.msgCount')}</p>
                    <p className="mt-0.5 text-sm font-semibold text-fg">{actividad?.mensajesTotal || 0}</p>
                  </div>
                </div>

                {/* Registro de mensajes */}
                <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.mod_v.msgLog')}</p>
                {mensajesUsuario.length === 0 ? (
                  <p className="text-sm italic text-muted">{t('dashboard.mod_v.noMsgLog')}</p>
                ) : (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                    {mensajesUsuario.map((msg) => (
                      <div key={msg._id} className="rounded-lg border border-line bg-bg px-3 py-2">
                        <p className="text-sm text-fg">{msg.contenido || <span className="italic text-muted">{t('dashboard.mod_v.attachment')}</span>}</p>
                        <p className="mt-0.5 text-[11px] text-muted">{fechaHora(msg.fecha)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historial del usuario */}
              <div className={card}>
                <h3 className="mb-3 flex items-center gap-2 font-bold text-fg"><Clock size={18} className="text-brand" /> {t('dashboard.mod_v.historyTitle')} <span className="text-sm font-normal text-muted">({historial.length})</span></h3>
                {historial.length === 0 ? (
                  <p className="py-3 text-center text-sm italic text-muted">{t('dashboard.mod_v.noHistory')}</p>
                ) : (
                  <div className="space-y-2">
                    {historial.map((s) => {
                      const meta = accionMeta(s.accion);
                      return (
                        <div key={s._id} className="rounded-xl border border-line bg-bg p-3" style={{ borderLeft: `3px solid ${meta.color}` }}>
                          <div className="flex items-center gap-2">
                            <meta.icon size={14} style={{ color: meta.color }} />
                            <span className="text-sm font-semibold text-fg">{s.tipoNombre || t(`dashboard.mod_v.actions.${s.accion}`)}</span>
                            {s.duracionMin > 0 && <span className="text-xs text-muted">· {textoDuracion(s.duracionMin, t)}</span>}
                            <span className="ml-auto text-[11px] text-muted">{new Date(s.fecha).toLocaleDateString('es-ES')}</span>
                          </div>
                          {s.motivo && <p className="mt-1 text-xs text-muted">{s.motivo}</p>}
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-[11px] text-muted">{t('dashboard.mod_v.by')} {s.moderadorTag}</span>
                            {s.revocada ? <Badge>{t('dashboard.mod_v.revoked')}</Badge>
                              : (s.accion === 'ban' || s.accion === 'timeout') && (
                                <button onClick={async () => { if (window.confirm(t('dashboard.mod_v.confirmRevoke'))) { await revocarSancion(s._id); refrescar(); } }} className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:opacity-80"><Undo2 size={12} /> {t('dashboard.mod_v.revoke')}</button>
                              )}
                          </div>
                          {s.pruebas?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {s.pruebas.map((p, i) => <a key={i} href={srcPrueba(p)} target="_blank" rel="noreferrer"><img src={srcPrueba(p)} alt="" className="h-10 w-10 rounded-lg border border-line object-cover" /></a>)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ===== Columna derecha: botones de sanción ===== */}
        <div data-help="modcentro-aplicar" className={`${card} h-fit`}>
          <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><Gavel size={18} className="text-brand" /> {t('dashboard.mod_v.applyTitle')}</h3>
          <p className="mb-4 text-xs text-muted">{usuario ? t('dashboard.mod_v.applyOn', { user: usuario.displayName }) : t('dashboard.mod_v.applyPickFirst')}</p>

          {/* Acción masiva: misma sanción a varios usuarios (lista de IDs) */}
          <button
            onClick={() => setBulkAbierto(true)}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-bg px-3 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand/40"
          >
            <Users size={16} className="text-brand" /> {t('dashboard.mod_v.bulkBtn')}
          </button>

          {/* Acciones rápidas (sin tipo pre-creado) */}
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{t('dashboard.mod_v.quickActions')}</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {ACCIONES.map((a) => (
              <button
                key={a.id}
                onClick={() => setTipoAplicar({ accion: a.id, esRapida: true, color: a.color })}
                disabled={!usuario}
                className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-xs font-semibold text-fg transition-colors hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <a.icon size={15} style={{ color: a.color }} /> {t(`dashboard.mod_v.actions.${a.id}`)}
              </button>
            ))}
          </div>

          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{t('dashboard.mod_v.yourTypes')}</p>
          {tiposSancion.length === 0 ? (
            <button onClick={() => setActiveTab('mod-tipos')} className="w-full rounded-2xl border border-dashed border-line p-4 text-sm text-muted transition-colors hover:text-fg">{t('dashboard.mod_v.noTypesGo')}</button>
          ) : (
            <div className="space-y-2">
              {tiposSancion.map((tipo) => {
                const meta = accionMeta(tipo.accion);
                return (
                  <button
                    key={tipo._id}
                    onClick={() => setTipoAplicar(tipo)}
                    disabled={!usuario}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-bg p-3 text-left transition-all hover:border-brand/40 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ borderLeft: `4px solid ${tipo.color || meta.color}` }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ background: `${tipo.color || meta.color}22`, color: tipo.color || meta.color }}>{tipo.emoji || <meta.icon size={16} />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-fg">{tipo.nombre}</p>
                      <p className="text-[11px] text-muted">{t(`dashboard.mod_v.actions.${tipo.accion}`)} · {textoDuracion(tipo.duracionMin, t)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {tipoAplicar && usuario && (
          <AplicarModal
            tipo={tipoAplicar}
            usuario={usuario}
            dash={dash}
            onClose={() => setTipoAplicar(null)}
            onAplicado={() => { setTipoAplicar(null); refrescar(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkAbierto && (
          <BulkModal
            dash={dash}
            onClose={() => setBulkAbierto(false)}
            onDone={refrescar}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Modal de acción masiva (misma sanción a una lista de IDs) ---
function BulkModal({ dash, onClose, onDone }) {
  const { t } = useTranslation();
  const { aplicarSancionMasiva } = dash;

  const [idsText, setIdsText] = useState('');
  const [accion, setAccion] = useState('ban');
  const [valor, setValor] = useState(0);
  const [unidad, setUnidad] = useState('dias');
  const [motivo, setMotivo] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  // IDs únicos a partir del texto (separados por espacios, comas o saltos de línea).
  const ids = [...new Set(idsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
  const usaDuracion = accion === 'timeout' || accion === 'ban';

  const aplicar = async () => {
    if (!ids.length) { setError(t('dashboard.mod_v.bulkNoIds')); return; }
    setAplicando(true); setError('');
    const payload = { usuarioIds: ids, accion, motivo: motivo.trim() };
    if (usaDuracion) payload.duracionMin = aMinutos(Number(valor) || 0, unidad);
    const res = await aplicarSancionMasiva(payload);
    setAplicando(false);
    if (res?.success) { setResultado(res); onDone?.(); }
    else setError(res?.error || t('dashboard.mod_v.bulkError'));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-fg"><Users size={18} className="text-brand" /> {t('dashboard.mod_v.bulkTitle')}</h2>
          <button onClick={onClose} className="text-muted transition-colors hover:text-fg"><X size={20} /></button>
        </div>

        {resultado ? (
          /* Resumen de la operación */
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
              <CheckCircle2 size={18} /> {t('dashboard.mod_v.bulkApplied', { ok: resultado.aplicadas.length, total: resultado.total })}
            </div>
            {resultado.fallidas.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><AlertCircle size={13} className="text-danger" /> {t('dashboard.mod_v.bulkFailedTitle')} ({resultado.fallidas.length})</p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {resultado.fallidas.map((f) => (
                    <div key={f.usuarioId} className="rounded-lg border border-line bg-bg px-3 py-2 text-xs">
                      <span className="font-mono text-fg">{f.usuarioId}</span>
                      <span className="text-muted"> — {f.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={onClose} className="rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand">{t('dashboard.mod_v.bulkClose')}</button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted">{t('dashboard.mod_v.bulkDesc')}</p>

            {/* IDs */}
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.bulkIdsLabel')}</label>
            <textarea value={idsText} onChange={(e) => setIdsText(e.target.value)} rows={4} placeholder={'123456789012345678\n234567890123456789'} className="w-full resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 font-mono text-xs text-fg outline-none focus:border-brand" />
            <p className="mb-4 mt-1 text-[11px] text-muted">{t('dashboard.mod_v.bulkCount', { n: ids.length })}</p>

            {/* Acción */}
            <label className="mb-2 block text-xs font-semibold text-muted">{t('dashboard.mod_v.bulkActionLabel')}</label>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {ACCIONES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccion(a.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${accion === a.id ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}
                >
                  <a.icon size={15} style={{ color: a.color }} /> {t(`dashboard.mod_v.actions.${a.id}`)}
                </button>
              ))}
            </div>

            {/* Duración (timeout / ban) */}
            {usaDuracion && (
              <>
                <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.duration')}</label>
                <div className="mb-1 flex gap-2">
                  <input type="number" min={0} value={valor} onChange={(e) => setValor(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand" />
                  <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand">
                    <option value="min">{t('dashboard.mod_v.unitMin')}</option>
                    <option value="horas">{t('dashboard.mod_v.unitHours')}</option>
                    <option value="dias">{t('dashboard.mod_v.unitDays')}</option>
                  </select>
                </div>
                <p className="mb-4 text-xs text-muted">{accion === 'ban' && Number(valor) === 0 ? t('dashboard.mod_v.banPermanentHint') : t('dashboard.mod_v.timeoutMaxHint')}</p>
              </>
            )}

            {/* Motivo */}
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.reason')}</label>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder={t('dashboard.mod_v.reasonPh')} className="mb-4 w-full resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand" />

            {error && <p className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">{t('dashboard.mod_v.cancel')}</button>
              <button onClick={aplicar} disabled={aplicando || !ids.length} className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50">
                {aplicando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {t('dashboard.mod_v.bulkApply', { n: ids.length })}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// --- Modal de aplicar sanción (motivo + pruebas) ---
function AplicarModal({ tipo, usuario, dash, onClose, onAplicado }) {
  const { t } = useTranslation();
  const { aplicarSancion, subirPrueba } = dash;
  const meta = accionMeta(tipo.accion);

  // Modo rápido: la sanción no viene de un tipo guardado (no tiene _id).
  const esRapida = !tipo._id;
  const usaDuracion = esRapida && (tipo.accion === 'timeout' || tipo.accion === 'ban');
  const durIni = aUnidad(tipo.duracionMin || 0);

  const [motivo, setMotivo] = useState('');
  const [pruebas, setPruebas] = useState([]);
  const [urlPrueba, setUrlPrueba] = useState('');
  const [valor, setValor] = useState(tipo.accion === 'timeout' ? 10 : durIni.valor);
  const [unidad, setUnidad] = useState(tipo.accion === 'timeout' ? 'min' : durIni.unidad || 'dias');
  const [subiendo, setSubiendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState('');

  const duracionFinal = usaDuracion ? aMinutos(Number(valor) || 0, unidad) : (tipo.duracionMin || 0);
  const nombreMostrar = tipo.nombre || t(`dashboard.mod_v.actions.${tipo.accion}`);

  const addUrl = () => { if (/^https?:\/\//i.test(urlPrueba.trim())) { setPruebas([...pruebas, urlPrueba.trim()]); setUrlPrueba(''); } };
  const onSubir = (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const lector = new FileReader();
    lector.onload = async () => { setSubiendo(true); const r = await subirPrueba(lector.result); setSubiendo(false); if (r?.url) setPruebas((p) => [...p, r.url]); else setError(r?.error || 'Error al subir'); };
    lector.readAsDataURL(file);
  };

  const aplicar = async () => {
    setAplicando(true); setError('');
    const payload = { usuarioId: usuario.id, motivo: motivo.trim(), pruebas };
    if (tipo._id) payload.tipoId = tipo._id;
    else { payload.accion = tipo.accion; payload.duracionMin = duracionFinal; }
    const res = await aplicarSancion(payload);
    setAplicando(false);
    if (res?.success) onAplicado();
    else setError(res?.error || 'No se pudo aplicar');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-fg"><span style={{ color: tipo.color || meta.color }}>{tipo.emoji || <meta.icon size={18} />}</span> {nombreMostrar}</h2>
          <button onClick={onClose} className="text-muted transition-colors hover:text-fg"><X size={20} /></button>
        </div>

        {/* Objetivo */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-bg p-3">
          <Avatar src={usuario.avatar} name={usuario.displayName} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{usuario.displayName}</p>
            <p className="text-[11px] text-muted">{t(`dashboard.mod_v.actions.${tipo.accion}`)} · {textoDuracion(duracionFinal, t)}</p>
          </div>
        </div>

        {/* Duración (solo en acciones rápidas de aislamiento / ban) */}
        {usaDuracion && (
          <>
            <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.duration')}</label>
            <div className="mb-1 flex gap-2">
              <input type="number" min={0} value={valor} onChange={(e) => setValor(Math.max(0, parseInt(e.target.value, 10) || 0))} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand" />
              <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand">
                <option value="min">{t('dashboard.mod_v.unitMin')}</option>
                <option value="horas">{t('dashboard.mod_v.unitHours')}</option>
                <option value="dias">{t('dashboard.mod_v.unitDays')}</option>
              </select>
            </div>
            <p className="mb-4 text-xs text-muted">{tipo.accion === 'ban' && Number(valor) === 0 ? t('dashboard.mod_v.banPermanentHint') : t('dashboard.mod_v.timeoutMaxHint')}</p>
          </>
        )}

        {/* Motivo */}
        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.reason')}</label>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder={t('dashboard.mod_v.reasonPh')} className="mb-4 w-full resize-none rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand" />

        {/* Pruebas */}
        <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.mod_v.evidence')}</label>
        <div className="flex gap-2">
          <input value={urlPrueba} onChange={(e) => setUrlPrueba(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUrl()} placeholder={t('dashboard.mod_v.evidenceUrlPh')} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand" />
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-bg px-3 text-sm font-semibold text-muted hover:text-fg">
            {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={onSubir} />
          </label>
        </div>
        {pruebas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pruebas.map((p, i) => (
              <div key={i} className="relative">
                <img src={srcPrueba(p)} alt="" className="h-14 w-14 rounded-lg border border-line object-cover" />
                <button onClick={() => setPruebas(pruebas.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"><X size={11} /></button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">{t('dashboard.mod_v.cancel')}</button>
          <button onClick={aplicar} disabled={aplicando} className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: tipo.color || meta.color }}>
            {aplicando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {t('dashboard.mod_v.applyBtn')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
