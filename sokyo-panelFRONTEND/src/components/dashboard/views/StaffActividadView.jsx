// Datos · Actividad del staff (1.13.0): quién atiende más tickets, cuánto tarda en dar la
// primera respuesta, qué valoración recibe y cuántas sanciones pone. Podio con los tres
// primeros y una fila por persona. API: GET /api/config/:guildId/staff/actividad
// (utils/actividadStaff.js, área «datos»).
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Ticket, MessageSquare, Timer, Star, Gavel, Loader2, Inbox, AlertCircle } from 'lucide-react';
import { Avatar } from '../../ui/primitives';
import { apiFetch, procesarRespuesta } from '../../../lib/api';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const MEDALLA = ['#fbbf24', '#cbd5e1', '#d97706'];
const colorRol = (c) => (!c || c === '#000000' ? '#99AAB5' : c);
// Tiempo de primera respuesta: verde si es rápido, ámbar si va bien, rojo si tarda.
const colorTiempo = (min) => (min == null ? 'text-muted' : min <= 15 ? 'text-success' : min <= 60 ? 'text-warning' : 'text-danger');

function tiempo(min, t) {
  if (min == null) return '—';
  if (min < 60) return t('dashboard.staff_v.min', { n: min });
  if (min < 1440) return t('dashboard.staff_v.hours', { n: Math.round(min / 6) / 10 });
  return t('dashboard.staff_v.days', { n: Math.round(min / 144) / 10 });
}

function Dato({ icono: Icono, valor, etiqueta, clase = 'text-fg' }) {
  return (
    <span className="flex min-w-0 flex-col items-center rounded-xl bg-elevated/60 px-2 py-1.5" title={etiqueta}>
      <span className={`flex items-center gap-1 text-sm font-bold ${clase}`}><Icono size={13} className="opacity-70" /> {valor}</span>
      <span className="truncate text-[10px] text-muted">{etiqueta}</span>
    </span>
  );
}

