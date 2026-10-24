// Inicio del panel: de un vistazo, cómo va el servidor y dónde está cada cosa.
// 1) Cifras de tickets · 2) Estado de los módulos (encendidos/apagados, con un
// toque para ir a cada uno) · 3) Mapa de TODO el panel por grupos · 4) tickets
// y actividad recientes · 5) equipo, memoria, registros, satisfacción y latencia.
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Ticket, Inbox, Activity, Users2, HardDrive, ScrollText, Smile, ChevronRight, Wifi, Power, Search, Map as MapIcon, Crown,
} from 'lucide-react';
import { Avatar, Badge } from '../../ui/primitives';
import { CircularGauge } from '../../ui/CircularGauge';
import { gruposVisibles, navSections, bloqueadoPorPlan } from '../navConfig';
import { getStaffSession } from '../../../lib/api';
import { cn } from '../../../lib/cn';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const esOwner = !!getStaffSession()?.owner;

function CabeceraTarjeta({ icono: Icono, titulo, sub, accion, onAccion }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-bold text-fg"><Icono size={18} className="shrink-0 text-brand" /> {titulo}</h3>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {accion && (
        <button onClick={onAccion} className="sk-foco flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-fg">
          {accion} <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}

// Dato compacto del lateral: icono, título, cifra grande y (opcional) barra.
function MiniDato({ icono: Icono, color, titulo, valor, nota, barra = null, extra = null }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-4 shadow-soft" style={{ '--grupo': color }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-fg">
          <span className="sk-icono-grupo h-7 w-7"><Icono size={14} /></span>
          <span className="truncate">{titulo}</span>
        </h3>
        {extra}
      </div>
      <p className="mt-2.5 text-2xl font-extrabold tracking-tight text-fg">{valor}</p>
      {barra !== null && <div className="sk-barra mt-2"><span style={{ width: `${Math.min(100, Math.max(0, barra))}%` }} /></div>}
      {nota && <p className="mt-1.5 line-clamp-2 text-[11.5px] text-muted">{nota}</p>}
    </div>
  );
}

