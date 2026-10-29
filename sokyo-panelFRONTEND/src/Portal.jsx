// "Mi cuenta" (portal de usuarios): cada usuario entra con Discord —o con un
// clic desde /cuenta en Discord— y tiene su resumen, sus tickets, la tienda,
// la música y su tarjeta de nivel. Estilo cristal futurista (src/portal.css).
//
// Se abre en /cuenta (o con ?portal=1, la dirección antigua). La pantalla va en
// el #hash (/cuenta#tienda, /cuenta#tickets/<canal>): así el botón "atrás" del
// móvil vuelve a la pantalla anterior y el bot puede mandar enlaces directos.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LogIn, AlertTriangle, ArrowLeft, Ticket as TicketIcon, Palette, Music as MusicIcon, Home, LogOut,
  ShoppingBag, Bell, Settings, Search, Zap, Check, Gift, Globe, Backpack, CornerDownLeft, Sparkles, LayoutDashboard, BellRing,
} from 'lucide-react';
import InicioPortal from './components/portal/InicioPortal';
import TicketsPortal from './components/portal/TicketsPortal';
import TiendaPortal from './components/portal/TiendaPortal';
import TarjetaPortal from './components/portal/TarjetaPortal';
import MusicaPortal from './components/portal/MusicaPortal';
import AjustesPortal from './components/portal/AjustesPortal';
import { FondoEspacial, Tarjeta, TituloVista, Avisos } from './components/portal/glass';
import { leerHash, respuestasNuevas, leerVistos, leerSorteosVistos, marcarSorteosVistos } from './components/portal/portalUtils';
import LanguageSwitcher from './components/LanguageSwitcher';
import { IDIOMAS, cambiarIdioma } from './i18n';
import './index.css';
import './portal.css';

// En producción la API y el portal se sirven en el mismo dominio: por defecto
// usamos rutas relativas (mismo origen). Para desarrollo define VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || '';
// ¿Ha entrado alguna vez al panel de admin en este navegador? Entonces se le
// enseña el acceso directo al panel (sin pasar por la web principal).
const esStaff = (() => { try { return !!localStorage.getItem('sokyoStaffToken'); } catch { return false; } })();
const RUTA = '/cuenta';
// Pantalla pedida antes de pasar por el login de Discord (p. ej. #tickets/123).
const CLAVE_DESTINO = 'portalDestino';

const MENU = [
  { id: 'inicio', icono: Home, clave: 'portal.nav.home' },
  { id: 'tickets', icono: TicketIcon, clave: 'portal.nav.tickets' },
  { id: 'tienda', icono: ShoppingBag, clave: 'portal.nav.shop' },
  { id: 'musica', icono: MusicIcon, clave: 'portal.nav.music' },
  { id: 'tarjeta', icono: Palette, clave: 'portal.nav.card' },
];

// La sesión de la tienda antigua (tienda.html) también vale aquí.
const sesionGuardada = () => {
  try { return localStorage.getItem('portalToken') || localStorage.getItem('sokyo_token') || ''; } catch { return ''; }
};

