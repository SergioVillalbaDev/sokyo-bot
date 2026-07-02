// Header superior del dashboard — saludo + buscador + idioma + tema.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Bell, HelpCircle, Menu, ChevronDown, Ticket as TicketIcon, LayoutGrid, Flag, Lightbulb, X, CheckCircle2, CheckCheck } from 'lucide-react';
import { metaKey, navGroups } from './navConfig';
import { startOnboarding, startSectionTour, hasSectionTour } from '../../lib/onboarding';
import { getStaffSession } from '../../lib/api';
import OwnerBadge from './OwnerBadge';
import ThemePicker from './ThemePicker';
import LanguageSwitcher from '../LanguageSwitcher';
import { Avatar } from '../ui/primitives';

const esOwner = !!getStaffSession()?.owner;

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
        className="shrink-0 rounded-full p-1.5 text-muted opacity-50 transition-opacity hover:bg-danger/20 hover:text-danger hover:opacity-100 focus-visible:opacity-100"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function Header({ dash, onOpenMenu }) {
  const { t } = useTranslation();
  const {
    activeTab, theme, setTheme, esPremium, servidorInfo, query, setQuery,
    ticketsReales, servidores, guildId, setMostrarSelectorServidor,
    setActiveTab, verMensajes, misPermisos, reportes, sugerencias,
  } = dash;
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [notifAbiertas, setNotifAbiertas] = useState(false);
  const [vistos, setVistos] = useState(() => cargarVistos(guildId));
  const buscadorRef = useRef(null);
  const notifRef = useRef(null);
  // Evita que la poda de más abajo borre descartes válidos justo después de
  // montar o cambiar de servidor, mientras tickets/reportes/sugerencias aún
  // están en su [] inicial (la API todavía no ha respondido). Sin esto, cada
  // recarga de página (F5) confundía "todavía no ha llegado" con "ya no
  // existe" y vaciaba lo guardado en localStorage — las notificaciones
  // descartadas volvían a aparecer.
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

  // Notificaciones pendientes ahora mismo (las ya descartadas no cuentan).
  // Se calculan aquí arriba (y no solo más abajo, junto al resto del JSX) porque
  // el listener de "click fuera" las necesita antes en el render.
  const ticketsAbiertosList = (ticketsReales || []).filter((tk) => tk.estado !== 'Cerrado' && !vistos.tickets.includes(tk.canalId));
  const reportesPendientesList = (reportes || []).filter((r) => r.estado === 'pendiente' && !vistos.reportes.includes(r._id));
  const sugerenciasPendientesList = (sugerencias || []).filter((s) => s.estado === 'pendiente' && !vistos.sugerencias.includes(s._id));
  const totalNotificaciones = ticketsAbiertosList.length + reportesPendientesList.length + sugerenciasPendientesList.length;

  // Cerrar el panel (clic fuera, tecla Esc o pulsar la campana otra vez) ya
  // NO descarta nada — antes lo hacía y sorprendía: abrías la campana solo
  // para mirar y, al cerrarla, desaparecía todo. Descartar es siempre una
  // acción explícita: la X de cada fila, "Marcar todo como leído", o
  // visitar la sección correspondiente (más abajo).
  const cerrarNotif = () => setNotifAbiertas(false);

  // Marcar todo como leído: acción explícita y visible, ya no un efecto
  // secundario de cerrar el panel.
  const marcarTodoLeido = () => {
    if (ticketsAbiertosList.length) marcarVistos('tickets', ticketsAbiertosList.map((tk) => tk.canalId));
    if (reportesPendientesList.length) marcarVistos('reportes', reportesPendientesList.map((r) => r._id));
    if (sugerenciasPendientesList.length) marcarVistos('sugerencias', sugerenciasPendientesList.map((s) => s._id));
  };

  // Poda: si un ticket/reporte/sugerencia ya no existe (borrado), no hace
  // falta seguir recordando que se descartó — evita que crezca sin límite.
  // Se salta la primera pasada tras montar/cambiar de servidor (ver
  // primeraPodaRef arriba) para no confundir "aún cargando" con "borrado".
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (primeraPodaRef.current) { primeraPodaRef.current = false; return; }
    const idsTickets = new Set((ticketsReales || []).map((t) => t.canalId));
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

  // Visitar el panel de una categoría descarta automáticamente sus notificaciones.
  useEffect(() => {
    if (activeTab === 'tickets-gestion') marcarVistos('tickets', (ticketsReales || []).filter((t) => t.estado !== 'Cerrado').map((t) => t.canalId));
    else if (activeTab === 'mod-reportes') marcarVistos('reportes', (reportes || []).filter((r) => r.estado === 'pendiente').map((r) => r._id));
    else if (activeTab === 'com-sugerencias') marcarVistos('sugerencias', (sugerencias || []).filter((s) => s.estado === 'pendiente').map((s) => s._id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ticketsReales, reportes, sugerencias]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Cierra los desplegables (buscador/notificaciones) al hacer clic fuera.
  // Sin array de dependencias: se re-suscribe en cada render para que
  // cerrarNotif() siempre vea las listas de notificaciones más recientes.
  useEffect(() => {
    const alClicar = (e) => {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) setBuscadorAbierto(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) cerrarNotif();
    };
    document.addEventListener('mousedown', alClicar);
    return () => document.removeEventListener('mousedown', alClicar);
  });

  // Todas las secciones del menú a las que el usuario tiene acceso, con su título traducido.
  const seccionesBuscables = useMemo(() => (
    navGroups
      .filter((g) => (!g.owner || esOwner) && (!misPermisos || misPermisos[g.id] !== false))
      .flatMap((g) => g.items.map((item) => ({ tab: item.tab, titulo: t(`dashboard.nav.items.${item.tab}`) })))
  ), [t, misPermisos]);

  const q = (query || '').trim().toLowerCase();
  const seccionesEncontradas = q ? seccionesBuscables.filter((s) => s.titulo.toLowerCase().includes(q)).slice(0, 5) : [];
  const ticketsEncontrados = q
    ? (ticketsReales || []).filter((tk) =>
        (tk.titulo || '').toLowerCase().includes(q) ||
        (tk.motivo || '').toLowerCase().includes(q) ||
        (tk.creadorNombre || '').toLowerCase().includes(q)
      ).slice(0, 5)
    : [];
  const hayResultados = seccionesEncontradas.length > 0 || ticketsEncontrados.length > 0;

  const irASeccion = (tab) => {
    setActiveTab(tab);
    setQuery('');
    setBuscadorAbierto(false);
  };

  const abrirTicket = (ticket) => {
    setActiveTab('tickets-gestion');
    verMensajes(ticket);
    setQuery('');
    setBuscadorAbierto(false);
  };
  // Servidor activo: visible siempre (también en móvil) para no perderse de cuál
  // se está gestionando. Si hay varios, al pulsarlo se abre el selector.
  const servActivo = (servidores || []).find((s) => s.id === guildId);
  const variosServidores = (servidores || []).length > 1;
  const enInicio = activeTab === 'inicio';
  const mk = metaKey(activeTab);

  // Botón (?) que lanza el mini-tour guiado de la sección actual (señala y
  // explica sus partes). Solo aparece si la sección tiene tour definido.
  const sectionHelpButton = hasSectionTour(t, mk) ? (
    <button
      onClick={() => startSectionTour(t, mk)}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-card text-muted transition-colors hover:bg-elevated hover:text-fg"
      aria-label={t('dashboard.sectionHelp.aria')}
      title={t('dashboard.sectionHelp.aria')}
    >
      <HelpCircle size={15} />
    </button>
  ) : null;

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-line bg-bg/80 px-6 py-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="flex items-center gap-3">
        {/* Abrir menú (solo móvil) */}
        <button
          onClick={onOpenMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-fg transition-colors hover:bg-elevated lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        <motion.div key={activeTab} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {enInicio ? (
          <>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-[1.7rem]">
                {t('dashboard.header.greeting', { name: servidorInfo?.nombre || 'servidor' })}
              </h1>
              {sectionHelpButton}
            </div>
            <p className="mt-0.5 text-sm text-muted">{t('dashboard.header.greetingSub')}</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-fg">{t(`dashboard.meta.${mk}.title`)}</h1>
              {sectionHelpButton}
            </div>
            <p className="mt-0.5 text-sm text-muted">{t(`dashboard.meta.${mk}.subtitle`)}</p>
          </>
        )}
        </motion.div>
      </div>

      <div className="flex items-center gap-3">
        {/* Servidor activo (siempre visible; clicable si hay varios) */}
        {servActivo && (
          <button
            onClick={() => variosServidores && setMostrarSelectorServidor(true)}
            disabled={!variosServidores}
            title={variosServidores ? t('dashboard.header.changeServer') : servActivo.nombre}
            className="flex max-w-[44vw] items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-1.5 pr-3 transition-colors enabled:hover:bg-elevated disabled:cursor-default sm:max-w-[220px]"
          >
            <Avatar src={servActivo.icono} name={servActivo.nombre} size={26} />
            <span className="min-w-0 truncate text-sm font-semibold text-fg">{servActivo.nombre}</span>
            {variosServidores && <ChevronDown size={14} className="shrink-0 text-muted" />}
          </button>
        )}

        <OwnerBadge />

        <div ref={buscadorRef} className="relative hidden md:block">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setBuscadorAbierto(true); }}
            onFocus={() => setBuscadorAbierto(true)}
            placeholder={t('dashboard.header.search')}
            className="w-52 rounded-full border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-fg outline-none transition-all focus:w-72 focus:ring-2 focus:ring-brand/30"
          />
          <AnimatePresence>
            {buscadorAbierto && q && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-96 w-80 overflow-y-auto rounded-2xl border border-line bg-card p-2 shadow-xl"
              >
                {!hayResultados ? (
                  <p className="px-3 py-4 text-center text-sm text-muted">{t('dashboard.header.searchEmpty')}</p>
                ) : (
                  <>
                    {seccionesEncontradas.length > 0 && (
                      <div className="mb-1">
                        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('dashboard.header.searchSections')}</p>
                        {seccionesEncontradas.map((s) => (
                          <button
                            key={s.tab}
                            onClick={() => irASeccion(s.tab)}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-elevated"
                          >
                            <LayoutGrid size={15} className="shrink-0 text-muted" />
                            <span className="truncate">{s.titulo}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {ticketsEncontrados.length > 0 && (
                      <div>
                        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('dashboard.header.searchTickets')}</p>
                        {ticketsEncontrados.map((tk) => (
                          <button
                            key={tk.canalId}
                            onClick={() => abrirTicket(tk)}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-elevated"
                          >
                            <TicketIcon size={15} className="shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate">{tk.titulo || tk.creadorNombre || tk.canalId}</span>
                            {tk.estado && <span className="shrink-0 text-xs text-muted">{tk.estado}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          data-tour="help"
          onClick={() => startOnboarding(t)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-fg transition-colors hover:bg-elevated"
          aria-label={t('dashboard.onboarding.help.aria')}
          title={t('dashboard.onboarding.help.aria')}
        >
          <HelpCircle size={17} />
        </button>

        <div ref={notifRef} className="relative">
          <button
            onClick={() => (notifAbiertas ? cerrarNotif() : setNotifAbiertas(true))}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-fg transition-colors hover:bg-elevated"
            aria-label={t('dashboard.header.notifications')}
            title={t('dashboard.header.notifications')}
          >
            <Bell size={17} />
            {totalNotificaciones > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
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
                className="absolute right-0 top-[calc(100%+8px)] z-30 w-80 overflow-hidden rounded-2xl border border-line bg-card shadow-xl sm:w-96"
              >
                <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-bold text-fg">
                    {t('dashboard.header.notifications')}
                    {totalNotificaciones > 0 && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{totalNotificaciones}</span>
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
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-muted">
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

        <div data-tour="tools" className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemePicker theme={theme} setTheme={setTheme} esPremium={esPremium} />
        </div>
      </div>
    </header>
  );
}
