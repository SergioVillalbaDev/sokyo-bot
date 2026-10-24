// Contenedor del Dashboard — une el layout (Sidebar + Header) con las vistas.
// Toda la lógica vive en useDashboard(); aquí solo se decide QUÉ vista mostrar.
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, LogIn } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { maybeStartOnboarding } from '../../lib/onboarding';
import Sidebar from './Sidebar';
import Header from './Header';
import BuscadorPanel from './BuscadorPanel';
import '../../dashboard.css';
import ServerPicker from './ServerPicker';
import UpgradeModal from './UpgradeModal';
import InicioView from './views/InicioView';
import TicketsView from './views/TicketsView';
import ChatView from './views/ChatView';
import UsersView from './views/UsersView';
import TextsView from './views/TextsView';
import TicketsAjustesView from './views/TicketsAjustesView';
import LogsView from './views/LogsView';
import RolesView from './views/RolesView';
import AutoRolView from './views/AutoRolView';
import PanelesView from './views/PanelesView';
import CentroMandoView from './views/CentroMandoView';
import TiposSancionView from './views/TiposSancionView';
import RegistroSancionesView from './views/RegistroSancionesView';
import AutomodView from './views/AutomodView';
import VerificacionView from './views/VerificacionView';
import ReportesView from './views/ReportesView';
import BackupView from './views/BackupView';
import AccesoView from './views/AccesoView';
import CanalesView from './views/CanalesView';
import ExpresionesView from './views/ExpresionesView';
import NivelesView from './views/NivelesView';
import AutoRespuestasView from './views/AutoRespuestasView';
import EmbedsView from './views/EmbedsView';
import AnunciosView from './views/AnunciosView';
import BienvenidaView from './views/BienvenidaView';
import PlanesView from './views/PlanesView';
import AnaliticaView from './views/AnaliticaView';
import ResumenView from './views/ResumenView';
import MusicaView from './views/MusicaView';
import VozTemporalView from './views/VozTemporalView';
import OwnerSubsView from './views/OwnerSubsView';
import SorteosView from './views/SorteosView';
import EventosView from './views/EventosView';
import EncuestasView from './views/EncuestasView';
import SugerenciasView from './views/SugerenciasView';
import PresentacionesView from './views/PresentacionesView';
import DinamicasView from './views/DinamicasView';
import CrecInvitacionesView from './views/CrecInvitacionesView';
import CrecBumpView from './views/CrecBumpView';
import CrecPaginaView from './views/CrecPaginaView';
import CrecDirectosView from './views/CrecDirectosView';
import AppMovilView from './views/AppMovilView';

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
  useEffect(() => {
    const tecla = (e) => {
      const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBuscador((v) => !v); }
      else if (e.key === '/' && !enCampo && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setBuscador(true); }
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

  // La pestaña abierta va en la URL (#dashboard/<pestaña>): al recargar, o al
  // compartir el enlace, se vuelve a la misma sección.
  useEffect(() => {
    const destino = activeTab === 'inicio' ? '#dashboard' : `#dashboard/${activeTab}`;
    if (window.location.hash !== destino) window.history.replaceState(null, '', destino);
  }, [activeTab]);

  const mainRef = useRef(null);

  // Navegación desde el sidebar: al ir a "Gestión" cerramos el chat abierto.
  // En móvil, además cerramos el drawer al elegir una sección.
  const navigate = (tab) => {
    if (tab === 'tickets-gestion') setTicketSeleccionado(null);
    setActiveTab(tab);
    setMobileOpen(false);
  };
  // Cada sección empieza arriba del todo, se llegue desde donde se llegue
  // (menú, buscador, migas de pan, avisos o el mapa del inicio).
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [activeTab]);

  const renderView = () => {
    if (activeTab === 'inicio') return <InicioView dash={dash} onBuscar={() => setBuscador(true)} onRequestUpgrade={setUpgradeFeature} />;
    if (activeTab === 'tickets-gestion') return ticketSeleccionado ? <ChatView dash={dash} /> : <TicketsView dash={dash} />;
    if (activeTab === 'tickets-usuarios') return <UsersView dash={dash} />;
    if (activeTab === 'tickets-config') return <TicketsAjustesView dash={dash} />;
    if (activeTab === 'config-textos') return <TextsView dash={dash} />;
    if (activeTab === 'config-acceso') return <AccesoView dash={dash} />;
    if (activeTab === 'config-canales') return <CanalesView dash={dash} />;
    if (activeTab === 'config-expresiones') return <ExpresionesView dash={dash} />;
    if (activeTab === 'config-niveles') return <NivelesView dash={dash} />;
    if (activeTab === 'roles-gestion') return <RolesView dash={dash} />;
    if (activeTab === 'roles-autorol') return <AutoRolView dash={dash} />;
    if (activeTab === 'roles-paneles') return <PanelesView dash={dash} />;
    if (activeTab === 'mod-centro') return <CentroMandoView dash={dash} />;
    if (activeTab === 'mod-tipos') return <TiposSancionView dash={dash} />;
    if (activeTab === 'mod-automod') return <AutomodView dash={dash} />;
    if (activeTab === 'mod-registro') return <RegistroSancionesView dash={dash} />;
    if (activeTab === 'seg-verificacion') return <VerificacionView dash={dash} />;
    if (activeTab === 'seg-reportes' || activeTab === 'mod-reportes') return <ReportesView dash={dash} />;
    if (activeTab === 'seg-backup') return <BackupView dash={dash} />;
    if (activeTab === 'prod-autorespuestas') return <AutoRespuestasView dash={dash} />;
    if (activeTab === 'prod-embeds') return <EmbedsView dash={dash} />;
    if (activeTab === 'prod-anuncios') return <AnunciosView dash={dash} />;
    if (activeTab === 'prod-bienvenidas') return <BienvenidaView dash={dash} />;
    if (activeTab === 'cuenta-plan') return <PlanesView dash={dash} />;
    if (activeTab === 'com-sorteos') return <SorteosView dash={dash} />;
    if (activeTab === 'com-eventos') return <EventosView dash={dash} />;
    if (activeTab === 'com-encuestas') return <EncuestasView dash={dash} />;
    if (activeTab === 'com-sugerencias') return <SugerenciasView dash={dash} />;
    if (activeTab === 'com-presentaciones') return <PresentacionesView dash={dash} />;
    if (activeTab === 'com-dinamicas') return <DinamicasView dash={dash} />;
    if (activeTab === 'crec-invitaciones') return <CrecInvitacionesView dash={dash} />;
    if (activeTab === 'crec-bump') return <CrecBumpView dash={dash} />;
    if (activeTab === 'crec-pagina') return <CrecPaginaView dash={dash} />;
    if (activeTab === 'crec-directos') return <CrecDirectosView dash={dash} />;
    if (activeTab === 'musica') return <MusicaView dash={dash} />;
    if (activeTab === 'voz-temporal') return <VozTemporalView dash={dash} />;
    if (activeTab === 'owner-subs') return <OwnerSubsView dash={dash} />;
    if (activeTab === 'datos-analitica') return <AnaliticaView dash={dash} />;
    if (activeTab === 'datos-resumen') return <ResumenView dash={dash} />;
    if (activeTab === 'config-app') return <AppMovilView />;
    if (activeTab.startsWith('logs-')) return <LogsView dash={dash} />;
    return <InicioView dash={dash} onBuscar={() => setBuscador(true)} onRequestUpgrade={setUpgradeFeature} />;
  };

  // Con el servidor en la clave, cada vista se monta de cero al cambiar de servidor
  // y no arrastra formularios a medio editar del anterior.
  const viewKey = `${guildId}:${activeTab === 'tickets-gestion' && ticketSeleccionado ? 'chat' : activeTab}`;

  // h-dvh y no h-screen: en el móvil 100vh es más alto que la parte visible
  // (por la barra del navegador) y lo de abajo quedaba fuera de la pantalla.
  return (
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
        <Header dash={dash} onOpenMenu={() => setMobileOpen(true)} onBuscar={() => setBuscador(true)} />

        <main ref={mainRef} className="flex-1 overflow-y-auto px-3 pb-10 pt-4 sm:px-4 sm:pt-5 lg:pl-4 lg:pr-5">
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
              {renderView()}
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

      <BuscadorPanel
        abierto={buscador}
        onCerrar={() => setBuscador(false)}
        irA={navigate}
        permisos={misPermisos}
        esPremium={esPremium}
        moduleStatus={estadoModulos}
        tickets={dash.ticketsReales}
        abrirTicket={(tk) => { navigate('tickets-gestion'); dash.verMensajes(tk); }}
        onRequestUpgrade={setUpgradeFeature}
      />

      <UpgradeModal
        feature={upgradeFeature}
        onClose={() => setUpgradeFeature(null)}
        onVerPlanes={() => { setUpgradeFeature(null); navigate('cuenta-plan'); }}
      />
    </div>
  );
}

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
