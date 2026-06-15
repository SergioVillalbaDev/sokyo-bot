// Landing page completa — compone todas las secciones.
// Usa siempre el tema oscuro "Midnight" para máxima conversión.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from './Navbar';
import Hero from './Hero';
import Stats from './Stats';
import Features from './Features';
import Steps from './Steps';
import Pricing from './Pricing';
import Footer from './Footer';
import { inviteUrl } from '../../lib/landingConfig';

export default function Landing({ onEnterDashboard }) {
  const { t } = useTranslation();
  useEffect(() => {
    // La landing mantiene su identidad "Acid" (lima) independientemente del
    // tema elegido en el panel.
    document.documentElement.setAttribute('data-theme', 'lima');
  }, []);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <Navbar onEnterDashboard={onEnterDashboard} />
      <main>
        <Hero onEnterDashboard={onEnterDashboard} />
        <Stats />
        <Features />
        <Steps />
        <Pricing />

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-card px-8 py-16 text-center">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.2] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
            <div className="pointer-events-none absolute -top-24 left-1/2 h-60 w-[600px] -translate-x-1/2 rounded-full bg-brand/25 blur-[120px]" />
            <h2 className="relative text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
              {t('landing.finalCta.title')}
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-muted">
              {t('landing.finalCta.subtitle')}
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={inviteUrl}
                target="_blank" rel="noreferrer"
                className="rounded-xl bg-[#5865F2] hover:bg-[#4752C4] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#5865F2]/40 transition-transform hover:scale-[1.03]"
              >
                {t('landing.finalCta.primary')}
              </a>
              <button
                onClick={onEnterDashboard}
                className="rounded-xl border border-line bg-card px-8 py-3.5 text-base font-semibold text-fg transition-colors hover:bg-elevated"
              >
                {t('landing.finalCta.secondary')}
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
