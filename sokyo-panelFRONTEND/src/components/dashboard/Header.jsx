// Cabecera del panel (cristal): dónde estás (Grupo › Sección), el título y la
// ayuda de la sección; a la derecha el buscador, los avisos, la ayuda, el idioma
// y el tema. En el móvil, idioma, tema y ayuda van juntos en un solo botón.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Bell, HelpCircle, Menu, ChevronRight, ChevronsUpDown, Ticket as TicketIcon, Flag, Lightbulb, X, CheckCircle2, CheckCheck, SlidersHorizontal, Check, LayoutDashboard, PlayCircle } from 'lucide-react';
import { metaKey, ubicacion } from './navConfig';
import { startOnboarding, startSectionTour, hasSectionTour } from '../../lib/onboarding';
import OwnerBadge from './OwnerBadge';
import ThemePicker, { ThemeGrid } from './ThemePicker';
import LanguageSwitcher from '../LanguageSwitcher';
import { Avatar } from '../ui/primitives';
import { IDIOMAS, cambiarIdioma } from '../../i18n';
import { VIDEOS_PANEL } from '../../lib/videos';
import VideoAyuda from './VideoAyuda';

// Notificaciones descartadas (por servidor, guardadas en el navegador): al
// visitar el panel de esa categoría o pulsar la "x" se marcan como vistas y
// dejan de aparecer en la campanita, aunque sigan pendientes en el backend.
const CLAVE_VISTOS = 'sokyoNotifVistas';
const vistosVacio = () => ({ tickets: [], reportes: [], sugerencias: [] });
const cargarVistos = (guildId) => {
  try {
    const todo = JSON.parse(localStorage.getItem(CLAVE_VISTOS) || '{}');
    return { ...vistosVacio(), ...(todo[guildId] || {}) };
  } catch { return vistosVacio(); }
};
const guardarVistos = (guildId, vistos) => {
  try {
    const todo = JSON.parse(localStorage.getItem(CLAVE_VISTOS) || '{}');
    todo[guildId] = vistos;
    localStorage.setItem(CLAVE_VISTOS, JSON.stringify(todo));
  } catch { /* localStorage no disponible, no es crítico */ }
};

// "hace 5m" / "5m ago" a partir de una fecha. Sin dependencias: solo lo usa
// este menú, no hace falta un helper compartido.
const tiempoRelativo = (fecha, t) => {
  if (!fecha) return '';
  const ms = Date.now() - new Date(fecha).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return t('dashboard.header.notifJustNow');
  if (min < 60) return t('dashboard.header.notifMinsAgo', { n: min });
  const horas = Math.floor(min / 60);
  if (horas < 24) return t('dashboard.header.notifHoursAgo', { n: horas });
  return t('dashboard.header.notifDaysAgo', { n: Math.floor(horas / 24) });
};

