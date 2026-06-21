// Analítica (Pro) — radiografía completa del servidor con gráficas SVG (sin
// dependencias) + insights de crecimiento. Candado con CTA a Pro para Free.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Crown, Lock, Users, UserPlus, MessageSquare, Activity, Ticket, Star, Shield,
  TrendingUp, BarChart3, Clock, Lightbulb, AlertTriangle, CheckCircle2, Flag,
  Mic, Gauge, Trash2, UserCog,
} from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

// Gráfica de líneas (una o varias series). Módulo (regla react-hooks).
function LineaChart({ serie, lineas }) {
  const W = 720, H = 170, pad = 22;
  const pts = serie || [];
  const max = Math.max(1, ...pts.flatMap((d) => lineas.map((l) => d[l.key] || 0)));
  const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, pts.length - 1);
  const y = (v) => H - pad - ((v || 0) * (H - pad * 2)) / max;
  const path = (key) => pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 170 }}>
      {[0, 0.5, 1].map((f) => <line key={f} x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth="1" />)}
      {lineas.map((l) => pts.length > 1 && <path key={l.key} d={path(l.key)} fill="none" stroke={l.color} strokeWidth="2.5" strokeDasharray={l.dash || '0'} />)}
    </svg>
  );
}

// Barras horizontales (distribuciones, rankings).
function Barras({ data, sufijo }) {
  const items = data || [];
  const max = Math.max(1, ...items.map((d) => d.n));
  return (
    <div className="flex flex-col gap-2.5">
      {items.length === 0 && <p className="text-sm italic text-muted">—</p>}
      {items.map((d) => (
        <div key={d.nombre} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-muted" title={d.nombre}>{d.nombre}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-elevated">
            <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${(d.n / max) * 100}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right text-xs font-bold text-fg">{d.n}{sufijo || ''}</span>
        </div>
      ))}
    </div>
  );
}

