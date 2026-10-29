// Contenedor del Dashboard — une el layout (Sidebar + Header) con las vistas.
// Toda la lógica vive en useDashboard(); aquí solo se decide QUÉ vista mostrar.
import { useState, useEffect, useRef, useSyncExternalStore, lazy, Suspense } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LogIn, ArrowUp } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { maybeStartOnboarding } from '../../lib/onboarding';
import { marcarEnPanel } from '../../i18n';
import RecargaSiFalla from '../RecargaSiFalla';
import Sidebar from './Sidebar';
import Header from './Header';
import BuscadorPanel from './BuscadorPanel';
import '../../dashboard.css';
import ServerPicker from './ServerPicker';
import UpgradeModal from './UpgradeModal';
import AvisoDeshacer from './AvisoDeshacer';
import { AtajosTeclado } from './Preferencias';
import { ligeroActivo, suscribirLigero } from '../../lib/ligero';
import { anotarReciente } from '../../lib/recientes';
import InicioView from './views/InicioView';
// Cada sección se descarga al abrirla (el Inicio va incluido): así el panel
// arranca rápido en el móvil. Cuando el navegador está libre se precargan
// las demás, para que luego cambiar de sección sea instantáneo.
const CARGAR_VISTA = {
  TicketsView: () => import('./views/TicketsView'),
  ChatView: () => import('./views/ChatView'),
  UsersView: () => import('./views/UsersView'),
  TextsView: () => import('./views/TextsView'),
  TicketsAjustesView: () => import('./views/TicketsAjustesView'),
  LogsView: () => import('./views/LogsView'),
  RolesView: () => import('./views/RolesView'),
  AutoRolView: () => import('./views/AutoRolView'),
  PanelesView: () => import('./views/PanelesView'),
  CentroMandoView: () => import('./views/CentroMandoView'),
  MiembrosView: () => import('./views/MiembrosView'),
  TiposSancionView: () => import('./views/TiposSancionView'),
  RegistroSancionesView: () => import('./views/RegistroSancionesView'),
  AutomodView: () => import('./views/AutomodView'),
  VerificacionView: () => import('./views/VerificacionView'),
  ReportesView: () => import('./views/ReportesView'),
  BackupView: () => import('./views/BackupView'),
  AccesoView: () => import('./views/AccesoView'),
  CanalesView: () => import('./views/CanalesView'),
  ExpresionesView: () => import('./views/ExpresionesView'),
  NivelesView: () => import('./views/NivelesView'),
  AutoRespuestasView: () => import('./views/AutoRespuestasView'),
  EmbedsView: () => import('./views/EmbedsView'),
  AnunciosView: () => import('./views/AnunciosView'),
  BienvenidaView: () => import('./views/BienvenidaView'),
  PlanesView: () => import('./views/PlanesView'),
  AnaliticaView: () => import('./views/AnaliticaView'),
  ResumenView: () => import('./views/ResumenView'),
  MusicaView: () => import('./views/MusicaView'),
  VozTemporalView: () => import('./views/VozTemporalView'),
  OwnerSubsView: () => import('./views/OwnerSubsView'),
  SorteosView: () => import('./views/SorteosView'),
  EventosView: () => import('./views/EventosView'),
  EncuestasView: () => import('./views/EncuestasView'),
  SugerenciasView: () => import('./views/SugerenciasView'),
  PresentacionesView: () => import('./views/PresentacionesView'),
  DinamicasView: () => import('./views/DinamicasView'),
  CrecInvitacionesView: () => import('./views/CrecInvitacionesView'),
  CrecBumpView: () => import('./views/CrecBumpView'),
  CrecPaginaView: () => import('./views/CrecPaginaView'),
  CrecDirectosView: () => import('./views/CrecDirectosView'),
  AppMovilView: () => import('./views/AppMovilView'),
  MiCuentaView: () => import('./views/MiCuentaView'),
  DiagnosticoView: () => import('./views/DiagnosticoView'),
  CambiosView: () => import('./views/CambiosView'),
};
const V = Object.fromEntries(Object.entries(CARGAR_VISTA).map(([nombre, cargar]) => [nombre, lazy(cargar)]));

