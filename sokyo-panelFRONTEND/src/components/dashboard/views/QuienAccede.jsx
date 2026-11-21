// Configuración → Acceso al panel · «Quién puede entrar al panel» (1.12.0).
// Galería con cada persona de este servidor que entra al panel: su foto, su apodo, su rol
// y a qué áreas llega (en color las que puede abrir). Pulsando una persona sale su ficha
// con el menú entero del panel, sección a sección. Lo que se ve se recalcula al momento
// con los roles que se están eligiendo abajo (lib/accesoPanel.js), antes de guardar.
// API: GET /api/config/:guildId/acceso/miembros (utils/accesoPanel.js).
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Crown, ShieldCheck, Shield, X, Check, Minus, AlertTriangle, Loader2, Gavel } from 'lucide-react';
import { Avatar } from '../../ui/primitives';
import { navGroups } from '../navConfig';
import { apiFetch, procesarRespuesta } from '../../../lib/api';
import { AREAS, calcularAcceso } from '../../../lib/accesoPanel';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

// Icono y color de cada área: los de su grupo del menú (o los de su primera sección).
const ESTILO_AREA = Object.fromEntries(AREAS.map((area) => {
  const grupo = navGroups.find((g) => g.id === area);
  if (grupo) return [area, { icono: grupo.icon, color: grupo.color }];
  const g = navGroups.find((x) => x.items.some((it) => it.area === area));
  const it = g?.items.find((x) => x.area === area);
  return [area, { icono: it?.icon || Shield, color: g?.color || '#94a3b8' }];
}));
const colorRol = (c) => (!c || c === '#000000' ? '#99AAB5' : c);

function IconoArea({ area, activo, t, size = 15, caja = 'h-7 w-7' }) {
  const { icono: Icono, color } = ESTILO_AREA[area];
  return (
    <span title={`${t(`dashboard.acceso_v.areaNames.${area}`)} · ${activo ? t('dashboard.acceso_v.quien.can') : t('dashboard.acceso_v.quien.cannot')}`}
      className={`grid ${caja} place-items-center rounded-lg transition-colors ${activo ? '' : 'opacity-30 grayscale'}`}
      style={{ background: activo ? `${color}22` : 'transparent', color: activo ? color : 'var(--color-muted, #94a3b8)' }}>
      <Icono size={size} />
    </span>
  );
}

