// Header superior del dashboard — saludo + buscador + idioma + tema.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Bell, HelpCircle, Menu, ChevronDown, Ticket as TicketIcon, LayoutGrid, Flag, Lightbulb } from 'lucide-react';
import { metaKey, navGroups } from './navConfig';
import { startOnboarding, startSectionTour, hasSectionTour } from '../../lib/onboarding';
import { getStaffSession } from '../../lib/api';
import OwnerBadge from './OwnerBadge';
import ThemePicker from './ThemePicker';
import LanguageSwitcher from '../LanguageSwitcher';
import { Avatar } from '../ui/primitives';

const esOwner = !!getStaffSession()?.owner;

export default function Header({ dash, onOpenMenu }) {
  const { t } = useTranslation();
  const {
    activeTab, theme, setTheme, esPremium, servidorInfo, query, setQuery,
    ticketsReales, servidores, guildId, setMostrarSelectorServidor,
    setActiveTab, verMensajes, misPermisos, reportes, sugerencias,
  } = dash;
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [notifAbiertas, setNotifAbiertas] = useState(false);
  const buscadorRef = useRef(null);
  const notifRef = useRef(null);

  // Cierra los desplegables (buscador/notificaciones) al hacer clic fuera.
  useEffect(() => {
    const alClicar = (e) => {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) setBuscadorAbierto(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifAbiertas(false);
    };
    document.addEventListener('mousedown', alClicar);
    return () => document.removeEventListener('mousedown', alClicar);
  }, []);

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
  // Notificaciones de todo el panel, no solo tickets: tickets abiertos +
  // reportes pendientes + sugerencias pendientes (los 3 "necesitan tu atención").
  const ticketsAbiertosList = ticketsReales.filter((tk) => tk.estado !== 'Cerrado');
  const reportesPendientesList = (reportes || []).filter((r) => r.estado === 'pendiente');
  const sugerenciasPendientesList = (sugerencias || []).filter((s) => s.estado === 'pendiente');
  const totalNotificaciones = ticketsAbiertosList.length + reportesPendientesList.length + sugerenciasPendientesList.length;
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
            onClick={() => setNotifAbiertas((v) => !v)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-fg transition-colors hover:bg-elevated"
            aria-label={t('dashboard.header.notifications')}
            title={t('dashboard.header.notifications')}
          >
            <Bell size={17} />
            {totalNotificaciones > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {totalNotificaciones}
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
                className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-96 w-80 overflow-y-auto rounded-2xl border border-line bg-card p-2 shadow-xl"
              >
                {totalNotificaciones === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted">{t('dashboard.header.notifEmpty')}</p>
                ) : (
                  <>
                    {ticketsAbiertosList.length > 0 && (
                      <div className="mb-1">
                        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('dashboard.header.notifOpenTickets')}</p>
                        {ticketsAbiertosList.map((tk) => (
                          <button
                            key={tk.canalId}
                            onClick={() => { setActiveTab('tickets-gestion'); verMensajes(tk); setNotifAbiertas(false); }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-elevated"
                          >
                            <TicketIcon size={15} className="shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate">{tk.titulo || tk.creadorNombre || tk.canalId}</span>
                            <span className="shrink-0 text-xs text-muted">{tk.estado}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {reportesPendientesList.length > 0 && (
                      <div className="mb-1">
                        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('dashboard.header.notifReportes')}</p>
                        {reportesPendientesList.map((r) => (
                          <button
                            key={r._id}
                            onClick={() => { setActiveTab('mod-reportes'); setNotifAbiertas(false); }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-elevated"
                          >
                            <Flag size={15} className="shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate">{r.reportadoTag || r.motivo || r._id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {sugerenciasPendientesList.length > 0 && (
                      <div>
                        <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('dashboard.header.notifSugerencias')}</p>
                        {sugerenciasPendientesList.map((s) => (
                          <button
                            key={s._id}
                            onClick={() => { setActiveTab('com-sugerencias'); setNotifAbiertas(false); }}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-elevated"
                          >
                            <Lightbulb size={15} className="shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate">{s.autor || s.texto || s._id}</span>
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

        <div data-tour="tools" className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemePicker theme={theme} setTheme={setTheme} esPremium={esPremium} />
        </div>
      </div>
    </header>
  );
}
