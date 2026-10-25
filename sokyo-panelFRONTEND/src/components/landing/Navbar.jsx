// Barra de navegación de la landing: al hacer scroll se convierte en una
// cápsula de cristal flotante. «Mi cuenta» (la web de cada miembro) está siempre
// a la vista, también en el móvil. Textos vía i18n (src/i18n/locales/*).
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Plus, CircleUserRound, Menu, X } from 'lucide-react';
import { inviteUrl, URL_CUENTA } from '../../lib/landingConfig';
import LanguageSwitcher from '../LanguageSwitcher';
import { IDIOMAS, cambiarIdioma } from '../../i18n';

const LINKS = [
  { key: 'features', href: '#features' },
  { key: 'account', href: '#mi-cuenta' },
  { key: 'pricing', href: '#pricing' },
  { key: 'faq', href: '#faq' },
  { key: 'servers', href: '/servidores' }, // directorio de servidores (página aparte)
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
  const flotante = scrolled || menuAbierto;

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
      <div className={`lx-nav mx-auto max-w-7xl rounded-[22px] ${flotante ? 'lx-nav-flotante' : ''}`}>
        <nav style={{ '--i': 0 }} className="sk-entra flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
          <a href="#top" onClick={(e) => irA(e, { href: '#top' })} className="flex shrink-0 items-center gap-2.5">
            <span className="lx-aro"><img src="/assets/logo-96.webp" alt="Sokyo" width="34" height="34" className="h-[34px] w-[34px] object-cover" /></span>
            <span className="hidden whitespace-nowrap text-lg font-extrabold tracking-tight text-fg min-[380px]:inline">{t('landing.nav.brand')}</span>
          </a>

          <div className="hidden items-center gap-0.5 lg:flex">
            {LINKS.map((l) => (
              <a key={l.key} href={l.href} onClick={(e) => irA(e, l)}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/[.06] hover:text-fg">
                {t(`landing.nav.links.${l.key}`)}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* En el móvil el idioma va dentro del menú: así caben «Mi cuenta» y «Añadir». */}
            <LanguageSwitcher className="hidden sm:block" />
            <button onClick={onEnterDashboard} className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-muted transition-colors hover:text-fg xl:flex">
              <LayoutDashboard size={16} /> {t('landing.nav.panelBtn')}
            </button>
            <a href={URL_CUENTA} title={t('landing.nav.accountBtn')} aria-label={t('landing.nav.accountBtn')}
              className="lx-btn lx-btn-cuenta px-2.5 py-2 text-sm sm:px-3.5">
              <CircleUserRound size={17} /> <span className="hidden sm:inline">{t('landing.nav.accountBtn')}</span>
            </a>
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="lx-btn lx-btn-discord px-3 py-2 text-sm sm:px-4">
              {/* En el móvil el texto corto: el largo partía la cabecera en dos líneas. */}
              <Plus size={16} /> <span className="sm:hidden">{t('landing.nav.ctaShort')}</span><span className="hidden sm:inline">{t('landing.nav.cta')}</span>
            </a>
            <button
              onClick={() => setMenuAbierto((v) => !v)} aria-label="Menu" aria-expanded={menuAbierto}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] text-fg transition-colors hover:bg-white/10 lg:hidden"
            >
              {menuAbierto ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Menú desplegable (móvil y tablet). Siempre montado y plegado con CSS; cerrado es inerte. */}
        <div className={`sk-plegable lg:hidden ${menuAbierto ? 'sk-abierto' : ''}`} inert={!menuAbierto}>
          <div>
            <div className="flex flex-col gap-1 border-t border-white/10 px-3 pb-4 pt-3">
              {LINKS.map((l) => (
                <a key={l.key} href={l.href} onClick={(e) => irA(e, l)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/[.06] hover:text-fg">
                  {t(`landing.nav.links.${l.key}`)}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <a href={URL_CUENTA} className="lx-btn lx-btn-cuenta px-3 text-sm"><CircleUserRound size={16} /> {t('landing.nav.accountBtn')}</a>
                <button onClick={(e) => { setMenuAbierto(false); onEnterDashboard(e); }} className="lx-btn px-3 text-sm"><LayoutDashboard size={16} /> {t('landing.nav.panelBtn')}</button>
              </div>
              <div className="mt-2 flex gap-2 border-t border-white/10 px-1 pt-3">
                {IDIOMAS.map((idioma) => (
                  <button key={idioma.code} onClick={() => cambiarIdioma(idioma.code)}
                    className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${i18n.language === idioma.code ? 'border-violet-300/40 bg-white/10 text-fg' : 'border-white/10 text-muted hover:text-fg'}`}>
                    {idioma.flag} {idioma.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
