// Inicio de "Mi cuenta": quién eres, cómo vas y a qué puedes ir con un toque.
// Arriba la tarjeta de usuario y la gráfica de actividad (como la referencia
// "glass UI"); debajo, accesos grandes a cada sección y tus servidores.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Ticket as TicketIcon, ShoppingBag, Music as MusicIcon, Palette, Gift, Crown, TrendingUp, TrendingDown,
  Sparkles, Server, Trophy, MessageSquare, UserPlus, Flame, ChevronRight, Loader2, Zap,
} from 'lucide-react';
import { Tarjeta, Vacio } from './glass';
import GraficaActividad from './GraficaActividad';
import { fmtNum, fmtCorto, fmtEspera } from './portalUtils';

export default function InicioPortal({ resumen, usuario, error, onReintentar, irA, onDaily, nuevas }) {
  const { t, i18n } = useTranslation();
  const idioma = i18n.language === 'en' ? 'en' : 'es';
  // Reloj de la pantalla (cuenta atrás de la recompensa y del boost de XP).
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 30000); return () => clearInterval(id); }, []);

  if (!resumen) {
    if (error) {
      return (
        <Vacio icono={Zap} titulo={t('portal.home.errorTitle')} texto={error}>
          <button onClick={onReintentar} className="gx-btn mt-3">{t('portal.login.retry')}</button>
        </Vacio>
      );
    }
    return <EsqueletoInicio />;
  }

  const nombre = usuario?.username || resumen.usuario.username;
  const act = resumen.actividad || {};

  return (
    <div className="flex flex-col gap-5">
      <div className="gx-sube">
        <h1 className="gx-titulo text-[26px] font-extrabold text-fg sm:text-[32px]">
          {t('portal.home.hello', { name: nombre })} <span className="inline-block">👋</span>
        </h1>
        <p className="mt-1 text-sm text-muted sm:text-base">{t('portal.home.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Tarjeta de usuario: en el móvil va primero */}
        <TarjetaUsuario resumen={resumen} usuario={usuario} idioma={idioma} irA={irA} onDaily={onDaily} ahora={ahora} className="gx-sube lg:order-2 lg:col-span-5 xl:col-span-4" />

        {/* Actividad */}
        <Tarjeta brillo className="gx-sube p-5 sm:p-6 lg:order-1 lg:col-span-7 xl:col-span-8" style={{ animationDelay: '.06s' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-fg">{t('portal.home.activityTitle')}</h2>
              <p className="text-xs text-muted">{t('portal.home.activitySub')}</p>
            </div>
            <Cambio valor={act.cambio} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-fg">{fmtNum(act.semana, idioma)}</span>
            <span className="text-sm text-muted">{t('portal.home.thisWeek', { count: act.semana || 0 })}</span>
          </div>
          <div className="mt-2">
            {(act.serie || []).some((d) => d.mensajes > 0)
              ? <GraficaActividad serie={act.serie} />
              : (
                <div className="flex h-[190px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line text-center">
                  <MessageSquare size={22} className="text-muted" />
                  <p className="text-sm font-semibold text-fg">{t('portal.home.noActivityTitle')}</p>
                  <p className="max-w-xs text-xs text-muted">{t('portal.home.noActivityDesc')}</p>
                </div>
              )}
          </div>
        </Tarjeta>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Acceso
          icono={TicketIcon} color="#60a5fa" titulo={t('portal.nav.tickets')} onClick={() => irA('tickets')} retraso=".1s"
          texto={nuevas > 0 ? t('portal.home.tileTicketsNew', { count: nuevas }) : resumen.tickets.abiertos > 0 ? t('portal.home.tileTicketsOpen', { count: resumen.tickets.abiertos }) : t('portal.home.tileTicketsNone')}
          aviso={nuevas}
        />
        <Acceso icono={ShoppingBag} color="#fbbf24" titulo={t('portal.nav.shop')} onClick={() => irA('tienda')} retraso=".14s"
          texto={t('portal.home.tileShop', { gold: fmtNum(resumen.oro, idioma), count: resumen.objetos })} />
        <Acceso icono={MusicIcon} color="#ec4899" titulo={t('portal.nav.music')} onClick={() => irA('musica')} retraso=".18s"
          texto={t('portal.home.tileMusic')} />
        <Acceso icono={Palette} color="#a855f7" titulo={t('portal.nav.card')} onClick={() => irA('tarjeta')} retraso=".22s"
          texto={t('portal.home.tileCard')} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Servidores servidores={resumen.servidores} idioma={idioma} className="gx-sube lg:col-span-8" />
        <Extras resumen={resumen} idioma={idioma} irA={irA} ahora={ahora} className="gx-sube lg:col-span-4" />
      </div>
    </div>
  );
}

// Subida o bajada de esta semana frente a la anterior.
function Cambio({ valor }) {
  const { t } = useTranslation();
  if (valor == null) return <span className="gx-chip"><Sparkles size={12} className="text-brand" /> {t('portal.home.newChip')}</span>;
  const sube = valor >= 0;
  const Icono = sube ? TrendingUp : TrendingDown;
  return (
    <span className="gx-chip text-sm" style={{ color: sube ? 'var(--success)' : 'var(--danger)', borderColor: sube ? 'rgba(74,222,128,.35)' : 'rgba(251,113,133,.35)' }}>
      <Icono size={14} /> {sube ? '+' : ''}{valor}%
    </span>
  );
}

function TarjetaUsuario({ resumen, usuario, idioma, irA, onDaily, ahora, className = '' }) {
  const { t } = useTranslation();
  const [reclamando, setReclamando] = useState(false);

  const u = usuario || resumen.usuario;
  const daily = resumen.daily || {};
  const espera = daily.proximo ? new Date(daily.proximo).getTime() - ahora : 0;
  const disponible = daily.disponible || espera <= 0;
  const avatar = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username || '?')}&background=1e1b3a&color=fff`;

  const reclamar = async () => {
    setReclamando(true);
    try { await onDaily(); } finally { setReclamando(false); }
  };

  const datos = [
    { valor: resumen.totales.nivelMax, etiqueta: t('portal.home.statLevel') },
    { valor: fmtCorto(resumen.oro, idioma), etiqueta: t('portal.home.statGold') },
    { valor: fmtCorto(resumen.totales.mensajes, idioma), etiqueta: t('portal.home.statMessages') },
  ];

  return (
    <Tarjeta brillo halo className={`flex flex-col p-5 sm:p-6 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="gx-aro shrink-0"><img src={avatar} alt="" width="68" height="68" className="h-[68px] w-[68px] object-cover" /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-extrabold text-fg">{u.username}</h2>
            {u.esPremium && <span className="gx-chip shrink-0 text-amber-300" style={{ borderColor: 'rgba(251,191,36,.4)' }}><Crown size={11} /> Premium</span>}
          </div>
          <p className="truncate text-sm text-muted">@{u.username}</p>
          {daily.racha > 0 && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-orange-300"><Flame size={13} /> {t('portal.home.streak', { count: daily.racha })}</p>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-white/[.03] p-3 text-center">
        {datos.map((d) => (
          <div key={d.etiqueta}>
            <div className="gx-texto-neon text-2xl font-extrabold leading-tight">{d.valor}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{d.etiqueta}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button onClick={() => irA('tienda')} className="gx-btn"><ShoppingBag size={16} /> {t('portal.nav.shop')}</button>
        <button onClick={() => irA('tarjeta')} className="gx-btn"><Palette size={16} /> {t('portal.home.myCard')}</button>
      </div>
      <button onClick={reclamar} disabled={!disponible || reclamando} className="gx-btn gx-btn-neon mt-2.5 w-full py-3 text-[15px]">
        {reclamando ? <Loader2 size={17} className="animate-spin" /> : <Gift size={17} />}
        {disponible ? t('portal.home.claimDaily') : t('portal.home.nextDaily', { time: fmtEspera(espera, t) })}
      </button>
    </Tarjeta>
  );
}

function Acceso({ icono: Icono, color, titulo, texto, onClick, aviso = 0, retraso = '0s' }) {
  return (
    <Tarjeta as="button" pulsable onClick={onClick} className="gx-sube flex flex-col items-start gap-3 p-4 text-left sm:p-5" style={{ animationDelay: retraso }}>
      <div className="flex w-full items-center justify-between">
        <span className="gx-orbe relative h-11 w-11" style={{ '--orbe': color }}>
          <Icono size={20} />
          {aviso > 0 && <span className="gx-punto">{aviso > 9 ? '9+' : aviso}</span>}
        </span>
        <ChevronRight size={18} className="text-muted" />
      </div>
      <div>
        <div className="text-[15px] font-bold text-fg">{titulo}</div>
        <div className="mt-0.5 text-xs leading-snug text-muted">{texto}</div>
      </div>
    </Tarjeta>
  );
}

function Servidores({ servidores = [], idioma, className = '' }) {
  const { t } = useTranslation();
  return (
    <Tarjeta className={`p-5 sm:p-6 ${className}`} style={{ animationDelay: '.26s' }}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-fg"><Server size={18} className="text-brand" /> {t('portal.home.serversTitle')}</h2>
      <p className="text-xs text-muted">{t('portal.home.serversSub')}</p>
      {servidores.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{t('portal.home.serversEmpty')}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {servidores.map((s) => {
            const pct = s.xpNecesaria ? Math.min(100, Math.round((s.xpActual / s.xpNecesaria) * 100)) : 0;
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white/[.03] p-3">
                {s.icono
                  ? <img src={s.icono} alt="" width="40" height="40" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                  : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-bold text-fg">{(s.nombre || '?').slice(0, 2).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-fg">{s.nombre}</span>
                    {s.niveles && <span className="gx-chip shrink-0">{t('portal.home.levelShort', { n: s.nivel })}</span>}
                  </div>
                  {s.niveles ? (
                    <>
                      <div className="gx-barra mt-2" title={`${fmtNum(s.xpActual, idioma)} / ${fmtNum(s.xpNecesaria, idioma)} XP`}><span style={{ width: `${pct}%` }} /></div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                        {s.puesto && <span className="flex items-center gap-1"><Trophy size={11} /> #{fmtNum(s.puesto, idioma)}</span>}
                        <span className="flex items-center gap-1"><MessageSquare size={11} /> {fmtNum(s.mensajes, idioma)}</span>
                        {s.invitaciones != null && <span className="flex items-center gap-1"><UserPlus size={11} /> {fmtNum(s.invitaciones, idioma)}</span>}
                        <span>{fmtNum(s.xpActual, idioma)} / {fmtNum(s.xpNecesaria, idioma)} XP</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                      <span className="flex items-center gap-1"><MessageSquare size={11} /> {fmtNum(s.mensajes, idioma)}</span>
                      {s.invitaciones != null && <span className="flex items-center gap-1"><UserPlus size={11} /> {fmtNum(s.invitaciones, idioma)}</span>}
                      <span>{t('portal.home.levelsOff')}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

// Columna lateral: mochila, boost de XP y tickets abiertos.
function Extras({ resumen, idioma, irA, ahora, className = '' }) {
  const { t } = useTranslation();
  const boostMin = resumen.boost ? Math.max(1, Math.round((new Date(resumen.boost.expiraEn).getTime() - ahora) / 60000)) : 0;
  return (
    <div className={`flex flex-col gap-4 ${className}`} style={{ animationDelay: '.3s' }}>
      <Tarjeta className="p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{t('portal.home.walletTitle')}</h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="gx-orbe h-11 w-11 text-lg" style={{ '--orbe': '#f59e0b' }}>🪙</span>
          <div>
            <div className="text-2xl font-extrabold text-fg">{fmtNum(resumen.oro, idioma)}</div>
            <div className="text-xs text-muted">{t('portal.home.items', { count: resumen.objetos })}</div>
          </div>
        </div>
        {resumen.boost && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-white/[.04] px-3 py-2 text-xs text-fg">
            <Zap size={14} className="text-amber-300" /> {t('portal.home.boost', { x: resumen.boost.multiplicador, time: boostMin })}
          </div>
        )}
        <button onClick={() => irA('tienda')} className="gx-btn mt-3 w-full">{t('portal.home.openBag')}</button>
      </Tarjeta>

      <Tarjeta className="p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{t('portal.home.openTickets')}</h2>
        {resumen.tickets.recientes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('portal.home.noOpenTickets')}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {resumen.tickets.recientes.slice(0, 4).map((tk) => (
              <li key={tk.canalId}>
                <button onClick={() => irA('tickets', tk.canalId)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[.06]">
                  <TicketIcon size={15} className="shrink-0 text-blue-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">{tk.titulo}</span>
                    {tk.servidor && <span className="block truncate text-[11px] text-muted">{tk.servidor}</span>}
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

function EsqueletoInicio() {
  const bloque = 'gx-card animate-pulse';
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="h-10 w-64 rounded-xl bg-white/[.06]" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className={`${bloque} h-[340px] lg:col-span-7 xl:col-span-8`} />
        <div className={`${bloque} h-[340px] lg:col-span-5 xl:col-span-4`} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${bloque} h-32`} />)}
      </div>
    </div>
  );
}