export default function InicioView({ dash, onBuscar, onRequestUpgrade }) {
  const { t } = useTranslation();
  const {
    ticketsReales, logsRegistrados, limiteLogs, usoStats, esPremium,
    getColorUrgencia, verMensajes, setActiveTab, ping, estadoModulos = {}, misPermisos,
  } = dash;

  // --- Métricas de tickets ---
  const total = ticketsReales.length;
  const abiertos = ticketsReales.filter((x) => x.estado !== 'Cerrado').length;
  const cerrados = total - abiertos;
  const valorados = ticketsReales.filter((x) => x.valoracionCSAT);
  const csatMedio = valorados.length ? valorados.reduce((a, x) => a + x.valoracionCSAT, 0) / valorados.length : 0;
  const csatPct = Math.round((csatMedio / 5) * 100);
  const logsPct = limiteLogs ? Math.min(100, Math.round((logsRegistrados.length / limiteLogs) * 100)) : 0;
  const memoria = usoStats?.memoria || { porcentaje: 0, usadoMB: 0, cuotaMB: esPremium ? 5120 : 512 };

  // Equipo de soporte (staff que ha participado o tiene tickets asignados).
  const staff = [];
  const visto = new Set();
  ticketsReales.forEach((tk) => {
    (tk.participantes || []).forEach((p) => {
      if (p.rol === 'Staff' && p.id && !visto.has(p.id)) { visto.add(p.id); staff.push(p); }
    });
    if (tk.asignadoNombre && !visto.has(tk.asignadoNombre)) {
      visto.add(tk.asignadoNombre);
      staff.push({ id: tk.asignadoNombre, username: tk.asignadoNombre, avatar: null, rol: t('dashboard.inicio_v.agent') });
    }
  });

  const recientes = ticketsReales.slice(0, 5);
  const actividad = logsRegistrados.slice(0, 6);
  const abrirTicket = (ticket) => { setActiveTab('tickets-gestion'); verMensajes(ticket); };

  // Grupos y secciones a los que tiene acceso, y los módulos que se encienden/apagan.
  const grupos = gruposVisibles(misPermisos, esOwner);
  const porId = Object.fromEntries(grupos.map((g) => [g.id, g]));
  const modulos = grupos.flatMap((g) => g.items.filter((it) => Object.prototype.hasOwnProperty.call(estadoModulos, it.tab)).map((it) => ({ ...it, color: g.color, on: estadoModulos[it.tab] })));
  const encendidos = modulos.filter((m) => m.on).length;
  const pctModulos = modulos.length ? Math.round((encendidos / modulos.length) * 100) : 0;
  const ir = (it) => {
    // Igual que en el menú: lo de pago abre la ventana que explica el plan.
    if (bloqueadoPorPlan(it, esPremium, esOwner)) return onRequestUpgrade?.(it.tab);
    setActiveTab(it.tab);
  };

  const quickStats = [
    { id: 'total', label: t('dashboard.inicio_v.stTotal'), value: total, icon: Ticket, color: 'var(--accent-color)', tab: 'tickets-gestion' },
    { id: 'open', label: t('dashboard.inicio_v.stOpen'), value: abiertos, icon: Inbox, color: 'var(--danger)', tab: 'tickets-gestion' },
    { id: 'closed', label: t('dashboard.inicio_v.stClosed'), value: cerrados, icon: Activity, color: 'var(--success)', tab: 'tickets-gestion' },
    { id: 'agents', label: t('dashboard.inicio_v.stAgents'), value: staff.length, icon: Users2, color: 'var(--warning)', tab: 'tickets-usuarios' },
  ];
  const puedeTickets = !!porId.tickets;

  return (
    <div className="space-y-5">
      {/* 1 · Cifras */}
      <div data-tour="stats" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {quickStats.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            disabled={!puedeTickets}
            onClick={() => setActiveTab(s.tab)}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 }}
            className="sk-pulsable rounded-3xl border border-line bg-card p-4 text-left shadow-soft disabled:pointer-events-none sm:p-5"
            style={{ '--grupo': s.color }}
          >
            <span className="sk-icono-grupo h-10 w-10"><s.icon size={18} /></span>
            <p className="mt-3 text-[28px] font-extrabold leading-none tracking-tight text-fg">{s.value}</p>
            <p className="mt-1 text-xs font-medium text-muted">{s.label}</p>
          </motion.button>
        ))}
      </div>

      {/* 2 · Datos rápidos del bot: latencia, memoria, registros y satisfacción */}
      <div data-help="inicio-rail" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MiniDato icono={Wifi} color="var(--accent-color)" titulo={t('dashboard.inicio_v.latency')} valor={ping !== null && ping !== undefined ? `${ping} ms` : '–'}
          nota={ping == null ? t('dashboard.inicio_v.latencyUnknown') : ping < 200 ? t('dashboard.inicio_v.latencyGood') : t('dashboard.inicio_v.latencySlow')} />
        <MiniDato icono={HardDrive} color="#a78bfa" titulo={t('dashboard.inicio_v.memory')} valor={`${memoria.porcentaje}%`} barra={memoria.porcentaje}
          nota={t('dashboard.inicio_v.memoryOf', { used: memoria.usadoMB, quota: memoria.cuotaMB })}
          extra={<span className="hidden sm:inline-flex"><Badge color={esPremium ? 'var(--warning)' : undefined}>{esPremium ? t('dashboard.plan.premiumShort') : t('dashboard.plan.freeShort')}</Badge></span>} />
        <MiniDato icono={ScrollText} color="#34d399" titulo={t('dashboard.inicio_v.logsCap')} valor={logsRegistrados.length} barra={logsPct}
          nota={`${t('dashboard.inicio_v.of', { limit: limiteLogs })} · ${t('dashboard.inicio_v.logsStored')}`} />
        <MiniDato icono={Smile} color="#fbbf24" titulo={t('dashboard.inicio_v.satisfaction')} valor={csatMedio ? `${csatMedio.toFixed(1)} / 5` : '–'} barra={csatPct}
          nota={valorados.length === 0 ? t('dashboard.inicio_v.noRatings') : t('dashboard.inicio_v.ratings', { count: valorados.length })} />
      </div>

      {/* 3 · Módulos */}
        {modulos.length > 0 && (
          <div className={card}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <CircularGauge value={pctModulos} size={86} stroke={9} color="var(--accent-color)">
                  <span className="text-lg font-extrabold text-fg">{encendidos}/{modulos.length}</span>
                </CircularGauge>
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-bold text-fg"><Power size={18} className="text-brand" /> {t('dashboard.inicio_v.modulesTitle')}</h3>
                  <p className="mt-0.5 text-sm text-muted">
                    {encendidos === modulos.length ? t('dashboard.inicio_v.modulesAllOn') : t('dashboard.inicio_v.modulesSub', { on: encendidos, total: modulos.length })}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {modulos.map((m) => (
                <button
                  key={m.tab}
                  onClick={() => ir(m)}
                  className="sk-foco group flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5 text-left transition-colors hover:border-brand/40"
                  style={{ '--grupo': m.color }}
                >
                  <span className="sk-icono-grupo h-8 w-8"><m.icon size={15} /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{t(`dashboard.nav.items.${m.tab}`)}</span>
                  <span className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold', m.on ? 'bg-success/15 text-success' : 'bg-elevated text-muted')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', m.on ? 'bg-success' : 'bg-muted/60')} />
                    {m.on ? t('dashboard.nav.moduleOnShort') : t('dashboard.nav.moduleOffShort')}
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        )}


      {/* 4 · Mapa de todo el panel */}
      <section data-help="inicio-mapa">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-fg"><MapIcon size={19} className="text-brand" /> {t('dashboard.inicio_v.mapTitle')}</h2>
            <p className="text-sm text-muted">{t('dashboard.inicio_v.mapSub')}</p>
          </div>
          {onBuscar && (
            <button onClick={onBuscar} className="sk-foco flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-sm font-semibold text-fg shadow-soft transition-colors hover:border-brand/40">
              <Search size={15} className="text-brand" /> {t('dashboard.inicio_v.mapSearch')} <span className="sk-tecla hidden sm:inline-flex">Ctrl K</span>
            </button>
          )}
        </div>
        <div className="columns-1 gap-3 sm:columns-2 xl:columns-3">
          {navSections.flatMap((sec) => sec.groups.map((id) => porId[id]).filter(Boolean).map((g) => (
            <div key={g.id} className={`${card} sk-pulsable mb-3 break-inside-avoid p-4`} style={{ '--grupo': g.color }}>
              <div className="flex items-center gap-3">
                <span className="sk-orbe h-10 w-10"><g.icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-fg">{t(`dashboard.nav.groups.${g.id}`)}</h3>
                  <p className="truncate text-xs text-muted">{t(`dashboard.nav.groupDesc.${g.id}`)}</p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted 2xl:inline">{t(`dashboard.nav.sections.${sec.id}`)}</span>
              </div>
              <div className="mt-3 flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const estado = Object.prototype.hasOwnProperty.call(estadoModulos, it.tab) ? estadoModulos[it.tab] : undefined;
                  const bloqueado = bloqueadoPorPlan(it, esPremium, esOwner);
                  return (
                    <button
                      key={it.tab}
                      onClick={() => ir(it)}
                      className="sk-foco group flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
                    >
                      <it.icon size={15} className="shrink-0" style={{ color: g.color }} />
                      <span className="min-w-0 flex-1 truncate">{t(`dashboard.nav.items.${it.tab}`)}</span>
                      {estado !== undefined && <span title={estado ? t('dashboard.nav.moduleOn') : t('dashboard.nav.moduleOff')} className={cn('h-2 w-2 shrink-0 rounded-full', estado ? 'bg-success shadow-[0_0_8px_var(--success)]' : 'ring-1 ring-muted/60')} />}
                      {bloqueado && <Crown size={13} className="shrink-0 text-amber-400" />}
                      <ChevronRight size={14} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            </div>
          )))}
        </div>
      </section>

      {/* 5 · Tickets y actividad recientes */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {puedeTickets && (
          <div data-help="inicio-recientes" className={card}>
            <CabeceraTarjeta icono={Ticket} titulo={t('dashboard.inicio_v.recentTickets')} accion={t('dashboard.inicio_v.seeAll')} onAccion={() => setActiveTab('tickets-gestion')} />
            {recientes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{t('dashboard.inicio_v.noTickets')}</p>
            ) : (
              <div className="space-y-2">
                {recientes.map((tk, i) => {
                  const color = getColorUrgencia(tk.prioridad);
                  return (
                    <button
                      key={tk.canalId || i}
                      onClick={() => abrirTicket(tk)}
                      className="sk-foco flex w-full items-center gap-3 rounded-2xl border border-line bg-bg p-2.5 text-left transition-colors hover:border-brand/40"
                    >
                      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                      <Avatar src={tk.creadorAvatar} name={tk.creadorNombre} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">{tk.titulo || tk.motivo || 'Ticket'}</p>
                        <p className="truncate text-xs text-muted">{tk.creadorNombre} · {tk.motivo}</p>
                      </div>
                      <Badge color={tk.estado === 'Cerrado' ? 'var(--danger)' : 'var(--success)'}>{tk.estado}</Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className={card}>
          <CabeceraTarjeta icono={Activity} titulo={t('dashboard.inicio_v.activity')} accion={porId.datos?.items.some((it) => it.tab === 'logs-todos') ? t('dashboard.inicio_v.seeLogs') : null} onAccion={() => setActiveTab('logs-todos')} />
          {actividad.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t('dashboard.inicio_v.noActivity')}</p>
          ) : (
            <div className="space-y-1">
              {actividad.map((log, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: log.color || '#888', boxShadow: `0 0 8px ${log.color || '#888'}` }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{log.accion} · <span className="text-muted">{log.usuario}</span></span>
                  <span className="shrink-0 text-xs text-muted">{new Date(log.fecha).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6 · Equipo de soporte */}
      <div data-help="inicio-team" className={card}>
        <CabeceraTarjeta icono={Users2} titulo={t('dashboard.inicio_v.team')} accion={puedeTickets ? t('dashboard.inicio_v.seeUsers') : null} onAccion={() => setActiveTab('tickets-usuarios')} />
        {staff.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{t('dashboard.inicio_v.noTeam')}</p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {staff.slice(0, 12).map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-2xl border border-line bg-bg px-3 py-2">
                <Avatar src={p.avatar} name={p.username} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{p.username}</p>
                  <p className="text-[11px] text-muted">{p.rol || t('dashboard.inicio_v.agent')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
