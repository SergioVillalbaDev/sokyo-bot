// Vista «Miembros»: todo el servidor en una lista, con buscador y filtros, y en
// cada persona los botones Aislar · Expulsar · Banear a la vista (antes había que
// buscarla en el Centro de mando). Pestaña aparte con los baneados para quitar
// un ban. Las sanciones usan el mismo formulario que el Centro de mando.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Users, VolumeX, LogOut, Hammer, Loader2, Crown, Bot, Copy, Check, IdCard, Undo2, RefreshCw, UserPlus, X } from 'lucide-react';
import { Avatar, Badge } from '../../ui/primitives';
import { apiFetch } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { AplicarModal } from './CentroMandoView';
import FichaRapida from '../FichaRapida';
import { OpcionCrear } from '../CrearAlVuelo';

const card = 'rounded-3xl border border-line bg-card shadow-soft';
const FILTROS = ['todos', 'personas', 'nuevos', 'aislados', 'bots'];
const ACCIONES = [
  { id: 'timeout', clave: 'aislar', icon: VolumeX, color: '#e67e22' },
  { id: 'expulsion', clave: 'expulsar', icon: LogOut, color: '#e74c3c' },
  { id: 'ban', clave: 'ban', icon: Hammer, color: '#992d22' },
];

// «hace 3 días», «hace 2 meses»… en el idioma del panel.
function haceCuanto(ts, lng) {
  if (!ts) return '—';
  const seg = Math.round((ts - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' });
  const pasos = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']];
  let valor = seg;
  for (const [tope, unidad] of pasos) {
    if (Math.abs(valor) < tope) return rtf.format(Math.round(valor), unidad);
    valor /= tope;
  }
  return '—';
}

export default function MiembrosView({ dash }) {
  const { t, i18n } = useTranslation();
  const { guildId, roles = [], setObjetivoMod, setActiveTab } = dash;
  const [pestana, setPestana] = useState('miembros');
  const [q, setQ] = useState('');
  const [buscado, setBuscado] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [rol, setRol] = useState('');
  const [orden, setOrden] = useState('reciente');
  const [datos, setDatos] = useState({ total: 0, totalServidor: 0, miembros: [] });
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [sancion, setSancion] = useState(null); // { tipo, usuario }
  const [copiado, setCopiado] = useState(null);
  const [marcados, setMarcados] = useState(() => new Set()); // ids para las acciones en grupo
  const [enGrupo, setEnGrupo] = useState(null); // acción en grupo abierta: 'timeout' | 'expulsion' | 'ban' | 'rol'
  const pedido = useRef(0);

  // Buscar mientras se escribe, sin pedir a cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setBuscado(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const cargar = useCallback(async (pag) => {
    if (!guildId) return;
    const mio = ++pedido.current;
    setCargando(true); setError('');
    const params = new URLSearchParams({ guildId, q: buscado, filtro, orden, pagina: String(pag), porPagina: '50' });
    if (rol) params.set('rol', rol);
    try {
      const res = await apiFetch(`/api/servidor/miembros/lista?${params}`);
      const d = await res.json().catch(() => ({}));
      if (mio !== pedido.current) return; // llegó tarde: ya se pidió otra cosa
      if (!res.ok) { setError(d.error || t('dashboard.miembros_v.loadError')); return; }
      setDatos((prev) => (pag === 0 ? d : { ...d, miembros: [...prev.miembros, ...(d.miembros || [])] }));
      setPagina(pag);
    } catch {
      if (mio === pedido.current) setError(t('dashboard.miembros_v.loadError'));
    } finally {
      if (mio === pedido.current) setCargando(false);
    }
  }, [guildId, buscado, filtro, orden, rol, t]);

  // Al cambiar la búsqueda o un filtro se vuelve a la primera página.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- es la carga de datos de la vista
  useEffect(() => { if (pestana === 'miembros') cargar(0); }, [cargar, pestana]);

  const copiarId = async (id) => {
    try { await navigator.clipboard.writeText(id); setCopiado(id); setTimeout(() => setCopiado((c) => (c === id ? null : c)), 1600); } catch { /* sin portapapeles */ }
  };
  const verFicha = (id) => { setObjetivoMod(id); setActiveTab('mod-centro'); };
  const hayMas = datos.miembros.length < datos.total;
  const marcar = (id) => setMarcados((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const seleccion = datos.miembros.filter((m) => marcados.has(m.id));
  const marcables = datos.miembros.filter((m) => !m.esDueno && !m.bot);
  const todosMarcados = marcables.length > 0 && marcables.every((m) => marcados.has(m.id));

  return (
    <div className="space-y-5">
      {/* Pestañas: miembros · baneados */}
      <div className="flex flex-wrap items-center gap-2">
        {['miembros', 'baneados'].map((p) => (
          <button
            key={p} type="button" onClick={() => setPestana(p)} aria-pressed={pestana === p}
            className={cn('flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-colors',
              pestana === p ? 'border-brand bg-brand/15 text-fg' : 'border-line text-muted hover:text-fg')}
          >
            {p === 'miembros' ? <Users size={16} /> : <Hammer size={16} />} {t(`dashboard.miembros_v.tabs.${p}`)}
            {p === 'miembros' && datos.totalServidor > 0 && <span className="rounded-full bg-elevated px-2 py-0.5 text-xs">{datos.totalServidor.toLocaleString(i18n.language)}</span>}
          </button>
        ))}
      </div>

      {pestana === 'baneados' ? <Baneados guildId={guildId} /> : (
        <>
          {/* Buscador y filtros (siempre a la vista al bajar por la lista) */}
          <div data-help="miembros-filtros" className="sk-flotante sticky top-0 z-20 space-y-3 rounded-2xl border border-line p-3 shadow-lg">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dashboard.miembros_v.search')} aria-label={t('dashboard.miembros_v.search')}
                  className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-3 text-sm text-fg outline-none focus:border-brand"
                />
              </div>
              <select value={rol} onChange={(e) => setRol(e.target.value)} aria-label={t('dashboard.miembros_v.role')} className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-brand sm:w-48">
                <option value="">{t('dashboard.miembros_v.anyRole')}</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label={t('dashboard.miembros_v.sort')} className="rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-brand sm:w-44">
                {['reciente', 'antiguo', 'nombre'].map((o) => <option key={o} value={o}>{t(`dashboard.miembros_v.sorts.${o}`)}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTROS.map((f) => (
                <button
                  key={f} type="button" onClick={() => setFiltro(f)} aria-pressed={filtro === f}
                  className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    filtro === f ? 'border-brand bg-brand/15 text-fg' : 'border-line text-muted hover:text-fg')}
                >
                  {t(`dashboard.miembros_v.filters.${f}`)}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted">{t('dashboard.miembros_v.count', { count: datos.total })}</span>
            </div>
            {/* Acciones en grupo: con alguien marcado, aquí arriba (siempre a la vista). */}
            {seleccion.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                <span className="mr-1 text-sm font-bold text-fg">{t('dashboard.miembros_v.grupo.marcados', { count: seleccion.length })}</span>
                {ACCIONES.map((a) => (
                  <button key={a.id} type="button" onClick={() => setEnGrupo(a.id)}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-current" style={{ color: a.color }}>
                    <a.icon size={14} /> <span className="text-fg">{t(`dashboard.miembros_v.actions.${a.clave}`)}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setEnGrupo('rol')} className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-2.5 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand">
                  <UserPlus size={14} className="text-brand" /> {t('dashboard.miembros_v.grupo.darRol')}
                </button>
                <button type="button" onClick={() => setMarcados(new Set())} className="ml-auto flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-muted hover:text-fg">
                  <X size={13} /> {t('dashboard.miembros_v.grupo.quitar')}
                </button>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
              <button onClick={() => cargar(0)} className="ml-auto flex items-center gap-1 font-semibold underline-offset-2 hover:underline"><RefreshCw size={14} /> {t('dashboard.miembros_v.retry')}</button>
            </p>
          )}

          {!cargando && !error && datos.miembros.length === 0 ? (
            <div className={`${card} flex flex-col items-center gap-2 p-12 text-center`}>
              <Users size={32} className="text-muted" />
              <p className="text-sm italic text-muted">{t('dashboard.miembros_v.empty')}</p>
            </div>
          ) : (
            <div data-help="miembros-lista" className={`${card} divide-y divide-line overflow-hidden`}>
              {marcables.length > 1 && (
                <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2 text-xs font-semibold text-muted sm:px-4">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent-color)]" checked={todosMarcados}
                    onChange={() => setMarcados(todosMarcados ? new Set() : new Set(marcables.map((m) => m.id)))} />
                  {t('dashboard.miembros_v.grupo.todos', { count: marcables.length })}
                </label>
              )}
              {datos.miembros.map((m) => (
                <div key={m.id} className={cn('flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-4', marcados.has(m.id) && 'bg-brand/5')}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--accent-color)] disabled:opacity-30" disabled={m.esDueno || m.bot}
                      checked={marcados.has(m.id)} onChange={() => marcar(m.id)} aria-label={t('dashboard.miembros_v.grupo.marcar', { name: m.displayName })} />
                    <Avatar src={m.avatar} name={m.displayName} size={40} />
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-1.5">
                        <FichaRapida userId={m.id} guildId={guildId}><span tabIndex={0} className="sk-foco cursor-help truncate rounded font-bold text-fg">{m.displayName}</span></FichaRapida>
                        {m.esDueno && <Crown size={14} className="shrink-0 text-amber-400" aria-label={t('dashboard.mod_v.owner')} />}
                        {m.bot && <Bot size={14} className="shrink-0 text-brand" aria-label="Bot" />}
                      </p>
                      <p className="truncate text-xs text-muted">
                        @{m.username} · {t('dashboard.miembros_v.joined', { when: haceCuanto(m.unidoEn, i18n.language) })}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {m.aisladoHasta && <Badge color="#e67e22">{t('dashboard.miembros_v.timedOutUntil', { when: new Date(m.aisladoHasta).toLocaleString(i18n.language, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</Badge>}
                        {m.roles.map((r) => <Badge key={r.id} color={r.color && r.color !== '#000000' ? r.color : undefined}>{r.nombre}</Badge>)}
                        {m.totalRoles > m.roles.length && <span className="text-[11px] text-muted">+{m.totalRoles - m.roles.length}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="grid shrink-0 grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-1.5 sm:flex">
                    {ACCIONES.map((a) => {
                      const puede = m.puede?.[a.clave];
                      return (
                        <button
                          key={a.id} type="button" disabled={!puede}
                          onClick={() => setSancion({ tipo: { accion: a.id, esRapida: true, color: a.color }, usuario: m })}
                          title={puede ? t(`dashboard.miembros_v.actions.${a.clave}`) : t('dashboard.miembros_v.cantTouch')}
                          aria-label={`${t(`dashboard.miembros_v.actions.${a.clave}`)}: ${m.displayName}`}
                          className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-bg px-2 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-current disabled:cursor-not-allowed disabled:opacity-35 sm:px-2.5"
                          style={puede ? { color: a.color } : undefined}
                        >
                          <a.icon size={14} /> <span className="text-fg">{t(`dashboard.miembros_v.actions.${a.clave}`)}</span>
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => verFicha(m.id)} className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-bg text-muted transition-colors hover:text-fg" title={t('dashboard.miembros_v.profile')} aria-label={t('dashboard.miembros_v.profile')}>
                      <IdCard size={15} />
                    </button>
                    <button type="button" onClick={() => copiarId(m.id)} className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-bg text-muted transition-colors hover:text-fg" title={t('dashboard.miembros_v.copyId')} aria-label={t('dashboard.miembros_v.copyId')}>
                      {copiado === m.id ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              ))}
              {cargando && (
                <p className="flex items-center justify-center gap-2 p-5 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> {t('dashboard.miembros_v.loading')}</p>
              )}
            </div>
          )}

          {hayMas && !cargando && (
            <button onClick={() => cargar(pagina + 1)} className="mx-auto flex items-center gap-2 rounded-2xl border border-line px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand">
              {t('dashboard.miembros_v.more', { count: datos.total - datos.miembros.length })}
            </button>
          )}
        </>
      )}

      {enGrupo && (
        <AccionGrupo
          accion={enGrupo} miembros={seleccion} dash={dash}
          onCerrar={() => setEnGrupo(null)}
          onHecho={() => { setEnGrupo(null); setMarcados(new Set()); cargar(0); }}
        />
      )}

      <AnimatePresence>
        {sancion && (
          <AplicarModal
            tipo={sancion.tipo} usuario={sancion.usuario} dash={dash}
            onClose={() => setSancion(null)}
            onAplicado={() => { setSancion(null); cargar(0); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Acción en grupo: la misma sanción (o el mismo rol) a varias personas ---
const DURACIONES = [10, 60, 1440, 10080]; // aislar: 10 min, 1 h, 1 día, 1 semana
function AccionGrupo({ accion, miembros, dash, onCerrar, onHecho }) {
  const { t } = useTranslation();
  const { aplicarSancionMasiva, roles = [], guildId } = dash;
  const [motivo, setMotivo] = useState('');
  const [minutos, setMinutos] = useState(60);
  const [rolId, setRolId] = useState('');
  const [haciendo, setHaciendo] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, mal: [{ nombre, error }] }
  const esRol = accion === 'rol';
  const nombre = (id) => miembros.find((m) => m.id === id)?.displayName || id;

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const aplicar = async () => {
    setHaciendo(true);
    if (esRol) {
      let ok = 0; const mal = [];
      for (const m of miembros) {
        try {
          const res = await apiFetch(`/api/roles/${rolId}/miembros`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, userId: m.id }) });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d.success) ok++; else mal.push({ nombre: m.displayName, error: d.error || '' });
        } catch { mal.push({ nombre: m.displayName, error: '' }); }
      }
      setResultado({ ok, mal });
    } else {
      const r = await aplicarSancionMasiva({ usuarioIds: miembros.map((m) => m.id), accion, duracionMin: accion === 'timeout' ? minutos : 0, motivo });
      if (r.error) setResultado({ ok: 0, mal: [{ nombre: '', error: r.error }] });
      else setResultado({ ok: (r.aplicadas || []).length, mal: (r.fallidas || []).map((f) => ({ nombre: nombre(f.usuarioId), error: f.error })) });
    }
    setHaciendo(false);
  };

  const meta = ACCIONES.find((a) => a.id === accion);
  return (
    <div className="sk-velo flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget && !haciendo) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="grupo-titulo" className="sk-glass sk-aparece w-full max-w-md rounded-3xl border border-line bg-card p-5 shadow-xl">
        <h2 id="grupo-titulo" className="flex items-center gap-2 text-lg font-extrabold text-fg">
          {meta ? <meta.icon size={19} style={{ color: meta.color }} /> : <UserPlus size={19} className="text-brand" />}
          {esRol ? t('dashboard.miembros_v.grupo.tituloRol', { count: miembros.length }) : t('dashboard.miembros_v.grupo.titulo', { accion: t(`dashboard.miembros_v.actions.${meta.clave}`), count: miembros.length })}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{miembros.map((m) => m.displayName).join(', ')}</p>

        {resultado ? (
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-2 font-semibold text-fg"><Check size={17} className="text-success" /> {t('dashboard.miembros_v.grupo.hecho', { count: resultado.ok })}</p>
            {resultado.mal.length > 0 && (
              <ul className="space-y-1 rounded-2xl bg-danger/10 p-3 text-sm text-danger">
                {resultado.mal.map((x, i) => <li key={i}>• {x.nombre}{x.nombre && x.error ? ': ' : ''}{x.error || t('dashboard.miembros_v.grupo.falloGenerico')}</li>)}
              </ul>
            )}
            <button onClick={onHecho} className="sk-foco mt-2 w-full rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-on-brand">{t('dashboard.miembros_v.grupo.listo')}</button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {esRol ? (
              <select value={rolId} onChange={(e) => setRolId(e.target.value)} aria-label={t('dashboard.miembros_v.grupo.elegirRol')} className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-brand">
                <option value="">{t('dashboard.miembros_v.grupo.elegirRol')}</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                <OpcionCrear tipo="rol" />
              </select>
            ) : (
              <>
                {accion === 'timeout' && (
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('dashboard.miembros_v.grupo.cuanto')}>
                    {DURACIONES.map((d) => (
                      <button key={d} type="button" role="radio" aria-checked={minutos === d} onClick={() => setMinutos(d)}
                        className={cn('rounded-full border px-3 py-1 text-xs font-semibold', minutos === d ? 'border-brand bg-brand/15 text-fg' : 'border-line text-muted hover:text-fg')}>
                        {t(`dashboard.miembros_v.grupo.duraciones.${d}`)}
                      </button>
                    ))}
                  </div>
                )}
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={400} placeholder={t('dashboard.miembros_v.grupo.motivo')}
                  className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-brand" />
                {accion !== 'timeout' && <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">{t(`dashboard.miembros_v.grupo.aviso.${accion}`)}</p>}
              </>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onCerrar} disabled={haciendo} className="sk-foco rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:text-fg">{t('dashboard.miembros_v.grupo.cancelar')}</button>
              <button onClick={aplicar} disabled={haciendo || (esRol && !rolId)}
                className="sk-foco flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: meta?.color || 'var(--accent-color)' }}>
                {haciendo && <Loader2 size={15} className="animate-spin" />} {t('dashboard.miembros_v.grupo.aplicar', { count: miembros.length })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Pestaña de baneados: quién lo está y botón para quitar el ban ---
function Baneados({ guildId }) {
  const { t } = useTranslation();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [quitando, setQuitando] = useState(null);

  const cargar = useCallback(async () => {
    if (!guildId) return;
    setError('');
    try {
      const res = await apiFetch(`/api/servidor/baneos?guildId=${guildId}`);
      const d = await res.json().catch(() => []);
      if (!res.ok) { setError(d.error || t('dashboard.miembros_v.loadError')); setLista([]); return; }
      setLista(Array.isArray(d) ? d : []);
    } catch { setError(t('dashboard.miembros_v.loadError')); setLista([]); }
  }, [guildId, t]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al abrir la pestaña
  useEffect(() => { cargar(); }, [cargar]);

  const quitar = async (b) => {
    if (!window.confirm(t('dashboard.miembros_v.confirmUnban', { name: b.displayName }))) return;
    setQuitando(b.id); setError('');
    try {
      const res = await apiFetch(`/api/servidor/baneos/${b.id}?guildId=${guildId}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) setLista((l) => l.filter((x) => x.id !== b.id));
      else setError(d.error || t('dashboard.miembros_v.unbanError'));
    } catch { setError(t('dashboard.miembros_v.unbanError')); }
    setQuitando(null);
  };

  const norm = (s) => String(s || '').toLowerCase();
  const filtrados = (lista || []).filter((b) => !q.trim() || norm(b.username).includes(norm(q.trim())) || norm(b.displayName).includes(norm(q.trim())) || b.id === q.trim());

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dashboard.miembros_v.searchBans')} aria-label={t('dashboard.miembros_v.searchBans')} className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-3 text-sm text-fg outline-none focus:border-brand" />
      </div>
      {error && <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}
      {lista === null ? (
        <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> {t('dashboard.miembros_v.loading')}</p>
      ) : filtrados.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-2 p-12 text-center`}>
          <Hammer size={32} className="text-muted" />
          <p className="text-sm italic text-muted">{t(lista.length ? 'dashboard.miembros_v.empty' : 'dashboard.miembros_v.noBans')}</p>
        </div>
      ) : (
        <div className={`${card} divide-y divide-line overflow-hidden`}>
          {filtrados.map((b) => (
            <div key={b.id} className="flex items-center gap-3 p-3.5 sm:px-4">
              <Avatar src={b.avatar} name={b.displayName} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-fg">{b.displayName}</p>
                <p className="truncate text-xs text-muted">@{b.username}{b.motivo ? ` · ${b.motivo}` : ''}</p>
              </div>
              <button
                type="button" onClick={() => quitar(b)} disabled={quitando === b.id}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50"
              >
                {quitando === b.id ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} className="text-brand" />} {t('dashboard.miembros_v.unban')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
