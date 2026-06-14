// Header superior del dashboard — saludo + buscador + selector de temas.
import { motion } from 'framer-motion';
import { Search, Bell } from 'lucide-react';
import { metaForTab } from './navConfig';
import ThemePicker from './ThemePicker';

export default function Header({ dash }) {
  const { activeTab, theme, setTheme, esPremium, servidorInfo, query, setQuery, ticketsReales } = dash;
  const meta = metaForTab(activeTab);
  const ticketsAbiertos = ticketsReales.filter((t) => t.estado !== 'Cerrado').length;
  const enInicio = activeTab === 'inicio';

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-line bg-bg/80 px-6 py-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <motion.div key={activeTab} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {enInicio ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-[1.7rem]">
              ¡Hola, <span className="text-gradient-brand">{servidorInfo?.nombre || 'servidor'}</span>! 👋
            </h1>
            <p className="mt-0.5 text-sm text-muted">Este es el estado de tu sistema de soporte hoy.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-fg">{meta.title}</h1>
            <p className="mt-0.5 text-sm text-muted">{meta.subtitle}</p>
          </>
        )}
      </motion.div>

      <div className="flex items-center gap-3">
        {/* Buscador (filtra la rejilla de tickets) */}
        <div className="relative hidden md:block">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tickets..."
            className="w-52 rounded-full border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-fg outline-none transition-all focus:w-64 focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {/* Campana con nº de tickets abiertos */}
        <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-fg transition-colors hover:bg-elevated" aria-label="Notificaciones">
          <Bell size={17} />
          {ticketsAbiertos > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {ticketsAbiertos}
            </span>
          )}
        </button>

        <ThemePicker theme={theme} setTheme={setTheme} esPremium={esPremium} />
      </div>
    </header>
  );
}
