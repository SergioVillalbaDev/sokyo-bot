// Centro de funciones (1.26.0): TODO lo que hace Sokyo en un solo sitio, como una tienda
// de apps. Cada función es una tarjeta con su estado (encendida/apagada), qué hace en una
// frase, «Activar» (lo recomendado en un clic, lib/activar.js) y «Abrir» (su sección).
// Con buscador y filtros. Así no hace falta recorrer el menú para descubrir qué hay.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Zap, ArrowRight, Crown, Loader2, CheckCircle2, FolderTree } from 'lucide-react';
import { navGroups, itemVisible, bloqueadoPorPlan, BASICOS } from '../navConfig';
import { ACTIVABLE, activarSeccion } from '../../../lib/activar';
import { getStaffSession } from '../../../lib/api';
import { normalizar } from '../navConfig';

const esOwner = !!getStaffSession()?.owner;
const FILTROS = ['esenciales', 'todas', 'activas', 'apagadas'];

export default function FuncionesView({ dash, onRequestUpgrade }) {
  const { t } = useTranslation();
  const { estadoModulos = {}, configServidor, guildId, setActiveTab, misPermisos, esPremium } = dash;
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('esenciales');
  const [activando, setActivando] = useState(null);
  const [hechas, setHechas] = useState({});
  const [error, setError] = useState('');
  const [orden, setOrden] = useState(null); // null | 'ordenando' | texto del resultado

  // Ordenar en categorías los canales del bot que estén sueltos en Discord.
  const ordenar = async () => {
    setOrden('ordenando');
    const r = await dash.accionModulo('organizar-canales', 'POST', {});
    if (r.error) { setOrden(null); setError(r.error); return; }
    setOrden(r.movidos?.length ? t('dashboard.funciones.ordenados', { count: r.movidos.length, n: r.movidos.length }) : t('dashboard.funciones.nadaQueOrdenar'));
  };

  // Sin la configuración cargada no se sabe qué está encendido: se pide.
  useEffect(() => { if (!configServidor) dash.recargarSeccion?.({ soloDatos: true }); }, [configServidor, dash]);

  const grupos = useMemo(() => navGroups.filter((g) => !g.owner).map((g) => ({
    ...g,
    items: g.items.filter((it) => itemVisible(it, misPermisos)).map((it) => ({
      ...it,
      nombre: t(`dashboard.nav.items.${it.tab}`),
      desc: t(`dashboard.meta.${it.tab}.subtitle`, { defaultValue: '' }),
      estado: hechas[it.tab] ? true : Object.prototype.hasOwnProperty.call(estadoModulos, it.tab) ? estadoModulos[it.tab] : undefined,
    })),
  })), [t, misPermisos, estadoModulos, hechas]);

  const conEstado = grupos.flatMap((g) => g.items).filter((it) => it.estado !== undefined);
  const activas = conEstado.filter((it) => it.estado).length;
  const q = normalizar(busca.trim());
  const pasa = (it) => (!q || normalizar(`${it.nombre} ${it.desc} ${it.kw || ''}`).includes(q))
    && (q || filtro === 'todas' || (filtro === 'esenciales' && BASICOS.has(it.tab)) || (filtro === 'activas' && it.estado === true) || (filtro === 'apagadas' && it.estado === false));

  const activar = async (it) => {
    setActivando(it.tab); setError('');
    let tipo = 'comunidad';
    try { tipo = JSON.parse(localStorage.getItem(`sokyoAsistente:${guildId}`) || '{}').tipo || 'comunidad'; } catch { /* sin almacenamiento */ }
    const r = await activarSeccion(guildId, it.tab, { idioma: configServidor?.idioma, tipo });
    setActivando(null);
    if (!r.ok) {
      setError(r.motivo === 'admin' ? t('dashboard.activar.errAdmin') : r.motivo === 'espera' ? t('dashboard.activar.errEspera') : r.detalle || t('dashboard.setup.errGeneric'));
      return;
    }
    setHechas((h) => ({ ...h, [it.tab]: true }));
    dash.recargarSeccion?.({ soloDatos: true });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-card p-5 shadow-soft">
        <p className="text-lg font-extrabold text-fg">{t('dashboard.funciones.titulo')}</p>
        <p className="mt-1 text-sm text-muted">{t('dashboard.funciones.sub')}</p>
        {conEstado.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>{t('dashboard.funciones.progreso', { n: activas, total: conEstado.length })}</span>
              <span>{Math.round((activas / conEstado.length) * 100)} %</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-elevated">
              <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${(activas / conEstado.length) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('dashboard.funciones.buscar')}
              className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-3 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30" />
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {FILTROS.map((f) => (
              <button key={f} type="button" role="tab" aria-selected={filtro === f && !q} onClick={() => setFiltro(f)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filtro === f && !q ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted hover:text-fg'}`}>
                {t(`dashboard.funciones.filtro.${f}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg p-3">
          <FolderTree size={18} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1 text-xs text-muted">{orden && orden !== 'ordenando' ? orden : t('dashboard.funciones.ordenarSub')}</span>
          <button type="button" onClick={ordenar} disabled={orden === 'ordenando'} className="sk-foco inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-fg hover:border-brand disabled:opacity-60">
            {orden === 'ordenando' ? <Loader2 size={13} className="animate-spin" /> : null}{t('dashboard.funciones.ordenar')}
          </button>
        </div>
        {error && <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-sm text-red-300">{error}</p>}
      </div>

      {grupos.map((g) => {
        const items = g.items.filter(pasa);
        if (!items.length) return null;
        return (
          <section key={g.id} style={{ '--grupo': g.color }}>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-extrabold uppercase tracking-wide text-muted">
              <span className="sk-icono-grupo h-7 w-7"><g.icon size={14} /></span>{t(`dashboard.nav.groups.${g.id}`)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((it) => {
                const bloqueado = bloqueadoPorPlan(it, esPremium, esOwner);
                const puedeActivar = it.estado === false && ACTIVABLE[it.tab] && !bloqueado;
                return (
                  <div key={it.tab} className={`flex flex-col rounded-2xl border bg-card p-4 transition-colors ${it.estado ? 'border-success/40' : 'border-line'}`}>
                    <div className="flex items-start gap-3">
                      <span className="sk-icono-grupo h-10 w-10 shrink-0"><it.icon size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-extrabold text-fg">
                          <span className="truncate">{it.nombre}</span>
                          {bloqueado && <Crown size={13} className="shrink-0 text-amber-400" />}
                        </p>
                        {it.estado !== undefined && (
                          <span className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold ${it.estado ? 'text-success' : 'text-muted'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${it.estado ? 'bg-success' : 'ring-1 ring-muted'}`} />
                            {it.estado ? t('dashboard.funciones.activa') : t('dashboard.funciones.apagada')}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-3 flex-1 text-xs text-muted">{it.desc}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {puedeActivar && (
                        <button type="button" disabled={activando === it.tab} onClick={() => activar(it)}
                          className="sk-foco inline-flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-extrabold text-on-brand disabled:opacity-60">
                          {activando === it.tab ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} {t('dashboard.funciones.activar')}
                        </button>
                      )}
                      {hechas[it.tab] && <span className="inline-flex items-center gap-1 text-xs font-bold text-success"><CheckCircle2 size={13} /> {t('dashboard.funciones.lista')}</span>}
                      <button type="button" onClick={() => (bloqueado ? onRequestUpgrade?.(it.tab) : setActiveTab(it.tab))}
                        className="sk-foco inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-fg hover:border-brand">
                        {it.estado === false && !puedeActivar ? t('dashboard.funciones.configurar') : t('dashboard.funciones.abrir')} <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {grupos.every((g) => !g.items.some(pasa)) && <p className="text-center text-sm italic text-muted">{t('dashboard.funciones.nada')}</p>}
    </div>
  );
}