// Bloque "Tickets abiertos" / "Reportes pendientes" / "Sugerencias pendientes"
// dentro del panel de notificaciones: una etiqueta y sus filas.
function NotifGroup({ label, children }) {
  return (
    <div>
      <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

const NOTIF_COLORS = {
  brand: 'bg-brand/10 text-brand',
  danger: 'bg-danger/10 text-danger',
  warn: 'bg-warn/10 text-warn',
};

// Una fila de notificación: icono en su badge de color, título + detalle +
// hora relativa, y una X para descartarla al instante. La X es siempre algo
// visible (no solo al pasar el ratón) para que también funcione en móvil.
function NotifItem({ icon: Icon, color, titulo, meta, fecha, onClick, onDismiss }) {
  const { t } = useTranslation();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-elevated"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${NOTIF_COLORS[color]}`}>
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{titulo}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          {meta && <span className="truncate">{meta}</span>}
          {meta && fecha && <span className="shrink-0 opacity-60">·</span>}
          {fecha && <span className="shrink-0">{tiempoRelativo(fecha, t)}</span>}
        </span>
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dashboard.header.notifDismiss')}
        title={t('dashboard.header.notifDismiss')}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted opacity-50 transition-opacity hover:bg-danger/20 hover:text-danger hover:opacity-100 focus-visible:opacity-100"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function Header({ dash, onOpenMenu, onBuscar }) {
  const { t, i18n } = useTranslation();
  const {
    activeTab, theme, setTheme, temasPremium, esPremium, servidorInfo,
    ticketsReales, servidores, guildId, setMostrarSelectorServidor,
    setActiveTab, verMensajes, reportes, sugerencias,
  } = dash;
  const [notifAbiertas, setNotifAbiertas] = useState(false);
  const [prefsAbiertas, setPrefsAbiertas] = useState(false);
  const [verVideo, setVerVideo] = useState(false);
  const cerrarVideo = useCallback(() => setVerVideo(false), []);
  const [vistos, setVistos] = useState(() => cargarVistos(guildId));
  const notifRef = useRef(null);
  const prefsRef = useRef(null);
  const headerRef = useRef(null);
  // En el móvil los desplegables van fijos bajo la cabecera, a todo el ancho:
  // anclados al botón se salían por la izquierda de la pantalla.
  const [panelTop, setPanelTop] = useState(72);
  useEffect(() => {
    if (!notifAbiertas && !prefsAbiertas) return undefined;
    const medir = () => { if (headerRef.current) setPanelTop(headerRef.current.getBoundingClientRect().bottom + 8); };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [notifAbiertas, prefsAbiertas]);
  // Evita que la poda de más abajo borre descartes válidos justo después de
  // montar o cambiar de servidor, mientras tickets/reportes/sugerencias aún
  // están en su [] inicial (la API todavía no ha respondido).
  const primeraPodaRef = useRef(true);

  // Recarga los descartes al cambiar de servidor (son por-servidor).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setVistos(cargarVistos(guildId));
    primeraPodaRef.current = true;
  }, [guildId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const marcarVistos = (tipo, ids) => {
    setVistos((prev) => {
      const combinado = { ...prev, [tipo]: [...new Set([...prev[tipo], ...ids])] };
      guardarVistos(guildId, combinado);
      return combinado;
    });
  };

  const descartarNotif = (tipo, id, e) => {
    e.stopPropagation();
    marcarVistos(tipo, [id]);
  };

  // Avisos pendientes ahora mismo (los ya descartados no cuentan).
  const ticketsAbiertosList = (ticketsReales || []).filter((tk) => tk.estado !== 'Cerrado' && !vistos.tickets.includes(tk.canalId));
  const reportesPendientesList = (reportes || []).filter((r) => r.estado === 'pendiente' && !vistos.reportes.includes(r._id));
  const sugerenciasPendientesList = (sugerencias || []).filter((s) => s.estado === 'pendiente' && !vistos.sugerencias.includes(s._id));
  const totalNotificaciones = ticketsAbiertosList.length + reportesPendientesList.length + sugerenciasPendientesList.length;

  // Cerrar el panel (clic fuera, Esc o la campana) NO descarta nada: descartar
  // es siempre una acción explícita (la X, "Marcar todo como leído" o visitar la sección).
  const cerrarNotif = () => setNotifAbiertas(false);

  const marcarTodoLeido = () => {
    if (ticketsAbiertosList.length) marcarVistos('tickets', ticketsAbiertosList.map((tk) => tk.canalId));
    if (reportesPendientesList.length) marcarVistos('reportes', reportesPendientesList.map((r) => r._id));
    if (sugerenciasPendientesList.length) marcarVistos('sugerencias', sugerenciasPendientesList.map((s) => s._id));
  };

  // Poda: lo descartado que ya no existe (borrado) se olvida para no crecer sin límite.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (primeraPodaRef.current) { primeraPodaRef.current = false; return; }
    const idsTickets = new Set((ticketsReales || []).map((x) => x.canalId));
    const idsReportes = new Set((reportes || []).map((r) => r._id));
    const idsSugerencias = new Set((sugerencias || []).map((s) => s._id));
    setVistos((prev) => {
      const podado = {
        tickets: prev.tickets.filter((id) => idsTickets.has(id)),
        reportes: prev.reportes.filter((id) => idsReportes.has(id)),
        sugerencias: prev.sugerencias.filter((id) => idsSugerencias.has(id)),
      };
      guardarVistos(guildId, podado);
      return podado;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsReales, reportes, sugerencias]);

  // Visitar la sección de una categoría descarta sus avisos.
  useEffect(() => {
    if (activeTab === 'tickets-gestion') marcarVistos('tickets', (ticketsReales || []).filter((x) => x.estado !== 'Cerrado').map((x) => x.canalId));
    else if (activeTab === 'mod-reportes') marcarVistos('reportes', (reportes || []).filter((r) => r.estado === 'pendiente').map((r) => r._id));
    else if (activeTab === 'com-sugerencias') marcarVistos('sugerencias', (sugerencias || []).filter((s) => s.estado === 'pendiente').map((s) => s._id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ticketsReales, reportes, sugerencias]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Cierra los desplegables al hacer clic fuera o con Esc.
  useEffect(() => {
    const alClicar = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) cerrarNotif();
      if (prefsRef.current && !prefsRef.current.contains(e.target)) setPrefsAbiertas(false);
    };
    const alTeclear = (e) => { if (e.key === 'Escape') { cerrarNotif(); setPrefsAbiertas(false); } };
    document.addEventListener('mousedown', alClicar);
    document.addEventListener('keydown', alTeclear);
    return () => { document.removeEventListener('mousedown', alClicar); document.removeEventListener('keydown', alTeclear); };
  });

  const servActivo = (servidores || []).find((s) => s.id === guildId);
  const variosServidores = (servidores || []).length > 1;
  const enInicio = activeTab === 'inicio';
  const mk = metaKey(activeTab);
  const donde = enInicio ? null : ubicacion(activeTab);

  // (?) junto al título: mini-tour de la sección actual, si tiene.
  const ayudaSeccion = hasSectionTour(t, mk) ? (
    <button
      onClick={() => startSectionTour(t, mk)}
      className="sk-foco grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:border-brand/50 hover:text-fg"
      aria-label={t('dashboard.sectionHelp.aria')}
      title={t('dashboard.sectionHelp.aria')}
    >
      <HelpCircle size={15} />
    </button>
  ) : null;

  // ▶ junto al título: el vídeo de cómo se hace (en las secciones que lo tienen).
  const video = VIDEOS_PANEL[activeTab];
  const botonVideo = video ? (
    <button
      onClick={() => setVerVideo(true)}
      className="sk-foco flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/20 sm:px-2.5"
      aria-label={t('dashboard.videoAyuda.boton')}
      title={t('dashboard.videoAyuda.boton')}
    >
      <PlayCircle size={15} /> <span className="hidden sm:inline">{t('dashboard.videoAyuda.boton')}</span>
    </button>
  ) : null;

  const titulo = enInicio ? t('dashboard.header.greeting', { name: servidorInfo?.nombre || 'servidor' }) : t(`dashboard.meta.${mk}.title`);
  const subtitulo = enInicio ? t('dashboard.header.greetingSub') : t(`dashboard.meta.${mk}.subtitle`);

  return (
    <header ref={headerRef} className="sticky top-0 z-30 px-3 pt-3 sm:px-4 lg:pl-4 lg:pr-5">
      <div className="sk-cabecera flex items-center gap-2 rounded-[22px] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        {/* Abrir el menú (móvil) */}
        <button onClick={onOpenMenu} className="sk-boton-icono shrink-0 lg:hidden" aria-label={t('dashboard.sidebar.open')}>
          <Menu size={18} />
        </button>

        <motion.div key={activeTab} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="min-w-0 flex-1">
          {/* Dónde estás: Grupo › Sección */}
          <nav aria-label={t('dashboard.header.breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-muted">
            <button onClick={() => setActiveTab('inicio')} className="sk-foco flex shrink-0 items-center gap-1 rounded-md transition-colors hover:text-fg">
              <LayoutDashboard size={12} /> <span className="hidden sm:inline">{t('dashboard.inicio')}</span>
            </button>
            {donde && (
              <>
                <ChevronRight size={12} className="shrink-0 opacity-60" />
                <span className="flex min-w-0 items-center gap-1 truncate" style={{ color: donde.group.color }}>
                  <donde.group.icon size={12} className="shrink-0" /> <span className="truncate">{t(`dashboard.nav.groups.${donde.group.id}`)}</span>
                </span>
              </>
            )}
          </nav>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <h1 className="sk-titulo text-[17px] font-extrabold leading-tight tracking-tight text-fg sm:text-2xl sm:leading-8">{titulo}</h1>
            <span className="hidden sm:block">{ayudaSeccion}</span>
            {botonVideo}
          </div>
          <p className="hidden truncate text-[13px] text-muted md:block">{subtitulo}</p>
        </motion.div>

        {/* Servidor activo (móvil y tablet; en escritorio está en el menú) */}
        {servActivo && variosServidores && (
          <button
            onClick={() => setMostrarSelectorServidor(true)}
            title={t('dashboard.header.changeServer')}
            className="sk-foco hidden shrink-0 items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-1 pr-2 transition-colors hover:border-brand/40 sm:flex lg:hidden"
          >
            <Avatar src={servActivo.icono} name={servActivo.nombre} size={26} />
            <span className="max-w-[120px] truncate text-sm font-semibold text-fg">{servActivo.nombre}</span>
            <ChevronsUpDown size={13} className="shrink-0 text-muted" />
          </button>
        )}

        <span className="hidden shrink-0 xl:block"><OwnerBadge /></span>

        {/* Buscador: barra en pantallas anchas, icono en el resto */}
        <button
          onClick={onBuscar}
          className="sk-foco hidden w-60 shrink-0 items-center gap-2.5 rounded-full border border-line bg-bg/60 py-2.5 pl-3.5 pr-2.5 text-sm text-muted transition-colors hover:border-brand/40 hover:text-fg xl:flex"
        >
          <Search size={16} className="shrink-0" />
          <span className="flex-1 truncate text-left">{t('dashboard.search.button')}</span>
          <span className="sk-tecla">Ctrl K</span>
        </button>
        <button onClick={onBuscar} className="sk-boton-icono shrink-0 xl:hidden" aria-label={t('dashboard.search.open')} title={t('dashboard.search.open')}>
          <Search size={17} />
        </button>

        {/* Avisos */}
        <div ref={notifRef} className="relative shrink-0">
          <button
            onClick={() => (notifAbiertas ? cerrarNotif() : setNotifAbiertas(true))}
            className="sk-boton-icono"
            aria-label={t('dashboard.header.notifications')}
            title={t('dashboard.header.notifications')}
            aria-expanded={notifAbiertas}
          >
            <Bell size={17} />
            {totalNotificaciones > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-[0_0_10px_var(--danger)]">
                {totalNotificaciones > 9 ? '9+' : totalNotificaciones}
              </span>
            )}
          </button>
          <AnimatePresence>
            {notifAbiertas && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                style={{ '--panel-top': `${panelTop}px` }}
                className="fixed inset-x-3 top-[var(--panel-top)] z-40 overflow-hidden rounded-2xl border border-line bg-card shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-96"
              >
                <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-bold text-fg">
                    {t('dashboard.header.notifications')}
                    {totalNotificaciones > 0 && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand">{totalNotificaciones}</span>
                    )}
                  </span>
                  {totalNotificaciones > 0 && (
                    <button
                      type="button"
                      onClick={marcarTodoLeido}
                      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-fg"
                    >
                      <CheckCheck size={13} /> {t('dashboard.header.notifMarkAllRead')}
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto p-2">
                  {totalNotificaciones === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-elevated text-success">
                        <CheckCircle2 size={18} />
                      </span>
                      <p className="text-sm text-muted">{t('dashboard.header.notifEmpty')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ticketsAbiertosList.length > 0 && (
                        <NotifGroup label={t('dashboard.header.notifOpenTickets')}>
                          {ticketsAbiertosList.map((tk) => (
                            <NotifItem
                              key={tk.canalId}
                              icon={TicketIcon}
                              color="brand"
                              titulo={tk.titulo || tk.creadorNombre || tk.canalId}
                              meta={tk.estado}
                              fecha={tk.fechaCreacion}
                              onClick={() => { setActiveTab('tickets-gestion'); verMensajes(tk); cerrarNotif(); }}
                              onDismiss={(e) => descartarNotif('tickets', tk.canalId, e)}
                            />
                          ))}
                        </NotifGroup>
                      )}
                      {reportesPendientesList.length > 0 && (
                        <NotifGroup label={t('dashboard.header.notifReportes')}>
                          {reportesPendientesList.map((r) => (
                            <NotifItem
                              key={r._id}
                              icon={Flag}
                              color="danger"
                              titulo={r.reportadoTag || r.motivo || r._id}
                              fecha={r.fecha}
                              onClick={() => { setActiveTab('mod-reportes'); cerrarNotif(); }}
                              onDismiss={(e) => descartarNotif('reportes', r._id, e)}
                            />
                          ))}
                        </NotifGroup>
                      )}
                      {sugerenciasPendientesList.length > 0 && (
                        <NotifGroup label={t('dashboard.header.notifSugerencias')}>
                          {sugerenciasPendientesList.map((s) => (
                            <NotifItem
                              key={s._id}
                              icon={Lightbulb}
                              color="warn"
                              titulo={s.autor || s.texto || s._id}
                              fecha={s.creadoFecha}
                              onClick={() => { setActiveTab('com-sugerencias'); cerrarNotif(); }}
                              onDismiss={(e) => descartarNotif('sugerencias', s._id, e)}
                            />
                          ))}
                        </NotifGroup>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Escritorio: ayuda, idioma y tema a la vista */}
        <button
          data-tour="help"
          onClick={() => startOnboarding(t)}
          className="sk-boton-icono hidden shrink-0 sm:grid"
          aria-label={t('dashboard.onboarding.help.aria')}
          title={t('dashboard.onboarding.help.aria')}
        >
          <HelpCircle size={17} />
        </button>
        <div data-tour="tools" className="hidden shrink-0 items-center gap-2 sm:flex">
          <LanguageSwitcher />
          <ThemePicker theme={theme} setTheme={setTheme} esPremium={esPremium} desbloqueados={temasPremium} />
        </div>

        {/* Móvil: un solo botón con ayuda, idioma y tema */}
        <div ref={prefsRef} className="relative shrink-0 sm:hidden">
          <button
            onClick={() => setPrefsAbiertas((v) => !v)}
            className="sk-boton-icono"
            aria-label={t('dashboard.header.prefs')}
            title={t('dashboard.header.prefs')}
            aria-expanded={prefsAbiertas}
          >
            <SlidersHorizontal size={17} />
          </button>
          <AnimatePresence>
            {prefsAbiertas && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                style={{ '--panel-top': `${panelTop}px` }}
                className="fixed inset-x-3 top-[var(--panel-top)] z-40 max-h-[75vh] overflow-y-auto rounded-2xl border border-line bg-card p-4 shadow-xl"
              >
                <button
                  onClick={() => { setPrefsAbiertas(false); startOnboarding(t); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left text-sm font-semibold text-fg transition-colors hover:bg-elevated"
                >
                  <HelpCircle size={17} className="text-brand" /> {t('dashboard.onboarding.help.aria')}
                </button>
                <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('dashboard.header.language')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {IDIOMAS.map((idioma) => (
                    <button
                      key={idioma.code}
                      onClick={() => cambiarIdioma(idioma.code)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${i18n.language === idioma.code ? 'border-brand/60 bg-elevated font-semibold text-fg' : 'border-line text-muted'}`}
                    >
                      <span>{idioma.flag} {idioma.label}</span>
                      {i18n.language === idioma.code && <Check size={14} className="text-brand" />}
                    </button>
                  ))}
                </div>
                <div className="mt-4"><ThemeGrid theme={theme} setTheme={setTheme} desbloqueados={temasPremium} /></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* Fuera de la cabecera (tiene su propio desenfoque y apilado), dentro del panel para que lleve su estilo. */}
      {verVideo && video && createPortal(<VideoAyuda video={video} seccion={enInicio ? t('dashboard.inicio') : titulo} onCerrar={cerrarVideo} />, document.querySelector('.sk-dash') || document.body)}
    </header>
  );
}
