// Contenedor del Dashboard — une el layout (Sidebar + Header) con las vistas.
// Toda la lógica vive en useDashboard(); aquí solo se decide QUÉ vista mostrar.
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import { maybeStartOnboarding } from '../../lib/onboarding';
import Sidebar from './Sidebar';
import Header from './Header';
import ServerPicker from './ServerPicker';
import UpgradeModal from './UpgradeModal';
import InicioView from './views/InicioView';
import TicketsView from './views/TicketsView';
import ChatView from './views/ChatView';
import UsersView from './views/UsersView';
import TextsView from './views/TextsView';
import ComportamientoView from './views/ComportamientoView';
import RulesView from './views/RulesView';
import MacrosView from './views/MacrosView';
import IncidentsView from './views/IncidentsView';
import LogsView from './views/LogsView';
import ModulesView from './views/ModulesView';
import RolesView from './views/RolesView';
import AutoRolView from './views/AutoRolView';
import PanelesView from './views/PanelesView';
import CentroMandoView from './views/CentroMandoView';
import TiposSancionView from './views/TiposSancionView';
import RegistroSancionesView from './views/RegistroSancionesView';
import AutomodView from './views/AutomodView';
import VerificacionView from './views/VerificacionView';
import EmbudoView from './views/EmbudoView';
import ReportesView from './views/ReportesView';
import BackupView from './views/BackupView';
import AccesoView from './views/AccesoView';
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
import IntegracionesView from './views/IntegracionesView';
import SorteosView from './views/SorteosView';
import EventosView from './views/EventosView';
import EncuestasView from './views/EncuestasView';
import SugerenciasView from './views/SugerenciasView';
import PresentacionesView from './views/PresentacionesView';
import DinamicasView from './views/DinamicasView';

export default function Dashboard({ onExitToLanding, onLogout }) {
  const { t } = useTranslation();
  const dash = useDashboard();
  const { activeTab, ticketSeleccionado, setTicketSeleccionado, setActiveTab, errorConexion, servidorInfo, esPremium, servidores, guildId, setGuildId, misPermisos, mostrarSelectorServidor, setMostrarSelectorServidor } = dash;

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sokyoSidebarCollapsed') === '1');
  const toggleCollapsed = (value) => {
    const next = typeof value === 'function' ? value(collapsed) : value;
    setCollapsed(next);
    localStorage.setItem('sokyoSidebarCollapsed', next ? '1' : '0');
  };

  // Menú lateral como "drawer" en móvil (en escritorio es fijo).
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Navegación desde el sidebar: al ir a "Gestión" cerramos el chat abierto.
  // En móvil, además cerramos el drawer al elegir una sección.
  const navigate = (tab) => {
    if (tab === 'tickets-gestion') setTicketSeleccionado(null);
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const renderView = () => {
    if (activeTab === 'inicio') return <InicioView dash={dash} />;
    if (activeTab === 'tickets-gestion') return ticketSeleccionado ? <ChatView dash={dash} /> : <TicketsView dash={dash} />;
    if (activeTab === 'tickets-usuarios') return <UsersView dash={dash} />;
    if (activeTab === 'tickets-config') return <IncidentsView dash={dash} />;
    if (activeTab === 'config-textos') return <TextsView dash={dash} />;
    if (activeTab === 'config-comportamiento') return <ComportamientoView dash={dash} />;
    if (activeTab === 'config-reglas') return <RulesView dash={dash} />;
    if (activeTab === 'config-macros') return <MacrosView dash={dash} />;
    if (activeTab === 'config-acceso') return <AccesoView dash={dash} />;
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
    if (activeTab === 'seg-embudo') return <EmbudoView dash={dash} />;
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
    if (activeTab === 'musica') return <MusicaView dash={dash} />;
    if (activeTab === 'voz-temporal') return <VozTemporalView dash={dash} />;
    if (activeTab === 'owner-subs') return <OwnerSubsView dash={dash} />;
    if (activeTab === 'datos-analitica') return <AnaliticaView dash={dash} />;
    if (activeTab === 'datos-resumen') return <ResumenView dash={dash} />;
    if (activeTab === 'config-webhooks') return <IntegracionesView dash={dash} />;
    if (activeTab === 'config') return <ModulesView />;
    if (activeTab.startsWith('logs-')) return <LogsView dash={dash} />;
    return <InicioView dash={dash} />;
  };

  const viewKey = activeTab === 'tickets-gestion' && ticketSeleccionado ? 'chat' : activeTab;

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-fg">
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
        setGuildId={setGuildId}
        permisos={misPermisos}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header dash={dash} onOpenMenu={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {errorConexion && (
            <div className="mb-6 rounded-2xl border border-danger/40 bg-danger/10 p-5">
              <p className="flex items-center gap-2 font-semibold text-danger">
                <AlertTriangle size={18} /> {errorConexion}
              </p>
              <p className="mt-1.5 text-sm text-danger/80">{t('dashboard.error.detail')}</p>
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
        </main>
      </div>

      <ServerPicker
        abierto={mostrarSelectorServidor && servidores.length > 1}
        servidores={servidores}
        guildId={guildId}
        onSeleccionar={setGuildId}
        onCerrar={() => setMostrarSelectorServidor(false)}
      />

      <UpgradeModal
        feature={upgradeFeature}
        onClose={() => setUpgradeFeature(null)}
        onVerPlanes={() => { setUpgradeFeature(null); navigate('cuenta-plan'); }}
      />
    </div>
  );
}