function Insignias({ p, t, roles, cfg }) {
  const nombreRol = (id) => roles.find((r) => r.id === id)?.nombre || '';
  // Qué rol le da el acceso (para «Rol del staff: …» y «Rol de acceso: …»).
  const rolDe = { rolStaff: nombreRol(cfg?.rolStaffId), rolAcceso: (cfg?.rolesPanelAcceso || []).filter((id) => p.roles.includes(id)).map(nombreRol).filter(Boolean).join(', ') };
  const lista = [];
  if (p.propietarioBot) lista.push(['propietarioBot', Crown, '#f59e0b']);
  if (p.duenoServidor) lista.push(['duenoServidor', Crown, '#fbbf24']);
  for (const m of p.calc.motivos) if (m !== 'propietarioBot') lista.push([m, m === 'admin' ? ShieldCheck : Shield, m === 'admin' ? '#f87171' : '#818cf8']);
  return (
    <div className="flex flex-wrap gap-1.5">
      {lista.map(([clave, Icono, color]) => (
        <span key={clave} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${color}22`, color }}>
          <Icono size={11} /> {t(`dashboard.acceso_v.quien.motivos.${clave}`, { rol: rolDe[clave] || '' })}
        </span>
      ))}
    </div>
  );
}

// Ficha de una persona: el menú entero del panel con lo que puede abrir.
function Ficha({ p, onCerrar, t, roles, cfg }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCerrar]);
  const grupos = navGroups.filter((g) => !g.owner || p.propietarioBot);
  const puede = (it) => (it.area ? p.calc.areas[it.area] : p.calc.acceso);
  return (
    <div className="sk-velo flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ficha-acceso" className="sk-glass sk-aparece max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start gap-4">
          <span className="rounded-full p-[3px]" style={{ background: colorRol(p.rolPrincipal?.color) }}>
            <Avatar src={p.avatar} name={p.nombre} size={72} className="ring-2 ring-card" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ficha-acceso" className="truncate text-xl font-extrabold tracking-tight text-fg">{p.nombre}</h2>
            <p className="truncate text-sm text-muted">@{p.usuario}</p>
            <div className="mt-2"><Insignias p={p} t={t} roles={roles} cfg={cfg} /></div>
          </div>
          <button type="button" onClick={onCerrar} className="sk-boton-icono shrink-0" aria-label={t('dashboard.acceso_v.quien.close')}><X size={17} /></button>
        </div>
        <div className={`mt-4 flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold ${p.calc.moderar ? 'border-success/40 bg-success/10 text-success' : 'border-line bg-bg text-muted'}`}>
          <Gavel size={15} /> {p.calc.moderar ? t('dashboard.acceso_v.quien.modYes') : t('dashboard.acceso_v.quien.modNo')}
        </div>
        <div className="mt-4 space-y-3">
          {grupos.map((g) => {
            const IconoG = g.icon;
            return (
              <div key={g.id} className="rounded-2xl border border-line bg-bg p-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: g.color }}><IconoG size={14} /> {t(`dashboard.nav.groups.${g.id}`)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.items.map((it) => {
                    const si = puede(it);
                    const IconoI = it.icon;
                    return (
                      <span key={it.tab} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${si ? 'border-success/30 bg-success/10 text-fg' : 'border-line text-muted line-through decoration-muted/60'}`}>
                        {si ? <Check size={12} className="text-success" /> : <Minus size={12} />}
                        {IconoI && <IconoI size={12} />} {t(`dashboard.nav.items.${it.tab}`)}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function QuienAccede({ guildId, roles = [], cfgVivo, recarga }) {
  const { t, i18n } = useTranslation();
  const [datos, setDatos] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    if (!guildId) return undefined;
    let vivo = true;
    apiFetch(`/api/config/${guildId}/acceso/miembros`).then(procesarRespuesta)
      .then((d) => { if (vivo) setDatos(d); })
      .catch((e) => { if (vivo) setDatos({ error: e.message }); });
    return () => { vivo = false; };
    // Tras guardar (recarga) y con el idioma nuevo (los errores vienen en su idioma) se vuelve a pedir.
  }, [guildId, recarga, i18n.language]);

  // Se recalcula con los roles que se están eligiendo ahora mismo (aún sin guardar).
  const personas = useMemo(() => (datos?.miembros || [])
    .map((p) => ({ ...p, calc: calcularAcceso(p, cfgVivo) }))
    .filter((p) => p.calc.acceso), [datos, cfgVivo]);
  const visibles = personas.filter((p) => (!filtroArea || p.calc.areas[filtroArea])
    && (!buscar || `${p.nombre} ${p.usuario}`.toLowerCase().includes(buscar.toLowerCase())));
  const porArea = Object.fromEntries(AREAS.map((a) => [a, personas.filter((p) => p.calc.areas[a]).length]));
  const elegido = abierto && personas.find((p) => p.id === abierto);

  return (
    <div data-help="acceso-quien" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-fg">
            <Users size={18} className="text-brand" /> {t('dashboard.acceso_v.quien.title')}
            {datos && !datos.error && <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-bold text-brand">{personas.length}</span>}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{t('dashboard.acceso_v.quien.desc')}</p>
        </div>
        <label className="relative w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={t('dashboard.acceso_v.quien.search')}
            className="w-full rounded-xl border border-line bg-bg py-2 pl-9 pr-3 text-sm text-fg outline-none focus:border-brand" />
        </label>
      </div>

      {/* Filtro por área: «¿quién puede abrir Tickets?» */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setFiltroArea('')} aria-pressed={!filtroArea}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${!filtroArea ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted hover:text-fg'}`}>
          {t('dashboard.acceso_v.quien.all')}
        </button>
        {AREAS.map((a) => {
          const { icono: Icono, color } = ESTILO_AREA[a];
          const activo = filtroArea === a;
          return (
            <button key={a} type="button" onClick={() => setFiltroArea(activo ? '' : a)} aria-pressed={activo}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${activo ? 'text-fg' : 'border-line text-muted hover:text-fg'}`}
              style={activo ? { borderColor: color, background: `${color}22` } : undefined}>
              <Icono size={12} style={{ color }} /> {t(`dashboard.acceso_v.areaNames.${a}`)}
              <span className="rounded-full bg-elevated px-1.5 text-[10px]">{porArea[a]}</span>
            </button>
          );
        })}
      </div>

      {datos?.parcial && <p className="mt-3 flex items-center gap-1.5 text-xs text-warning"><AlertTriangle size={13} /> {t('dashboard.acceso_v.quien.partial')}</p>}

      {!datos ? (
        <p className="mt-6 flex items-center justify-center gap-2 py-8 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> {t('dashboard.acceso_v.quien.loading')}</p>
      ) : datos.error ? (
        <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{datos.error}</p>
      ) : visibles.length === 0 ? (
        <p className="mt-6 py-8 text-center text-sm italic text-muted">{buscar || filtroArea ? t('dashboard.acceso_v.quien.noMatch') : t('dashboard.acceso_v.quien.empty')}</p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {visibles.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setAbierto(p.id)}
                className="sk-pulsable group flex h-full w-full flex-col items-center rounded-2xl border border-line bg-bg px-3 pb-3 pt-4 text-center transition-colors hover:border-brand/50">
                <span className="relative">
                  <span className="block rounded-full p-[3px] transition-transform group-hover:scale-105" style={{ background: colorRol(p.rolPrincipal?.color) }}>
                    <Avatar src={p.avatar} name={p.nombre} size={64} className="ring-2 ring-bg" />
                  </span>
                  {(p.propietarioBot || p.duenoServidor) && (
                    <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-amber-400 text-amber-950 shadow" title={t(`dashboard.acceso_v.quien.motivos.${p.propietarioBot ? 'propietarioBot' : 'duenoServidor'}`)}>
                      <Crown size={13} />
                    </span>
                  )}
                  {p.calc.moderar && (
                    <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-card text-danger shadow ring-1 ring-line" title={t('dashboard.acceso_v.quien.modYes')}>
                      <Gavel size={12} />
                    </span>
                  )}
                </span>
                <span className="mt-2.5 block w-full truncate text-sm font-bold text-fg">{p.nombre}</span>
                <span className="block w-full truncate text-[11px] text-muted">@{p.usuario}</span>
                {p.rolPrincipal && (
                  <span className="mt-1.5 flex max-w-full items-center gap-1 truncate rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-fg">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorRol(p.rolPrincipal.color) }} />
                    <span className="truncate">{p.rolPrincipal.nombre}</span>
                  </span>
                )}
                {/* Fila flexible: en tarjetas estrechas (móvil) salta de línea en vez de montarse */}
                <span className="mt-2.5 flex flex-wrap justify-center gap-1">
                  {AREAS.map((a) => <IconoArea key={a} area={a} activo={p.calc.areas[a]} t={t} size={12} caja="h-6 w-6" />)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {elegido && <Ficha p={elegido} t={t} roles={roles} cfg={cfgVivo} onCerrar={() => setAbierto(null)} />}
    </div>
  );
}