// Precarga en segundo plano, de una en una y sin estorbar (no con «ahorro de datos»).
// Devuelve con qué pararla (al salir del panel ya no hace falta).
function precargarVistas() {
  if (navigator.connection?.saveData) return () => {};
  const cola = Object.values(CARGAR_VISTA);
  const ocioso = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  let parada = false;
  const siguiente = () => {
    const cargar = !parada && cola.shift();
    if (cargar) ocioso(() => { if (!parada) cargar().catch(() => {}).finally(siguiente); }, { timeout: 4000 });
  };
  siguiente();
  return () => { parada = true; };
}

function CargandoVista() {
  return (
    <div className="flex justify-center py-16" role="status" aria-live="polite">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand" />
    </div>
  );
}

export default function Dashboard({ onExitToLanding, onLogout, onRelogin }) {
  const { t } = useTranslation();
  const dash = useDashboard();
  const { activeTab, ticketSeleccionado, setTicketSeleccionado, setActiveTab, errorConexion, sesionCaducada, servidorInfo, esPremium, servidores, guildId, setGuildId, misPermisos, mostrarSelectorServidor, setMostrarSelectorServidor, estadoModulos } = dash;

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sokyoSidebarCollapsed') === '1');
  const toggleCollapsed = (value) => {
    const next = typeof value === 'function' ? value(collapsed) : value;
    setCollapsed(next);
    localStorage.setItem('sokyoSidebarCollapsed', next ? '1' : '0');
  };

  // Menú lateral como "drawer" en móvil (en escritorio es fijo).
  const [mobileOpen, setMobileOpen] = useState(false);

  // Buscador de todo el panel: Ctrl/⌘ + K desde cualquier sitio, o "/" si no se
  // está escribiendo en un campo.
  const [buscador, setBuscador] = useState(false);
  // Chuleta de atajos: «?» desde cualquier sitio (o desde las preferencias).
  const [atajos, setAtajos] = useState(false);
  useEffect(() => {
    const tecla = (e) => {
      const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBuscador((v) => !v); }
      else if (e.key === '/' && !enCampo && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setBuscador(true); }
      else if (e.key === '?' && !enCampo && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setAtajos(true); }
      // Ctrl + S: guarda ya la sección abierta (la que tiene autoguardado), sin
      // el «Guardar página» del navegador.
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); window.dispatchEvent(new Event('sokyo-guardar')); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  // Upsell contextual: qué función de pago intentó abrir un servidor Free.
  // null = modal cerrado. Lo dispara el Sidebar al pulsar un ítem con candado.
  const [upgradeFeature, setUpgradeFeature] = useState(null);

  // Onboarding: la PRIMERA vez que se entra al panel, lanza el tour guiado.
  // El pequeño retardo da tiempo a que monten el sidebar y la vista de inicio.
  const onboardingLanzado = useRef(false);
  useEffect(() => {
    if (onboardingLanzado.current || activeTab !== 'inicio') return;
    // Esperar a que haya un servidor elegido: si está abierto el selector
    // (varios servidores, sin elegir aún), el tour se lanzaría por encima y lo
    // taparía. Cuando se elige servidor, este efecto vuelve a correr.
    if (!guildId || (mostrarSelectorServidor && servidores.length > 1)) return;
    onboardingLanzado.current = true;
    const id = setTimeout(() => maybeStartOnboarding(t), 700);
    return () => clearTimeout(id);
  }, [activeTab, t, guildId, mostrarSelectorServidor, servidores.length]);

  // La pestaña abierta va en la URL (#dashboard/<pestaña>, y el ticket abierto en
  // …/t/<canal>): al recargar, o al compartir el enlace, se vuelve a la misma
  // sección. Cada cambio es un paso del historial: el «atrás» del navegador, del
  // ratón o del móvil vuelve a lo anterior del panel en vez de salir de él.
  const ticketEnUrl = activeTab === 'tickets-gestion' ? ticketSeleccionado?.canalId || null : null;
  // Ticket de la URL al abrir el panel (un enlace compartido o al recargar): se
  // abre en cuanto llega la lista de tickets.
  const ticketInicial = useRef((window.location.hash.match(/^#dashboard\/tickets-gestion\/t\/([\w-]+)/) || [])[1] || null);
  const primeraUrl = useRef(true);
  useEffect(() => {
    const id = ticketInicial.current;
    if (!id || !dash.ticketsReales?.length) return;
    ticketInicial.current = null;
    const tk = dash.ticketsReales.find((x) => x.canalId === id);
    if (tk) dash.verMensajes(tk);
  }, [dash.ticketsReales, dash]);
  useEffect(() => {
    const destino = activeTab === 'inicio' ? '#dashboard' : `#dashboard/${activeTab}${ticketEnUrl ? `/t/${ticketEnUrl}` : ''}`;
    // Mientras se abre el ticket de la URL, la dirección se deja como está.
    if (ticketInicial.current && window.location.hash.startsWith(`${destino}/t/`)) return;
    const estado = window.history.state;
    // La entrada con la que se abre el panel es el paso 0 (se corrige, no se añade otra).
    if (primeraUrl.current) {
      primeraUrl.current = false;
      if (typeof estado?.sokyoPaso !== 'number' || window.location.hash !== destino) {
        window.history.replaceState({ ...estado, sokyoPaso: typeof estado?.sokyoPaso === 'number' ? estado.sokyoPaso : 0 }, '', destino);
        window.dispatchEvent(new Event('sokyo-historial'));
      }
      return;
    }
    if (window.location.hash === destino) return;
    const paso = estado?.sokyoPaso;
    window.history.pushState({ sokyoPaso: typeof paso === 'number' ? paso + 1 : 1, sokyoTicket: !!ticketEnUrl }, '', destino);
    window.dispatchEvent(new Event('sokyo-historial'));
  }, [activeTab, ticketEnUrl]);
  // Al volver (o avanzar) con el navegador: se abre la sección de la URL.
  const dashRef = useRef(dash);
  useEffect(() => { dashRef.current = dash; });
  useEffect(() => {
    const alVolver = () => {
      const m = window.location.hash.match(/^#dashboard(?:\/([\w-]+))?(?:\/t\/([\w-]+))?/);
      if (!m) return; // ha salido del panel: de eso se encarga App
      const d = dashRef.current;
      const tab = m[1] || 'inicio';
      if (m[2] && tab === 'tickets-gestion') {
        const tk = (d.ticketsReales || []).find((x) => x.canalId === m[2]);
        if (tk && d.ticketSeleccionado?.canalId !== tk.canalId) d.verMensajes(tk);
      } else if (d.ticketSeleccionado) d.cerrarMensajes();
      d.setActiveTab(tab);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);
  // Cuántos pasos hay para volver dentro del panel (botón «Atrás» de la cabecera).
  const pasosAtras = useSyncExternalStore(suscribirHistorial, leerPaso);
  const irAtras = () => {
    if (pasosAtras > 0) window.history.back();
    else navigate('inicio');
  };
  // «Volver» desde un ticket: si se abrió desde la lista, es un paso atrás.
  const cerrarChat = () => {
    if (pasosAtras > 0 && window.history.state?.sokyoTicket) window.history.back();
    else dash.cerrarMensajes();
  };

  const mainRef = useRef(null);

  // Navegación desde el sidebar: al ir a "Gestión" cerramos el chat abierto.
  // En móvil, además cerramos el drawer al elegir una sección.
  const navigate = (tab) => {
    if (tab === 'tickets-gestion') setTicketSeleccionado(null);
    setActiveTab(tab);
    setMobileOpen(false);
  };
  // Cada sección empieza arriba del todo, se llegue desde donde se llegue
  // (menú, buscador, migas de pan, avisos o el mapa del inicio). Y se apunta en
  // «Recientes» del buscador.
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); anotarReciente(activeTab); }, [activeTab]);
  // Botón «Volver arriba» cuando se ha bajado mucho en una sección larga.
  const [lejos, setLejos] = useState(false);
  const alDesplazar = (e) => { const abajo = e.currentTarget.scrollTop > 700; if (abajo !== lejos) setLejos(abajo); };
  // Modo ligero (PCs con pocos recursos y Firefox): sin animaciones de movimiento.
  const ligero = useSyncExternalStore(suscribirLigero, ligeroActivo, () => false);
  // Con el panel ya pintado (y un respiro), se precargan las demás secciones.
  useEffect(() => {
    let parar = () => {};
    const id = setTimeout(() => { parar = precargarVistas(); }, 3000);
    return () => { clearTimeout(id); parar(); };
  }, []);
  // Mientras el panel está abierto, cambiar de idioma trae también sus textos.
  useEffect(() => { marcarEnPanel(true); return () => marcarEnPanel(false); }, []);

  const renderView = () => {
    if (activeTab === 'inicio') return <InicioView dash={dash} onBuscar={() => setBuscador(true)} onRequestUpgrade={setUpgradeFeature} />;
    if (activeTab === 'tickets-gestion') return ticketSeleccionado ? <V.ChatView dash={{ ...dash, cerrarMensajes: cerrarChat }} /> : <V.TicketsView dash={dash} />;
    if (activeTab === 'tickets-usuarios') return <V.UsersView dash={dash} />;
    if (activeTab === 'tickets-config') return <V.TicketsAjustesView dash={dash} />;
    if (activeTab === 'config-textos') return <V.TextsView dash={dash} />;
    if (activeTab === 'config-acceso') return <V.AccesoView dash={dash} />;
    if (activeTab === 'config-canales') return <V.CanalesView dash={dash} />;
    if (activeTab === 'config-expresiones') return <V.ExpresionesView dash={dash} />;
    if (activeTab === 'config-niveles') return <V.NivelesView dash={dash} />;
    if (activeTab === 'roles-gestion') return <V.RolesView dash={dash} />;
    if (activeTab === 'roles-autorol') return <V.AutoRolView dash={dash} />;
    if (activeTab === 'roles-paneles') return <V.PanelesView dash={dash} />;
    if (activeTab === 'mod-centro') return <V.CentroMandoView dash={dash} />;
    if (activeTab === 'mod-miembros') return <V.MiembrosView dash={dash} />;
    if (activeTab === 'mod-tipos') return <V.TiposSancionView dash={dash} />;
    if (activeTab === 'mod-automod') return <V.AutomodView dash={dash} />;
    if (activeTab === 'mod-registro') return <V.RegistroSancionesView dash={dash} />;
    if (activeTab === 'seg-verificacion') return <V.VerificacionView dash={dash} />;
    if (activeTab === 'seg-reportes' || activeTab === 'mod-reportes') return <V.ReportesView dash={dash} />;
    if (activeTab === 'seg-backup') return <V.BackupView dash={dash} />;
    if (activeTab === 'prod-autorespuestas') return <V.AutoRespuestasView dash={dash} />;
    if (activeTab === 'prod-embeds') return <V.EmbedsView dash={dash} />;
    if (activeTab === 'prod-anuncios') return <V.AnunciosView dash={dash} />;
    if (activeTab === 'prod-bienvenidas') return <V.BienvenidaView dash={dash} />;
    if (activeTab === 'cuenta-plan') return <V.PlanesView dash={dash} />;
    if (activeTab === 'com-micuenta') return <V.MiCuentaView dash={dash} />;
    if (activeTab === 'com-sorteos') return <V.SorteosView dash={dash} />;
    if (activeTab === 'com-eventos') return <V.EventosView dash={dash} />;
    if (activeTab === 'com-encuestas') return <V.EncuestasView dash={dash} />;
    if (activeTab === 'com-sugerencias') return <V.SugerenciasView dash={dash} />;
    if (activeTab === 'com-presentaciones') return <V.PresentacionesView dash={dash} />;
    if (activeTab === 'com-dinamicas') return <V.DinamicasView dash={dash} />;
    if (activeTab === 'crec-invitaciones') return <V.CrecInvitacionesView dash={dash} />;
    if (activeTab === 'crec-bump') return <V.CrecBumpView dash={dash} />;
    if (activeTab === 'crec-pagina') return <V.CrecPaginaView dash={dash} />;
    if (activeTab === 'crec-directos') return <V.CrecDirectosView dash={dash} />;
    if (activeTab === 'musica') return <V.MusicaView dash={dash} />;
    if (activeTab === 'voz-temporal') return <V.VozTemporalView dash={dash} />;
    if (activeTab === 'owner-subs') return <V.OwnerSubsView dash={dash} />;
    if (activeTab === 'datos-analitica') return <V.AnaliticaView dash={dash} />;
    if (activeTab === 'datos-resumen') return <V.ResumenView dash={dash} />;
    if (activeTab === 'config-app') return <V.AppMovilView />;
    if (activeTab === 'config-diagnostico') return <V.DiagnosticoView dash={dash} />;
    if (activeTab === 'config-cambios') return <V.CambiosView dash={dash} />;
    if (activeTab.startsWith('logs-')) return <V.LogsView dash={dash} />;
    return <InicioView dash={dash} onBuscar={() => setBuscador(true)} onRequestUpgrade={setUpgradeFeature} />;
  };

  // Con el servidor en la clave, cada vista se monta de cero al cambiar de servidor
  // y no arrastra formularios a medio editar del anterior.
  const viewKey = `${guildId}:${activeTab === 'tickets-gestion' && ticketSeleccionado ? 'chat' : activeTab}:${dash.recarga}`;

  // h-dvh y no h-screen: en el móvil 100vh es más alto que la parte visible
  // (por la barra del navegador) y lo de abajo quedaba fuera de la pantalla.
  return (
    <MotionConfig reducedMotion={ligero ? 'always' : 'user'}>
    <div className="sk-dash flex h-dvh overflow-hidden text-fg">
      <FondoPanel />
      <Sidebar
        activeTab={activeTab}
        setActiveTab={navigate}
        collapsed={collapsed}
        setCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onExitToLanding={onExitToLanding}
        servidorInfo={servidorInfo}
        esPremium={esPremium}
        onRequestUpgrade={setUpgradeFeature}
        servidores={servidores}
        guildId={guildId}
        onCambiarServidor={() => setMostrarSelectorServidor(true)}
        permisos={misPermisos}
        moduleStatus={estadoModulos}
        onLogout={onLogout}
        onBuscar={() => { setMobileOpen(false); setBuscador(true); }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header dash={dash} onOpenMenu={() => setMobileOpen(true)} onBuscar={() => setBuscador(true)} puedeVolver={pasosAtras > 0 || activeTab !== 'inicio'} onAtras={irAtras} onAtajos={() => setAtajos(true)} />

        <main ref={mainRef} onScroll={alDesplazar} className="flex-1 overflow-y-auto px-3 pb-10 pt-4 sm:px-4 sm:pt-5 lg:pl-4 lg:pr-5">
          <div className="mx-auto w-full max-w-[1500px]">
          {errorConexion && (
            <div className="mb-6 rounded-2xl border border-danger/40 bg-danger/10 p-5">
              <p className="flex items-center gap-2 font-semibold text-danger">
                <AlertTriangle size={18} /> {errorConexion}
              </p>
              {sesionCaducada && onRelogin ? (
                <button
                  onClick={onRelogin}
                  className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#5865F2]/40 transition-transform hover:scale-[1.03]"
                >
                  <LogIn size={16} /> {t('dashboard.auth.loginButton')}
                </button>
              ) : (
                <p className="mt-1.5 text-sm text-danger/80">{t('dashboard.error.detail')}</p>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={viewKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="h-full"
            >
              <RecargaSiFalla><Suspense fallback={<CargandoVista />}>{renderView()}</Suspense></RecargaSiFalla>
            </motion.div>
          </AnimatePresence>
          </div>
        </main>
      </div>

      <ServerPicker
        abierto={mostrarSelectorServidor && servidores.length > 1}
        servidores={servidores}
        guildId={guildId}
        onSeleccionar={setGuildId}
        onCerrar={() => setMostrarSelectorServidor(false)}
      />

      {/* Se monta al abrirlo: así empieza siempre vacío, sin perder lo que se teclea nada más abrir. */}
      {buscador && <BuscadorPanel
        abierto
        onCerrar={() => setBuscador(false)}
        irA={navigate}
        permisos={misPermisos}
        esPremium={esPremium}
        moduleStatus={estadoModulos}
        tickets={dash.ticketsReales}
        abrirTicket={(tk) => { navigate('tickets-gestion'); dash.verMensajes(tk); }}
        onRequestUpgrade={setUpgradeFeature}
      />}

      <UpgradeModal
        feature={upgradeFeature}
        onClose={() => setUpgradeFeature(null)}
        onVerPlanes={() => { setUpgradeFeature(null); navigate('cuenta-plan'); }}
      />

      {atajos && <AtajosTeclado onCerrar={() => setAtajos(false)} />}

      {/* «Guardado · Deshacer» tras cada cambio (solo quien puede deshacerlo). */}
      {misPermisos?.config !== false && (
        <AvisoDeshacer guildId={guildId} onDeshecho={() => dash.recargarSeccion()} onHistorial={() => navigate('config-cambios')} />
      )}

      {lejos && (
        <button
          type="button" onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: ligero ? 'auto' : 'smooth' })}
          className="sk-boton-icono sk-aparece fixed bottom-5 right-5 z-30 !h-11 !w-11 shadow-lg"
          aria-label={t('dashboard.backToTop')} title={t('dashboard.backToTop')}
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
    </MotionConfig>
  );
}

// Historial del navegador para el botón «Atrás» (lo actualiza el propio panel al
// cambiar de sección y el navegador al volver o avanzar).
function suscribirHistorial(avisar) {
  window.addEventListener('popstate', avisar);
  window.addEventListener('sokyo-historial', avisar);
  return () => { window.removeEventListener('popstate', avisar); window.removeEventListener('sokyo-historial', avisar); };
}
const leerPaso = () => (typeof window.history.state?.sokyoPaso === 'number' ? window.history.state.sokyoPaso : 0);

// Fondo del panel: nebulosas con los colores del tema, polvo de estrellas y
// dos estelas de luz quietas (src/dashboard.css). Sin animación: es un sitio de
// trabajo y todo lo que se mueve detrás del cristal cuesta rendimiento.
function FondoPanel() {
  return (
    <div className="sk-fondo" aria-hidden="true">
      <svg className="sk-estelas" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sk-estela-1" x1="0" x2="1">
            <stop offset="0" stopColor="var(--brand-to)" stopOpacity="0" />
            <stop offset=".45" stopColor="var(--brand-to)" stopOpacity=".55" />
            <stop offset=".8" stopColor="var(--brand-from)" stopOpacity=".45" />
            <stop offset="1" stopColor="var(--brand-from)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sk-estela-2" x1="0" x2="1">
            <stop offset="0" stopColor="var(--brand-from)" stopOpacity="0" />
            <stop offset=".5" stopColor="var(--accent-color)" stopOpacity=".4" />
            <stop offset="1" stopColor="var(--brand-to)" stopOpacity="0" />
          </linearGradient>
          <filter id="sk-difuso" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" /></filter>
        </defs>
        <path d="M-120 820 C 300 700, 640 760, 960 520 S 1320 160, 1580 90" fill="none" stroke="url(#sk-estela-1)" strokeWidth="34" opacity=".35" filter="url(#sk-difuso)" />
        <path d="M-120 820 C 300 700, 640 760, 960 520 S 1320 160, 1580 90" fill="none" stroke="url(#sk-estela-1)" strokeWidth="1.6" />
        <path d="M-100 150 C 300 250, 560 110, 880 210 S 1240 460, 1560 400" fill="none" stroke="url(#sk-estela-2)" strokeWidth="1.2" />
      </svg>
    </div>
  );
}
