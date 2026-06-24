// Header superior del dashboard — saludo + buscador + idioma + tema.
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Bell, HelpCircle, Menu, ChevronDown } from 'lucide-react';
import { metaKey } from './navConfig';
import { startOnboarding } from '../../lib/onboarding';
import OwnerBadge from './OwnerBadge';
import ThemePicker from './ThemePicker';
import LanguageSwitcher from '../LanguageSwitcher';
import { Avatar } from '../ui/primitives';

export default function Header({ dash, onOpenMenu }) {
  const { t } = useTranslation();
  const { activeTab, theme, setTheme, esPremium, servidorInfo, query, setQuery, ticketsReales, servidores, guildId, setMostrarSelectorServidor } = dash;
  // Servidor activo: visible siempre (también en móvil) para no perderse de cuál
  // se está gestionando. Si hay varios, al pulsarlo se abre el selector.
  const servActivo = (servidores || []).find((s) => s.id === guildId);
  const variosServidores = (servidores || []).length > 1;
  const ticketsAbiertos = ticketsReales.filter((tk) => tk.estado !== 'Cerrado').length;
  const enInicio = activeTab === 'inicio';
  const mk = metaKey(activeTab);

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-line bg-bg/80 px-6 py-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="flex items-center gap-3">
        {/* Abrir menú (solo móvil) */}
        <button
          onClick={onOpenMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-fg transition-colors hover:bg-elevated lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>

        <motion.div key={activeTab} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {enInicio ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-fg sm:text-[1.7rem]">
              {t('dashboard.header.greeting', { name: servidorInfo?.nombre || 'servidor' })}
            </h1>
            <p className="mt-0.5 text-sm text-muted">{t('dashboard.header.greetingSub')}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-fg">{t(`dashboard.meta.${mk}.title`)}</h1>
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

        <div className="relative hidden md:block">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dashboard.header.search')}
            className="w-52 rounded-full border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-fg outline-none transition-all focus:w-64 focus:ring-2 focus:ring-brand/30"
          />
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

        <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-fg transition-colors hover:bg-elevated" aria-label="Notificaciones">
          <Bell size={17} />
          {ticketsAbiertos > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {ticketsAbiertos}
            </span>
          )}
        </button>

        <div data-tour="tools" className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemePicker theme={theme} setTheme={setTheme} esPremium={esPremium} />
        </div>
      </div>
    </header>
  );
}
