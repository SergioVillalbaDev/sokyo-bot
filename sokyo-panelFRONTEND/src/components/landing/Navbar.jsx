// Barra de navegación de la landing — sticky, con barra de anuncio superior.
// Textos vía i18n (src/i18n/locales/*).
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Plus, ArrowRight, UserCircle, Menu, X } from 'lucide-react';
import { inviteUrl } from '../../lib/landingConfig';
import LanguageSwitcher from '../LanguageSwitcher';

const LINKS = [
  { key: 'features', href: '#features' },
  { key: 'pricing', href: '#pricing' },
  { key: 'panel', href: '#dashboard', dashboard: true },
];

export default function Navbar({ onEnterDashboard }) {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <a
        href="#features"
        className="group flex items-center justify-center gap-2 bg-gradient-brand px-4 py-2 text-center text-xs font-semibold text-on-brand sm:text-sm"
      >
        {t('landing.nav.announcement')}
        <span className="inline-flex items-center gap-1 font-semibold underline-offset-2 group-hover:underline">
          {t('landing.nav.announcementCta')} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </a>

      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          scrolled ? 'border-b border-line bg-bg/80 backdrop-blur-xl' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"
        >
          <a href="#top" className="flex items-center gap-2.5">
            {/* // TODO: DESIGN TEAM — logo oficial. Sustituir /assets/logo-placeholder.svg */}
            <img src="/assets/logo-placeholder.svg" alt="Sokyo" className="h-9 w-9" />
            <span className="text-lg font-extrabold tracking-tight text-fg">{t('landing.nav.brand')}</span>
          </a>

          <div className="hidden items-center gap-1 rounded-full border border-line bg-card/60 px-1.5 py-1 backdrop-blur md:flex">
            {LINKS.map((l) => (
              <a
                key={l.key}
                href={l.href}
                onClick={l.dashboard ? onEnterDashboard : undefined}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
              >
                {t(`landing.nav.links.${l.key}`)}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a
              href="/?portal=1"
              className="hidden items-center gap-1.5 rounded-lg border border-line bg-card/60 px-3.5 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated sm:flex"
            >
              <UserCircle size={16} /> {t('landing.nav.accountBtn')}
            </a>
            <button
              onClick={onEnterDashboard}
              className="hidden items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-muted transition-colors hover:text-fg lg:flex"
            >
              <LayoutDashboard size={16} /> {t('landing.nav.panelBtn')}
            </button>
            <a
              href={inviteUrl}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#5865F2]/40 transition-transform hover:scale-[1.03]"
            >
              <Plus size={16} /> {t('landing.nav.cta')}
            </a>

            {/* Botón de menú (solo móvil) */}
            <button
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label="Menú"
              aria-expanded={menuAbierto}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card/60 text-fg transition-colors hover:bg-elevated md:hidden"
            >
              {menuAbierto ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </motion.nav>

        {/* Menú desplegable (solo móvil) */}
        <AnimatePresence>
          {menuAbierto && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-line bg-bg/95 backdrop-blur-xl md:hidden"
            >
              <div className="flex flex-col gap-1 px-6 py-4">
                {LINKS.map((l) => (
                  <a
                    key={l.key}
                    href={l.href}
                    onClick={(e) => { if (l.dashboard) onEnterDashboard(e); setMenuAbierto(false); }}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
                  >
                    {t(`landing.nav.links.${l.key}`)}
                  </a>
                ))}
                <a
                  href="/?portal=1"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
                >
                  <UserCircle size={16} /> {t('landing.nav.accountBtn')}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