export default function StaffActividadView({ dash }) {
  const { t, i18n } = useTranslation();
  const { guildId } = dash;
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    if (!guildId) return undefined;
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- «cargando» al cambiar el periodo
    setDatos(null);
    apiFetch(`/api/config/${guildId}/staff/actividad?dias=${dias}`).then(procesarRespuesta)
      .then((d) => { if (vivo) setDatos(d); }).catch((e) => { if (vivo) setDatos({ error: e.message }); });
    return () => { vivo = false; };
  }, [guildId, dias, i18n.language]);

  const staff = datos?.staff || [];
  const maxPuntos = Math.max(1, ...staff.map((s) => s.puntos));
  const podio = staff.slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('dashboard.staff_v.intro')}</p>
        <div className="flex gap-1 rounded-xl border border-line bg-card p-1">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDias(d)} aria-pressed={dias === d}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${dias === d ? 'bg-brand/15 text-fg' : 'text-muted hover:text-fg'}`}>
              {t('dashboard.staff_v.lastDays', { n: d })}
            </button>
          ))}
        </div>
      </div>

      {!datos ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> {t('dashboard.loading')}</p>
      ) : datos.error ? (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{datos.error}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[[Ticket, datos.totales.tickets, t('dashboard.staff_v.totTickets'), 'text-brand'],
              [AlertCircle, datos.totales.sinRespuesta, t('dashboard.staff_v.totUnanswered'), datos.totales.sinRespuesta ? 'text-warning' : 'text-success'],
              [Gavel, datos.totales.sanciones, t('dashboard.staff_v.totSanctions'), 'text-danger']].map(([Icono, n, txt, cls]) => (
              <div key={txt} className={`${card} flex items-center gap-4`}>
                <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-elevated ${cls}`}><Icono size={20} /></span>
                <span><span className="block text-2xl font-extrabold text-fg">{n}</span><span className="text-xs text-muted">{txt}</span></span>
              </div>
            ))}
          </div>

          {staff.length === 0 ? (
            <div className={`${card} py-14 text-center`}>
              <Inbox size={32} className="mx-auto text-muted" />
              <p className="mt-3 font-semibold text-fg">{t('dashboard.staff_v.emptyTitle')}</p>
              <p className="mt-1 text-sm text-muted">{t('dashboard.staff_v.emptySub')}</p>
            </div>
          ) : (
            <>
              {/* Podio: el 1.º en el centro y más alto */}
              <div data-help="staff-podio" className={card}>
                <h3 className="flex items-center gap-2 font-bold text-fg"><Award size={18} className="text-brand" /> {t('dashboard.staff_v.podium')}</h3>
                <div className="mt-6 flex items-end justify-center gap-3 sm:gap-8">
                  {[1, 0, 2].map((i) => podio[i] && (
                    <div key={podio[i].userId} className="flex w-24 flex-col items-center sm:w-32">
                      <span className="relative">
                        <span className="block rounded-full p-[3px]" style={{ background: MEDALLA[i] }}>
                          <Avatar src={podio[i].avatar} name={podio[i].nombre} size={i === 0 ? 84 : 64} className="ring-2 ring-card" />
                        </span>
                        <span className="absolute -bottom-2 left-1/2 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full text-sm font-extrabold text-slate-900 shadow" style={{ background: MEDALLA[i] }}>{i + 1}</span>
                      </span>
                      <span className="mt-4 block w-full truncate text-center text-sm font-bold text-fg">{podio[i].nombre}</span>
                      <span className="text-xs font-semibold text-muted">{t('dashboard.staff_v.points', { n: podio[i].puntos })}</span>
                      <span className="mt-2 w-full rounded-t-xl" style={{ height: i === 0 ? 56 : i === 1 ? 40 : 28, background: `linear-gradient(180deg, ${MEDALLA[i]}55, transparent)` }} />
                    </div>
                  ))}
                </div>
              </div>

              <ul data-help="staff-lista" className="space-y-3">
                {staff.map((s, i) => (
                  <li key={s.userId} className={`${card} !p-4`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-6 shrink-0 text-center text-sm font-extrabold text-muted">{i + 1}</span>
                      <span className="rounded-full p-[2px]" style={{ background: colorRol(s.rolPrincipal?.color) }}>
                        <Avatar src={s.avatar} name={s.nombre} size={44} className="ring-2 ring-card" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-fg">{s.nombre}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                          {s.rolPrincipal && <><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorRol(s.rolPrincipal.color) }} />{s.rolPrincipal.nombre} · </>}
                          {t('dashboard.staff_v.points', { n: s.puntos })}{!s.enServidor && ` · ${t('dashboard.staff_v.left')}`}
                        </span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-elevated">
                          <span className="block h-full rounded-full bg-gradient-brand" style={{ width: `${Math.round((s.puntos / maxPuntos) * 100)}%` }} />
                        </span>
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      <Dato icono={Ticket} valor={s.tickets.atendidos} etiqueta={t('dashboard.staff_v.handled')} />
                      <Dato icono={MessageSquare} valor={s.tickets.mensajes} etiqueta={t('dashboard.staff_v.replies')} />
                      <Dato icono={Timer} valor={tiempo(s.tickets.primeraRespuestaMin, t)} etiqueta={t('dashboard.staff_v.firstReply')} clase={colorTiempo(s.tickets.primeraRespuestaMin)} />
                      <Dato icono={Star} valor={s.tickets.valoracion ?? '—'} etiqueta={t('dashboard.staff_v.rating')} clase={s.tickets.valoracion >= 4 ? 'text-success' : 'text-fg'} />
                      <Dato icono={Gavel} valor={s.sanciones.total} etiqueta={t('dashboard.staff_v.sanctions')} />
                      <Dato icono={Award} valor={s.tickets.cerrados} etiqueta={t('dashboard.staff_v.closed')} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
