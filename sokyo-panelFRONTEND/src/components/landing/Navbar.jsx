// Barra de navegación de la landing — sticky, con barra de anuncio superior.
// Textos vía i18n (src/i18n/locales/*).
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Plus, UserCircle, Menu, X } from 'lucide-react';
import { inviteUrl } from '../../lib/landingConfig';
import LanguageSwitcher from '../LanguageSwitcher';
import { IDIOMAS, cambiarIdioma } from '../../i18n';

const LINKS = [
  { key: 'features', href: '#features' },
  { key: 'pricing', href: '#pricing' },
  { key: 'servers', href: '/servidores' }, // directorio de servidores (página aparte)
  { key: 'panel', href: '#dashboard', dashboard: true },
];

export default function Navbar({ onEnterDashboard }) {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Salto a una sección de la landing. Con el menú móvil abierto, el navegador
  // empezaba a desplazarse y el cierre del menú (que cambia la altura del
  // encabezado) lo cortaba: la página no se movía. Se cierra primero y se
  // desplaza después, a mano.
  const irA = (e, link) => {
    if (link.dashboard) { setMenuAbierto(false); onEnterDashboard(e); return; }
    if (!link.href.startsWith('#')) { setMenuAbierto(false); return; } // otra página: navegación normal
    const destino = document.querySelector(link.href);
    if (!destino) { setMenuAbierto(false); return; }
    e.preventDefault();
    const estabaAbierto = menuAbierto;
    setMenuAbierto(false);
    setTimeout(() => {
      destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', link.href);
    }, estabaAbierto ? 220 : 0);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          scrolled ? 'border-b border-line bg-bg/85 backdrop-blur-md sm:backdrop-blur-xl' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <nav
          style={{ '--i': 0 }}
          className="sk-entra mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-4 sm:px-6"
        >
          <a href="#top" onClick={(e) => irA(e, { href: '#top' })} className="flex shrink-0 items-center gap-2.5">
            <img src="/assets/logo-96.webp" alt="Sokyo" width="36" height="36" className="h-9 w-9 rounded-full object-cover" />
            <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-fg">{t('landing.nav.brand')}</span>
          </a>

          <div className="hidden items-center gap-1 rounded-full border border-line bg-card/60 px-1.5 py-1 backdrop-blur md:flex">
            {LINKS.map((l) => (
              <a
                key={l.key}
                href={l.href}
                onClick={(e) => irA(e, l)}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
              >
                {t(`landing.nav.links.${l.key}`)}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* En el móvil el idioma va dentro del menu: así cabe "Mi cuenta" en la barra. */}
            <LanguageSwitcher className="hidden sm:block" />
            {/* "Mi cuenta" de cada usuario: visible también en el móvil (solo el icono). */}
            <a
              href="/cuenta"
              title={t('landing.nav.accountBtn')}
              aria-label={t('landing.nav.accountBtn')}
              className="glow-brand flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-brand/40 bg-card/60 px-2.5 text-sm font-semibold text-fg transition-colors hover:bg-elevated sm:px-3.5"
            >
              <UserCircle size={17} className="text-brand" /> <span className="hidden sm:inline">{t('landing.nav.accountBtn')}</span>
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
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#5865F2] hover:bg-[#4752C4] px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-[#5865F2]/40 transition-transform hover:scale-[1.03] sm:px-4"
            >
              {/* En el móvil el texto corto: el largo partía la cabecera en dos líneas. */}
              <Plus size={16} /> <span className="sm:hidden">{t('landing.nav.ctaShort')}</span><span className="hidden sm:inline">{t('landing.nav.cta')}</span>
            </a>

            {/* Botón de menú (solo móvil) */}
            <button
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuAbierto}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card/60 text-fg transition-colors hover:bg-elevated md:hidden"
            >
              {menuAbierto ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Menú desplegable (solo móvil) */}
        {/* Siempre montado y plegado con CSS; cerrado es inerte (ni foco ni lectores). */}
        <div className={`sk-plegable bg-bg/95 md:hidden ${menuAbierto ? 'sk-abierto border-t border-line' : ''}`} inert={!menuAbierto}>
          <div>
              <div className="flex flex-col gap-1 px-6 py-4">
                {LINKS.map((l) => (
                  <a
                    key={l.key}
                    href={l.href}
                    onClick={(e) => irA(e, l)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
                  >
                    {t(`landing.nav.links.${l.key}`)}
                  </a>
                ))}
                <a
                  href="/cuenta"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
                >
                  <UserCircle size={16} /> {t('landing.nav.accountBtn')}
                </a>
                <div className="mt-1 flex gap-2 border-t border-line px-3 pt-3">
                  {IDIOMAS.map((idioma) => (
                    <button
                      key={idioma.code}
                      onClick={() => cambiarIdioma(idioma.code)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${i18n.language === idioma.code ? 'border-brand/50 bg-elevated text-fg' : 'border-line text-muted hover:text-fg'}`}
                    >
                      {idioma.flag} {idioma.label}
                    </button>
                  ))}
                </div>
              </div>
          </div>
        </div>
      </header>
    </>
  );
}
