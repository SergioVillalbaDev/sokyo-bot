// Barra de navegación de la landing: al hacer scroll se convierte en una
// cápsula de cristal flotante. Las dos entradas están siempre a la vista, también
// en el móvil: el panel de control (quien gestiona el servidor) y «Mi cuenta» (la
// web de cada miembro). El menú desplegable las repite en grande, con lo que hay
// en cada una. Textos vía i18n (src/i18n/locales/*).
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Plus, CircleUserRound, Menu, X, ChevronRight } from 'lucide-react';
import { inviteUrl, URL_CUENTA } from '../../lib/landingConfig';
import LanguageSwitcher from '../LanguageSwitcher';
import { IDIOMAS, cambiarIdioma } from '../../i18n';
import { EnlacePanel } from './Marcos';

// `menu`: solo en el menú desplegable (en la barra no caben; «Mi cuenta» ya
// tiene allí su botón).
const LINKS = [
  { key: 'panel', href: '#panel' },
  { key: 'features', href: '#features' },
  { key: 'account', href: '#mi-cuenta', menu: true },
  { key: 'app', href: '#app', menu: true },
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
            <span className="hidden whitespace-nowrap text-lg font-extrabold tracking-tight text-fg min-[400px]:inline">{t('landing.nav.brand')}</span>
          </a>

          <div className="hidden items-center gap-0.5 xl:flex">
            {LINKS.filter((l) => !l.menu).map((l) => (
              <a key={l.key} href={l.href} onClick={(e) => irA(e, l)}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/[.06] hover:text-fg">
                {t(`landing.nav.links.${l.key}`)}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* En el móvil el idioma va dentro del menú: así caben las dos entradas. */}
            <LanguageSwitcher className="hidden md:block" />
            <EnlacePanel onEnterDashboard={onEnterDashboard} title={t('landing.nav.panelBtn')}
              className="lx-btn lx-btn-panel px-3 py-2 text-sm sm:px-3.5">
              <LayoutDashboard size={16} /> <span className="lg:hidden">{t('landing.nav.panelShort')}</span><span className="hidden lg:inline">{t('landing.nav.panelBtn')}</span>
            </EnlacePanel>
            <a href={URL_CUENTA} title={t('landing.nav.accountBtn')} aria-label={t('landing.nav.accountBtn')}
              className="lx-btn px-2.5 py-2 text-sm sm:px-3.5">
              <CircleUserRound size={17} className="text-fuchsia-300" /> <span className="hidden sm:inline">{t('landing.nav.accountBtn')}</span>
            </a>
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="lx-btn lx-btn-discord hidden px-3 py-2 text-sm sm:inline-flex sm:px-4">
              <Plus size={16} /> <span className="lg:hidden">{t('landing.nav.ctaShort')}</span><span className="hidden lg:inline">{t('landing.nav.cta')}</span>
            </a>
            <button
              onClick={() => setMenuAbierto((v) => !v)} aria-label={t('landing.nav.menu')} aria-expanded={menuAbierto}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] text-fg transition-colors hover:bg-white/10 xl:hidden"
            >
              {menuAbierto ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Menú desplegable (móvil y tablet). Siempre montado y plegado con CSS; cerrado es inerte. */}
        <div className={`sk-plegable xl:hidden ${menuAbierto ? 'sk-abierto' : ''}`} inert={!menuAbierto}>
          <div>
            <div className="flex flex-col gap-1 border-t border-white/10 px-3 pb-4 pt-3">
              {/* Las dos entradas, en grande y con lo que hay en cada una. */}
              <div className="mb-2 grid gap-2 sm:grid-cols-2">
                <EnlacePanel onEnterDashboard={onEnterDashboard} onClick={() => setMenuAbierto(false)}
                  className="flex items-center gap-3 rounded-2xl border border-sky-200/20 bg-sky-200/[.07] p-3 transition-colors hover:bg-sky-200/[.12]">
                  <span className="lx-orbe h-10 w-10 rounded-xl" style={{ '--orbe': '#93c5fd' }}><LayoutDashboard size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-fg">{t('landing.nav.panelBtn')}</span>
                    <span className="block text-xs text-muted">{t('landing.nav.panelDesc')}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </EnlacePanel>
                <a href={URL_CUENTA} className="flex items-center gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-400/[.07] p-3 transition-colors hover:bg-fuchsia-400/[.12]">
                  <span className="lx-orbe h-10 w-10 rounded-xl" style={{ '--orbe': '#d946ef' }}><CircleUserRound size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-fg">{t('landing.nav.accountBtn')}</span>
                    <span className="block text-xs text-muted">{t('landing.nav.accountDesc')}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </a>
              </div>
              {LINKS.map((l) => (
                <a key={l.key} href={l.href} onClick={(e) => irA(e, l)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/[.06] hover:text-fg">
                  {t(`landing.nav.links.${l.key}`)}
                </a>
              ))}
              <a href={inviteUrl} target="_blank" rel="noreferrer" className="lx-btn lx-btn-discord mt-2 text-sm sm:hidden"><Plus size={16} /> {t('landing.nav.cta')}</a>
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
