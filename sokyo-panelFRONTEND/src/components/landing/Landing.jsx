// Landing page completa — compone todas las secciones con el estilo cristal
// (src/landing.css): el mismo lenguaje visual que el panel y «Mi cuenta».
// Orden pensado para vender y para que nadie se pierda: qué es (hero), por
// dónde entra cada uno (admin / miembro), qué hace, cómo entra cada miembro a
// su cuenta, cómo se empieza, comparativa, precios, dudas y CTA final.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CircleUserRound, LayoutDashboard } from 'lucide-react';
import FondoLanding from './FondoLanding';
import Navbar from './Navbar';
import Hero from './Hero';
import Caminos from './Caminos';
import Stats from './Stats';
import Features from './Features';
import MiCuentaDemo from './MiCuentaDemo';
import Steps from './Steps';
import Comparison from './Comparison';
import Pricing from './Pricing';
import Faq from './Faq';
import Footer from './Footer';
import { inviteUrl, URL_CUENTA } from '../../lib/landingConfig';
import '../../landing.css';

export default function Landing({ onEnterDashboard }) {
  const { t } = useTranslation();
  const raiz = useRef(null);
  // Las secciones de abajo no se pintan hasta que se acercan (lx-diferido): con
  // ellas sin pintar el navegador calcularía mal dónde cae un enlace interno
  // (#pricing, #mi-cuenta…). Al pulsar uno, se pintan todas antes del salto.
  const alPulsar = (e) => { if (e.target.closest?.('a[href^="#"]')) raiz.current?.classList.add('lx-listo'); };
  useEffect(() => {
    // Los colores de texto y acento salen del tema Aurora (clave "lima"), el de
    // los colores del avatar; el fondo y el cristal los pone landing.css.
    document.documentElement.setAttribute('data-theme', 'lima');
    // Enlace directo a una sección (p. ej. sokyo.studio/#pricing): al cargar,
    // la sección aún no existía cuando el navegador buscó el ancla.
    const seccion = window.location.hash.length > 1 && document.getElementById(window.location.hash.slice(1));
    if (seccion) {
      raiz.current?.classList.add('lx-listo');
      setTimeout(() => seccion.scrollIntoView({ block: 'start' }), 50);
    }
  }, []);

  return (
    <div ref={raiz} className="lx" onClickCapture={alPulsar}>
      <FondoLanding />
      <Navbar onEnterDashboard={onEnterDashboard} />
      <main>
        <Hero onEnterDashboard={onEnterDashboard} />
        <Caminos onEnterDashboard={onEnterDashboard} />
        <Stats />
        <Features />
        <MiCuentaDemo />
        <Steps />
        <Comparison />
        <Pricing />
        <Faq />

        {/* CTA final: las dos entradas, otra vez, para quien ha llegado hasta aquí */}
        <section className="lx-diferido mx-auto max-w-7xl px-5 py-20 sm:px-6">
          <div className="lx-card lx-brillo lx-halo relative overflow-hidden px-6 py-16 text-center sm:px-8">
            <div className="sk-halo pointer-events-none absolute -top-24 left-1/2 h-60 w-[640px] max-w-full -translate-x-1/2" style={{ '--halo': 'rgba(168, 85, 247, .35)' }} />
            <img src="/assets/logo-160.webp" alt="" width="72" height="72" loading="lazy" className="lx-aro relative mx-auto h-[72px] w-[72px] object-cover" />
            <h2 className="relative mt-6 text-3xl font-extrabold tracking-tight text-fg sm:text-5xl">
              {t('landing.finalCta.title')} <span className="lx-texto">{t('landing.finalCta.titleHighlight')}</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-muted sm:text-lg">{t('landing.finalCta.subtitle')}</p>
            <div className="relative mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <a href={inviteUrl} target="_blank" rel="noreferrer" className="lx-btn lx-btn-discord px-8 py-4 text-base"><Plus size={19} /> {t('landing.finalCta.primary')}</a>
              <a href={URL_CUENTA} className="lx-btn lx-btn-neon px-8 py-4 text-base"><CircleUserRound size={19} /> {t('landing.finalCta.account')}</a>
            </div>
            <button onClick={onEnterDashboard} className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg">
              <LayoutDashboard size={15} /> {t('landing.finalCta.secondary')}
            </button>
          </div>
        </section>
      </main>
      <Footer onEnterDashboard={onEnterDashboard} />
    </div>
  );
}
