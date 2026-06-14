// Barra de navegación de la landing — sticky, con barra de anuncio superior.
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Plus, ArrowRight } from 'lucide-react';

export default function Navbar({ onEnterDashboard }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Funciones', href: '#features' },
    { label: 'Precios', href: '#pricing' },
    { label: 'Panel', href: '#dashboard', onClick: onEnterDashboard },
  ];

  return (
    <>
      {/* Barra de anuncio */}
      <a
        href="#features"
        className="group flex items-center justify-center gap-2 bg-gradient-brand px-4 py-2 text-center text-xs font-semibold text-on-brand sm:text-sm"
      >
        🎉 Sokyo Pro ya disponible · auditoría ampliada y marca blanca
        <span className="inline-flex items-center gap-1 font-semibold underline-offset-2 group-hover:underline">
          Descúbrelo <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </a>

      {/* Navegación */}
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
            <span className="text-lg font-extrabold tracking-tight text-fg">
              Sokyo<span className="text-gradient-brand"> Bot</span>
            </span>
          </a>

          <div className="hidden items-center gap-1 rounded-full border border-line bg-card/60 px-1.5 py-1 backdrop-blur md:flex">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={l.onClick}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onEnterDashboard}
              className="hidden items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-muted transition-colors hover:text-fg sm:flex"
            >
              <LayoutDashboard size={16} /> Panel
            </button>
            {/* // TODO: DESIGN TEAM — enlace de invitación real del bot */}
            <a
              href="https://discord.com/oauth2/authorize"
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand glow-brand transition-transform hover:scale-[1.03]"
            >
              <Plus size={16} /> Añadir a Discord
            </a>
          </div>
        </motion.nav>
      </header>
    </>
  );
}
