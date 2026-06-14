// Contenedor del Dashboard — une el layout (Sidebar + Header) con las vistas.
// Toda la lógica vive en useDashboard(); aquí solo se decide QUÉ vista mostrar.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboard';
import Sidebar from './Sidebar';
import Header from './Header';
import InicioView from './views/InicioView';
import TicketsView from './views/TicketsView';
import ChatView from './views/ChatView';
import UsersView from './views/UsersView';
import TextsView from './views/TextsView';
import IncidentsView from './views/IncidentsView';
import LogsView from './views/LogsView';
import ModulesView from './views/ModulesView';

export default function Dashboard({ onExitToLanding }) {
  const dash = useDashboard();
  const { activeTab, ticketSeleccionado, setTicketSeleccionado, setActiveTab, errorConexion, servidorInfo, esPremium } = dash;

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sokyoSidebarCollapsed') === '1');
  const toggleCollapsed = (value) => {
    const next = typeof value === 'function' ? value(collapsed) : value;
    setCollapsed(next);
    localStorage.setItem('sokyoSidebarCollapsed', next ? '1' : '0');
  };

  // Navegación desde el sidebar: al ir a "Gestión" cerramos el chat abierto.
  const navigate = (tab) => {
    if (tab === 'tickets-gestion') setTicketSeleccionado(null);
    setActiveTab(tab);
  };

  const renderView = () => {
    if (activeTab === 'inicio') return <InicioView dash={dash} />;
    if (activeTab === 'tickets-gestion') return ticketSeleccionado ? <ChatView dash={dash} /> : <TicketsView dash={dash} />;
    if (activeTab === 'tickets-usuarios') return <UsersView dash={dash} />;
    if (activeTab === 'tickets-config') return <IncidentsView dash={dash} />;
    if (activeTab === 'config-textos') return <TextsView dash={dash} />;
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
        onExitToLanding={onExitToLanding}
        servidorInfo={servidorInfo}
        esPremium={esPremium}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header dash={dash} />

        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          {errorConexion && (
            <div className="mb-6 rounded-2xl border border-danger/40 bg-danger/10 p-5">
              <p className="flex items-center gap-2 font-semibold text-danger">
                <AlertTriangle size={18} /> {errorConexion}
              </p>
              <p className="mt-1.5 text-sm text-danger/80">
                Revisa que el bot esté encendido, que VITE_API_URL apunte a la dirección correcta y que las claves
                coincidan. (Abre la consola con F12 para más detalles.)
              </p>
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
    </div>
  );
}