function Portal() {
  const { t } = useTranslation();
  const [token, setToken] = useState(sesionGuardada);
  const [usuario, setUsuario] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [errorResumen, setErrorResumen] = useState('');
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0); // sube al pulsar "Reintentar" tras un fallo de red
  const [ruta, setRuta] = useState(() => leerHash());
  const [avisos, setAvisos] = useState([]);
  const [paleta, setPaleta] = useState(false);
  const [vistos, setVistos] = useState(leerVistos);
  const [sorteosVistos, setSorteosVistos] = useState(leerSorteosVistos);

  // Tema de cristal fijo para "Mi cuenta".
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'glass');
    document.title = 'Sokyo · Mi cuenta';
  }, []);

  // Al cargar: el token de vuelta del login (o del enlace de /cuenta) o un error.
  // Efecto solo-en-montaje: el setState aquí es intencional (leer la URL una vez).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tk = params.get('token');
    const err = params.get('error');
    if (err) {
      setError(err === 'denegado' ? t('portal.login.errDenied') : err === 'magic' ? t('portal.login.errMagic') : t('portal.login.errOauth'));
    }
    let hash = window.location.hash;
    if (tk) {
      try { localStorage.setItem('portalToken', tk); } catch { /* sin almacenamiento: dura lo que la pestaña */ }
      setToken(tk);
      // Vuelta del login de Discord: a la pantalla que se quería abrir (un enlace del bot).
      try {
        const pendiente = sessionStorage.getItem(CLAVE_DESTINO);
        sessionStorage.removeItem(CLAVE_DESTINO);
        if (!hash && pendiente && pendiente.startsWith('#')) { hash = pendiente; setRuta(leerHash(hash)); }
      } catch { /* nada */ }
    }
    // Dirección limpia y fácil de recordar, sin el token a la vista.
    window.history.replaceState({}, '', `${RUTA}${hash}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const alCambiar = () => { setRuta(leerHash()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  const portalFetch = useCallback((path, options = {}) => fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  }).then((res) => {
    // Sesión renovada por el servidor (X-Sokyo-Token): se guarda para la próxima
    // visita; la actual sigue con la que tiene, que aún es válida.
    const renovada = res.headers.get('X-Sokyo-Token');
    try { if (renovada && sesionGuardada() === token) localStorage.setItem('portalToken', renovada); } catch { /* nada */ }
    return res;
  }), [token]);

  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = `${Date.now()}-${Math.random()}`;
    setAvisos((l) => [...l.slice(-3), { id, texto, tipo }]);
    setTimeout(() => setAvisos((l) => l.filter((a) => a.id !== id)), 4500);
  }, []);
  const cerrarAviso = useCallback((id) => setAvisos((l) => l.filter((a) => a.id !== id)), []);

  const logout = useCallback(() => {
    try { localStorage.removeItem('portalToken'); localStorage.removeItem('sokyo_token'); } catch { /* nada */ }
    setToken(''); setUsuario(null); setResumen(null);
  }, []);

  // irA('tickets', canalId) abre ese ticket; irA('tienda', 'mochila') esa pestaña.
  const irA = useCallback((vista, extra = null) => {
    setPaleta(false);
    window.location.hash = extra ? `${vista}/${encodeURIComponent(extra)}` : vista;
  }, []);

  const tz = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } }, []);
  const cargarResumen = useCallback(() => portalFetch(`/api/portal/resumen?tz=${encodeURIComponent(tz)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d) => { setResumen(d); setErrorResumen(''); })
    .catch(() => setErrorResumen(t('portal.home.errorDesc'))), [portalFetch, tz, t]);

  // Sesión + resumen. Solo un 401 cierra la sesión: un fallo de red (el móvil sin
  // cobertura) la conserva y deja reintentar.
  useEffect(() => {
    if (!token) return;
    portalFetch('/api/portal/yo')
      .then((r) => { if (r.status === 401) throw new Error('sesion'); if (!r.ok) throw new Error('red'); return r.json(); })
      .then((yo) => { setUsuario(yo); setError(''); cargarResumen(); })
      .catch((e) => {
        if (e.message === 'sesion') { logout(); setError(t('portal.login.errSession')); } else setError(t('portal.login.errConexion'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, intento]);

  // Los avisos de respuestas se miran cada minuto con la pestaña visible (una
  // consulta ligera: el resumen entero solo se pide al entrar y tras cobrar).
  useEffect(() => {
    if (!usuario) return undefined;
    const id = setInterval(() => {
      if (document.hidden) return;
      portalFetch('/api/portal/avisos')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && Array.isArray(d.recientes)) setResumen((x) => (x ? { ...x, tickets: { ...x.tickets, recientes: d.recientes }, sorteos: d.sorteos || x.sorteos } : x)); })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [usuario, portalFetch]);

  // Ctrl/⌘ + K abre el buscador de acciones.
  useEffect(() => {
    const tecla = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaleta((v) => !v); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const nuevas = useMemo(() => respuestasNuevas(resumen, vistos), [resumen, vistos]);
  // Sorteos ganados que aún no se han visto: también van en la campana.
  const premios = useMemo(() => (resumen?.sorteos || []).filter((x) => !sorteosVistos.includes(x.id)), [resumen, sorteosVistos]);
  const verPremios = useCallback(() => { setSorteosVistos(marcarSorteosVistos(premios.map((x) => x.id))); irA('ajustes'); }, [premios, irA]);
  const releerVistos = useCallback(() => setVistos(leerVistos()), []);
  const alCambiarOro = useCallback((balance) => setResumen((r) => (r ? { ...r, oro: balance } : r)), []);

  const reclamarDaily = useCallback(async () => {
    const res = await portalFetch('/api/portal/daily', { method: 'POST' }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (res && res.ok) {
      avisar(d.jackpot ? t('portal.home.dailyJackpot', { total: d.total, jackpot: d.jackpot, count: d.racha }) : t('portal.home.dailyClaimed', { total: d.total, count: d.racha }), 'oro');
    } else {
      avisar(res && res.status === 409 ? t('portal.home.dailyWait') : t('portal.login.errConexion'), 'error');
    }
    cargarResumen();
  }, [portalFetch, avisar, t, cargarResumen]);

  if (!token) return <Entrada error={error} />;

  const { vista, ticket, sub } = ruta;
  let contenido;
  if (!usuario) {
    contenido = error ? (
      <Tarjeta className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <AlertTriangle size={26} className="text-danger" />
        <p className="text-sm text-fg">{error}</p>
        <button onClick={() => setIntento((n) => n + 1)} className="gx-btn gx-btn-primario">{t('portal.login.retry')}</button>
      </Tarjeta>
    ) : <InicioPortal resumen={null} />;
  } else if (vista === 'tickets') {
    contenido = <TicketsPortal portalFetch={portalFetch} usuario={usuario} ticketId={ticket} irA={irA} avisar={avisar} nuevas={nuevas} onLeido={releerVistos} />;
  } else if (vista === 'tienda') {
    contenido = <TiendaPortal portalFetch={portalFetch} usuario={usuario} avisar={avisar} onOro={alCambiarOro} pestanaInicial={sub} />;
  } else if (vista === 'tarjeta') {
    contenido = <TarjetaPortal portalFetch={portalFetch} usuario={usuario} avisar={avisar} />;
  } else if (vista === 'ajustes') {
    contenido = <AjustesPortal portalFetch={portalFetch} avisar={avisar} sorteos={resumen?.sorteos || []} />;
  } else if (vista === 'musica') {
    contenido = (
      <>
        <TituloVista icono={MusicIcon} color="#ec4899" titulo={t('portal.music.title')} subtitulo={t('portal.music.subtitle')} />
        <MusicaPortal portalFetch={portalFetch} />
      </>
    );
  } else {
    contenido = <InicioPortal resumen={resumen} usuario={usuario} error={errorResumen} onReintentar={cargarResumen} irA={irA} onDaily={reclamarDaily} nuevas={nuevas.length} />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-fg">
      <FondoEspacial />
      <div className="relative z-10 mx-auto w-full max-w-[1240px] px-3 pb-36 pt-3 sm:px-6 sm:pt-6 lg:pt-8">
        <div className="gx-marco">
          <Cabecera usuario={usuario} nuevas={nuevas} premios={premios} onVerPremios={verPremios} irA={irA} onLogout={logout} onBuscar={() => setPaleta(true)} />
          <main className="mt-5 sm:mt-7" key={`${vista}-${ticket ? 'chat' : sub || 'lista'}`}>{contenido}</main>
        </div>
      </div>
      <Dock vista={vista} irA={irA} nuevas={nuevas.length} />
      <Avisos lista={avisos} onCerrar={cerrarAviso} />
      {paleta && <Paleta irA={irA} onCerrar={() => setPaleta(false)} onDaily={reclamarDaily} onLogout={logout} />}
    </div>
  );
}

// ---------- PANTALLA DE ENTRADA ----------
function Entrada({ error }) {
  const { t } = useTranslation();
  const chips = [
    { icono: TicketIcon, texto: t('portal.nav.tickets'), color: '#60a5fa' },
    { icono: ShoppingBag, texto: t('portal.nav.shop'), color: '#fbbf24' },
    { icono: MusicIcon, texto: t('portal.nav.music'), color: '#ec4899' },
    { icono: Palette, texto: t('portal.nav.card'), color: '#a855f7' },
  ];
  return (
    <div className="relative flex min-h-screen flex-col text-fg">
      <FondoEspacial />
      <div className="relative z-10 flex items-center justify-between p-4 sm:p-6">
        {/* Salida a la web: "Mi cuenta" nunca es un callejón sin salida. */}
        <a href="/" className="gx-btn px-3.5 py-2"><ArrowLeft size={16} /> {t('portal.login.back')}</a>
        <LanguageSwitcher />
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <Tarjeta brillo halo className="gx-sube w-full max-w-md p-7 text-center sm:p-9">
          <div className="gx-aro mx-auto w-fit"><img src="/assets/logo-160.webp" alt="Sokyo" width="76" height="76" className="h-[76px] w-[76px] object-cover" /></div>
          <h1 className="gx-titulo mt-6 text-3xl font-extrabold text-fg">{t('portal.login.title')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('portal.login.subtitle')}</p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {chips.map(({ icono: Icono, texto, color }) => (
              <span key={texto} className="gx-chip"><Icono size={12} style={{ color }} /> {texto}</span>
            ))}
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-left text-sm text-danger">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <a
            href={`${API_URL}/api/auth/discord`}
            onClick={() => { try { if (window.location.hash) sessionStorage.setItem(CLAVE_DESTINO, window.location.hash); } catch { /* nada */ } }}
            className="gx-btn mt-6 w-full border-white/20 py-3.5 text-base font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #5865F2, #7c3aed)', boxShadow: '0 0 0 1px rgba(88,101,242,.35), 0 14px 40px -12px rgba(88,101,242,.9)' }}
          >
            <LogIn size={18} /> {t('portal.login.button')}
          </a>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-white/[.04] p-3.5 text-left">
            <span className="gx-orbe h-9 w-9" style={{ '--orbe': '#a855f7' }}><Zap size={16} /></span>
            <p className="text-xs leading-relaxed text-muted">
              <strong className="text-fg">{t('portal.login.fastTitle')}</strong> {t('portal.login.fastPre')} <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-fg">/{t('portal.login.fastCmd')}</code> {t('portal.login.fastPost')}
            </p>
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}

// ---------- CABECERA ----------
function Cabecera({ usuario, nuevas, premios = [], onVerPremios, irA, onLogout, onBuscar }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(null); // 'avisos' | 'ajustes' | null
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(null); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(null); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  const alternar = (cual) => setAbierto((a) => (a === cual ? null : cual));
  const avatar = usuario?.avatar || (usuario ? `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.username)}&background=1e1b3a&color=fff` : null);

  return (
    <header ref={ref} className="relative z-30 flex items-center justify-between gap-3">
      <a href="/" title={t('portal.header.homeTitle')} className="flex min-w-0 items-center gap-3">
        <span className="gx-aro shrink-0 p-[2px]"><img src="/assets/logo-96.webp" alt="Sokyo" width="38" height="38" className="h-[38px] w-[38px] !border-2 object-cover" /></span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-lg font-extrabold tracking-tight text-fg">Sokyo</span>
          <span className="gx-texto-neon block truncate text-xs font-bold uppercase tracking-[.18em]">{t('portal.header.brand')}</span>
        </span>
      </a>

      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        {esStaff && (
          <a href="/panel" className="gx-icono sm:!flex sm:!w-auto sm:items-center sm:gap-2 sm:px-3.5" title={t('portal.header.panel')} aria-label={t('portal.header.panel')}>
            <LayoutDashboard size={18} /> <span className="hidden text-sm font-bold sm:inline">{t('portal.header.panelShort')}</span>
          </a>
        )}
        <button onClick={onBuscar} className="gx-icono" title={t('portal.header.searchTitle')} aria-label={t('portal.header.searchTitle')}><Search size={18} /></button>
        <div className="relative">
          <button onClick={() => alternar('avisos')} className="gx-icono" aria-expanded={abierto === 'avisos'} title={t('portal.header.notifications')} aria-label={t('portal.header.notifications')}>
            <Bell size={18} />
            {nuevas.length + premios.length > 0 && <span className="gx-punto">{nuevas.length + premios.length > 9 ? '9+' : nuevas.length + premios.length}</span>}
          </button>
          {abierto === 'avisos' && (
            <Desplegable>
              <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-muted">{t('portal.header.notifications')}</p>
              {premios.map((p) => (
                <button key={p.id} onClick={() => { setAbierto(null); onVerPremios?.(); }} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[.07]">
                  <span className="gx-orbe mt-0.5 h-8 w-8" style={{ '--orbe': '#ec4899' }}><Gift size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-fg">{t('portal.header.ganaste', { premio: p.premio })}</span>
                    <span className="block truncate text-xs text-muted">{p.nombre}{p.servidor ? ` · ${p.servidor}` : ''}</span>
                  </span>
                </button>
              ))}
              {nuevas.length === 0 && premios.length === 0 ? (
                <p className="flex items-center gap-2 px-3 pb-3 text-sm text-muted"><Sparkles size={15} className="text-brand" /> {t('portal.header.allCaughtUp')}</p>
              ) : nuevas.map((n) => (
                <button key={n.canalId} onClick={() => { setAbierto(null); irA('tickets', n.canalId); }} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[.07]">
                  <span className="gx-orbe mt-0.5 h-8 w-8" style={{ '--orbe': '#3b82f6' }}><TicketIcon size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-fg">{t('portal.header.replyFrom', { name: n.ultimo.usuario || t('portal.chat.unknownUser') })}</span>
                    <span className="block truncate text-xs text-muted">{n.titulo}{n.servidor ? ` · ${n.servidor}` : ''}</span>
                    {n.ultimo.contenido && <span className="mt-0.5 line-clamp-2 block text-xs text-fg/80">“{n.ultimo.contenido}”</span>}
                  </span>
                </button>
              ))}
            </Desplegable>
          )}
        </div>
        <div className="relative">
          <button onClick={() => alternar('ajustes')} className="gx-icono" aria-expanded={abierto === 'ajustes'} title={t('portal.header.settings')} aria-label={t('portal.header.settings')}><Settings size={18} /></button>
          {abierto === 'ajustes' && <MenuAjustes usuario={usuario} onLogout={onLogout} onPreferencias={() => { setAbierto(null); irA('ajustes'); }} />}
        </div>
        {avatar && (
          <button onClick={() => irA('inicio')} className="hidden sm:block" title={usuario.username} aria-label={t('portal.nav.home')}>
            <span className="gx-aro block p-[2px]"><img src={avatar} alt="" width="38" height="38" className="h-[38px] w-[38px] !border-2 object-cover" /></span>
          </button>
        )}
      </div>
    </header>
  );
}

function Desplegable({ children, ancho = 'w-80' }) {
  return (
    <div className={`gx-card absolute right-0 top-[calc(100%+10px)] z-50 ${ancho} max-w-[calc(100vw-24px)] p-1.5`} style={{ background: 'linear-gradient(160deg, rgba(34,26,68,.96), rgba(14,11,32,.97))', borderRadius: 18 }}>
      {children}
    </div>
  );
}

function MenuAjustes({ usuario, onLogout, onPreferencias }) {
  const { t, i18n } = useTranslation();
  return (
    <Desplegable ancho="w-64">
      {usuario && <p className="truncate px-3 pb-2 pt-1.5 text-sm font-bold text-fg">{usuario.username}</p>}
      <button onClick={onPreferencias} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-fg transition-colors hover:bg-white/[.07]"><BellRing size={15} className="text-brand" /> {t('portal.header.preferencias')}</button>
      <div className="my-1.5 h-px bg-white/10" />
      <p className="px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted"><Globe size={11} className="mr-1 inline" /> {t('portal.header.language')}</p>
      {IDIOMAS.map((idioma) => (
        <button key={idioma.code} onClick={() => cambiarIdioma(idioma.code)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-fg transition-colors hover:bg-white/[.07]">
          <span>{idioma.flag} {idioma.label}</span>
          {i18n.language === idioma.code && <Check size={14} className="text-brand" />}
        </button>
      ))}
      <div className="my-1.5 h-px bg-white/10" />
      {esStaff && <a href="/panel" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-fg transition-colors hover:bg-white/[.07]"><LayoutDashboard size={15} /> {t('portal.header.panel')}</a>}
      <a href="/" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-fg transition-colors hover:bg-white/[.07]"><Home size={15} /> {t('portal.header.homeTitle')}</a>
      <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-300 transition-colors hover:bg-rose-500/10"><LogOut size={15} /> {t('portal.header.logout')}</button>
    </Desplegable>
  );
}

// ---------- MENÚ INFERIOR (dock) ----------
function Dock({ vista, irA, nuevas }) {
  const { t } = useTranslation();
  return (
    <nav className="gx-dock" aria-label={t('portal.nav.label')}>
      {MENU.map(({ id, icono: Icono, clave }) => (
        <button key={id} onClick={() => irA(id)} className="gx-dock-item" aria-current={vista === id ? 'page' : undefined}>
          <Icono size={20} />
          <span>{t(clave)}</span>
          {id === 'tickets' && nuevas > 0 && <span className="gx-punto">{nuevas > 9 ? '9+' : nuevas}</span>}
        </button>
      ))}
    </nav>
  );
}

// ---------- BUSCADOR DE ACCIONES (Ctrl+K) ----------
function Paleta({ irA, onCerrar, onDaily, onLogout }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const acciones = [
    { id: 'inicio', icono: Home, texto: t('portal.palette.home'), hacer: () => irA('inicio') },
    { id: 'tickets', icono: TicketIcon, texto: t('portal.palette.tickets'), hacer: () => irA('tickets') },
    { id: 'tienda', icono: ShoppingBag, texto: t('portal.palette.shop'), hacer: () => irA('tienda') },
    { id: 'mochila', icono: Backpack, texto: t('portal.palette.bag'), hacer: () => irA('tienda', 'mochila') },
    { id: 'musica', icono: MusicIcon, texto: t('portal.palette.music'), hacer: () => irA('musica') },
    { id: 'tarjeta', icono: Palette, texto: t('portal.palette.card'), hacer: () => irA('tarjeta') },
    { id: 'ajustes', icono: BellRing, texto: t('portal.palette.ajustes'), hacer: () => irA('ajustes') },
    { id: 'daily', icono: Gift, texto: t('portal.palette.daily'), hacer: () => { onCerrar(); onDaily(); } },
    ...(esStaff ? [{ id: 'panel', icono: LayoutDashboard, texto: t('portal.palette.panel'), hacer: () => window.location.assign('/panel') }] : []),
    { id: 'web', icono: Globe, texto: t('portal.palette.web'), hacer: () => window.location.assign('/') },
    { id: 'salir', icono: LogOut, texto: t('portal.palette.logout'), hacer: () => { onCerrar(); onLogout(); } },
  ];
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = acciones.filter((a) => norm(a.texto).includes(norm(q.trim())));
  const elegido = Math.min(sel, Math.max(0, lista.length - 1));

  const tecla = (e) => {
    if (e.key === 'Escape') onCerrar();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(lista.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && lista[elegido]) lista[elegido].hacer();
  };

  return (
    <div className="gx-velo flex items-start justify-center px-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }} role="dialog" aria-modal="true" aria-label={t('portal.header.searchTitle')}>
      <Tarjeta brillo halo className="gx-pop w-full max-w-lg overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(34,26,68,.95), rgba(14,11,32,.97))' }}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={tecla}
            placeholder={t('portal.palette.placeholder')} aria-label={t('portal.palette.placeholder')}
            className="w-full bg-transparent py-4 text-base text-fg outline-none placeholder:text-muted"
          />
          <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {lista.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t('portal.palette.nothing')}</li>}
          {lista.map((a, i) => {
            const Icono = a.icono;
            return (
              <li key={a.id}>
                <button
                  onClick={a.hacer} onMouseEnter={() => setSel(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${i === elegido ? 'bg-white/[.09] text-fg' : 'text-muted'}`}
                >
                  <Icono size={17} className={i === elegido ? 'text-brand' : ''} />
                  <span className="flex-1">{a.texto}</span>
                  {i === elegido && <CornerDownLeft size={14} className="text-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Tarjeta>
    </div>
  );
}

export default Portal;