// Columnas verticales (24 horas del día).
function Columnas({ data }) {
  const items = data || [];
  const max = Math.max(1, ...items.map((d) => d.n));
  return (
    <div className="flex h-28 items-end gap-[2px]">
      {items.map((d, i) => (
        <div key={i} className="flex-1 rounded-t bg-gradient-brand transition-all" title={`${d.label}: ${d.n}`} style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, color }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2 text-muted">
        <Icon size={16} style={{ color }} /> <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-fg">{value}</p>
      {sub != null && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Seccion({ icon: Icon, titulo, children, right }) {
  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold text-fg"><Icon size={18} className="text-brand" /> {titulo}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

const ICONO_INSIGHT = { ok: CheckCircle2, warn: AlertTriangle, tip: Lightbulb };
const COLOR_INSIGHT = { ok: 'var(--success)', warn: 'var(--warning)', tip: 'var(--brand)' };

export default function AnaliticaView({ dash }) {
  const { t } = useTranslation();
  const { analitica, setActiveTab, cargarAnalitica } = dash;
  const [dias, setDias] = useState(30);

  if (!analitica) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;

  // Candado para Free.
  if (!analitica.esPro) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40 blur-[3px]">
          <div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className={card}><div className="h-16" /></div>)}</div>
          <div className={`${card} mt-4`}><div className="h-44" /></div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-on-brand"><Lock size={26} /></span>
          <h3 className="text-lg font-bold text-fg">{t('dashboard.analitica_v.lockedTitle')}</h3>
          <p className="max-w-md text-sm text-muted">{t('dashboard.analitica_v.lockedDesc')}</p>
          <button type="button" onClick={() => setActiveTab('cuenta-plan')} className="mt-1 flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-transform hover:scale-[1.02]">
            <Crown size={16} /> {t('dashboard.analitica_v.lockedCta')}
          </button>
        </div>
      </div>
    );
  }

  const a = analitica;
  const r = a.resumen || {};
  const sv = a.servidor || {};
  const v = (n) => (n == null ? '—' : n);
  const cambiarDias = (d) => { setDias(d); cargarAnalitica(d); };

  return (
    <div className="space-y-5">
      {/* Cabecera + selector de periodo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('dashboard.analitica_v.intro', { dias: a.dias })}</p>
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-elevated p-1">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => cambiarDias(d)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${dias === d ? 'bg-gradient-brand text-on-brand' : 'text-muted hover:text-fg'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label={t('dashboard.analitica_v.members')} value={v(r.miembros)} sub={sv.boosts != null ? t('dashboard.analitica_v.boosts', { n: sv.boosts }) : null} color="var(--brand)" />
        <Stat icon={TrendingUp} label={t('dashboard.analitica_v.growth')} value={r.crecimientoNeto > 0 ? `+${r.crecimientoNeto}` : v(r.crecimientoNeto)} sub={t('dashboard.analitica_v.inDays', { dias: a.dias })} color="var(--success)" />
        <Stat icon={MessageSquare} label={t('dashboard.analitica_v.messages')} value={v(r.mensajes)} sub={r.pctActivos != null ? t('dashboard.analitica_v.activePct', { pct: r.pctActivos }) : null} color="#8ab4ff" />
        <Stat icon={Star} label={t('dashboard.analitica_v.csat')} value={r.csat != null ? `${r.csat}★` : '—'} sub={t('dashboard.analitica_v.ticketsN', { n: r.ticketsTotales || 0 })} color="#f59e0b" />
        <Stat icon={Gauge} label={t('dashboard.analitica_v.msgsPerActive')} value={v(r.mensajesPorActivo)} color="var(--brand)" />
        <Stat icon={Mic} label={t('dashboard.analitica_v.voiceActive')} value={v(r.vozActivos)} color="#a78bfa" />
      </div>

      {/* Insights de crecimiento */}
      <Seccion icon={Lightbulb} titulo={t('dashboard.analitica_v.insightsTitle')}>
        <div className="grid gap-3 md:grid-cols-2">
          {(a.insights || []).map((ins, i) => {
            const Icon = ICONO_INSIGHT[ins.tipo] || Lightbulb;
            const color = COLOR_INSIGHT[ins.tipo] || 'var(--brand)';
            return (
              <div key={i} className="flex gap-3 rounded-2xl border border-line bg-bg p-3.5" style={{ borderLeft: `4px solid ${color}` }}>
                <Icon size={18} className="mt-0.5 shrink-0" style={{ color }} />
                <div>
                  <p className="text-sm font-bold text-fg">{ins.titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{ins.texto}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Seccion>

      {/* Crecimiento de miembros (histórico real) */}
      <Seccion icon={TrendingUp} titulo={t('dashboard.analitica_v.memberTrend')}>
        {a.comunidad.hayMiembros
          ? <LineaChart serie={a.comunidad.serieMiembros} lineas={[{ key: 'miembros', color: 'var(--brand)' }]} />
          : <p className="py-6 text-center text-sm italic text-muted">{t('dashboard.analitica_v.memberTrendNote')}</p>}
      </Seccion>

      {/* Comunidad */}
      <Seccion icon={UserPlus} titulo={t('dashboard.analitica_v.secCommunity')}
        right={<div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted"><span className="inline-block h-2.5 w-4 rounded-full" style={{ background: 'var(--success)' }} /> {t('dashboard.analitica_v.joins')} ({a.comunidad.totalEntradas})</span>
          <span className="flex items-center gap-1.5 text-muted"><span className="inline-block h-2.5 w-4 rounded-full" style={{ background: 'var(--danger)' }} /> {t('dashboard.analitica_v.leaves')} ({a.comunidad.totalSalidas})</span>
        </div>}>
        <LineaChart serie={a.comunidad.serie} lineas={[{ key: 'entradas', color: 'var(--success)' }, { key: 'salidas', color: 'var(--danger)', dash: '4 3' }]} />
      </Seccion>

      {/* Actividad */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion icon={Activity} titulo={t('dashboard.analitica_v.msgsPerDay')}>
          <LineaChart serie={a.actividad.serie} lineas={[{ key: 'n', color: 'var(--brand)' }]} />
        </Seccion>
        <Seccion icon={Clock} titulo={t('dashboard.analitica_v.byHour')} right={<span className="text-xs text-muted">{t('dashboard.analitica_v.peak')}: {a.actividad.horaPico}</span>}>
          <Columnas data={a.actividad.porHora} />
          <div className="mt-1 flex justify-between text-[10px] text-muted"><span>0h</span><span>12h</span><span>23h</span></div>
        </Seccion>
        <Seccion icon={BarChart3} titulo={t('dashboard.analitica_v.topChannels')}>
          <Barras data={a.actividad.topCanales} />
        </Seccion>
        <Seccion icon={Users} titulo={t('dashboard.analitica_v.topUsers')}>
          <Barras data={a.actividad.topUsuarios} />
        </Seccion>
      </div>

      {/* Salud del chat */}
      <Seccion icon={Trash2} titulo={t('dashboard.analitica_v.secHealth')}
        right={<div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted"><span className="inline-block h-2.5 w-4 rounded-full" style={{ background: 'var(--danger)' }} /> {t('dashboard.analitica_v.deleted')} ({a.salud.totalBorrados})</span>
          <span className="flex items-center gap-1.5 text-muted"><span className="inline-block h-2.5 w-4 rounded-full" style={{ background: 'var(--warning)' }} /> {t('dashboard.analitica_v.edited')} ({a.salud.totalEditados})</span>
        </div>}>
        <LineaChart serie={a.salud.serie} lineas={[{ key: 'borrados', color: 'var(--danger)' }, { key: 'editados', color: 'var(--warning)', dash: '4 3' }]} />
      </Seccion>

      {/* Niveles */}
      <Seccion icon={TrendingUp} titulo={t('dashboard.analitica_v.secLevels')}
        right={<span className="text-xs text-muted">{t('dashboard.analitica_v.withXp', { n: a.niveles.conXp })} · {t('dashboard.analitica_v.avgLevel', { n: a.niveles.nivelMedio })}</span>}>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">{t('dashboard.analitica_v.levelDist')}</p>
            <Barras data={a.niveles.distribucion} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">{t('dashboard.analitica_v.topLevels')}</p>
            <div className="flex flex-col gap-2">
              {(a.niveles.top || []).length === 0 && <p className="text-sm italic text-muted">—</p>}
              {(a.niveles.top || []).map((u, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2">
                  <span className="truncate text-xs font-semibold text-fg">{i + 1}. {u.nombre}</span>
                  <span className="shrink-0 text-xs text-muted">{t('dashboard.analitica_v.lvl')} {u.nivel} · {u.xp} XP</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Seccion>

      {/* Moderación */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Seccion icon={Shield} titulo={t('dashboard.analitica_v.secMod')} right={<span className="text-xs text-muted">{t('dashboard.analitica_v.total')}: {a.moderacion.total}</span>}>
            <LineaChart serie={a.moderacion.serie} lineas={[{ key: 'n', color: 'var(--warning)' }]} />
          </Seccion>
        </div>
        <Seccion icon={Shield} titulo={t('dashboard.analitica_v.byType')}>
          <Barras data={a.moderacion.porTipo} />
          {(a.moderacion.topSancionados || []).length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-xs font-semibold text-muted">{t('dashboard.analitica_v.topSanctioned')}</p>
              <Barras data={a.moderacion.topSancionados} />
            </div>
          )}
          <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs text-muted">
            <p>🤖 {t('dashboard.analitica_v.automod')}: <b className="text-fg">{a.moderacion.automod}</b></p>
            <p className="flex items-center gap-1.5"><Flag size={13} /> {t('dashboard.analitica_v.reportsPending')}: <b className="text-fg">{a.moderacion.reportesPendientes}</b></p>
          </div>
        </Seccion>
      </div>

      {/* Rendimiento del equipo */}
      <Seccion icon={UserCog} titulo={t('dashboard.analitica_v.secTeam')}>
        {(a.equipo.agentes || []).length === 0 ? (
          <p className="py-4 text-center text-sm italic text-muted">{t('dashboard.analitica_v.noTeam')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="pb-2 font-semibold">{t('dashboard.analitica_v.agent')}</th>
                  <th className="pb-2 text-right font-semibold">{t('dashboard.analitica_v.handled')}</th>
                  <th className="pb-2 text-right font-semibold">{t('dashboard.analitica_v.agentClose')}</th>
                  <th className="pb-2 text-right font-semibold">{t('dashboard.analitica_v.agentCsat')}</th>
                </tr>
              </thead>
              <tbody>
                {a.equipo.agentes.map((ag, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td className="py-2 font-semibold text-fg">{ag.nombre}</td>
                    <td className="py-2 text-right text-fg">{ag.tickets}</td>
                    <td className="py-2 text-right text-muted">{ag.cierreMedioH != null ? `${ag.cierreMedioH}h` : '—'}</td>
                    <td className="py-2 text-right text-muted">{ag.csat != null ? `${ag.csat}★` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      {/* Tickets */}
      <Seccion icon={Ticket} titulo={t('dashboard.analitica_v.secTickets')}
        right={<span className="text-xs text-muted">
          {t('dashboard.analitica_v.open')}: {a.tickets.totales.abiertos} · {t('dashboard.analitica_v.closed')}: {a.tickets.totales.cerrados}
          {a.tickets.totales.tiempoMedioCierreH != null && ` · ${t('dashboard.analitica_v.avgClose', { h: a.tickets.totales.tiempoMedioCierreH })}`}
        </span>}>
        <LineaChart serie={a.tickets.serie} lineas={[{ key: 'creados', color: 'var(--brand)' }, { key: 'cerrados', color: 'var(--success)', dash: '4 3' }]} />
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">{t('dashboard.analitica_v.byUrgency')}</p>
            <Barras data={a.tickets.urgencias} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">{t('dashboard.analitica_v.topReasons')}</p>
            <Barras data={a.tickets.topMotivos} />
          </div>
        </div>
      </Seccion>
    </div>
  );
}
