// Parte de abajo de la landing (de las cifras al CTA final) y el pie. Va en una
// descarga aparte que llega después de pintar lo de arriba (hero y las dos
// entradas): así el móvil enseña antes la portada. Textos vía i18n.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CircleUserRound, LayoutDashboard } from 'lucide-react';
import Stats from './Stats';
import Tour from './Tour';
import Features from './Features';
import Mapa from './Mapa';
import MiCuentaDemo from './MiCuentaDemo';
import AppMovil from './AppMovil';
import Seguridad from './Seguridad';
import Steps from './Steps';
import Comparison from './Comparison';
import Pricing from './Pricing';
import Faq from './Faq';
import { EnlacePanel } from './Marcos';
import { inviteUrl, URL_CUENTA } from '../../lib/landingConfig';

export { default as Pie } from './Footer';

// alCargar: avisa a Landing de que las secciones ya existen (enlace directo a una de ellas).
export default function LandingResto({ onEnterDashboard, alCargar }) {
  const { t } = useTranslation();
  useEffect(() => { alCargar?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Stats />
      <Tour onEnterDashboard={onEnterDashboard} />
      <Features />
      <Mapa />
      <MiCuentaDemo />
      <AppMovil />
      <Seguridad />
      <Steps />
      <Comparison />
      <Pricing />
      <Faq />

      {/* CTA final: añadir el bot y las dos entradas, otra vez, para quien ha llegado hasta aquí */}
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
            <EnlacePanel onEnterDashboard={onEnterDashboard} className="lx-btn lx-btn-panel px-8 py-4 text-base"><LayoutDashboard size={19} /> {t('landing.finalCta.secondary')}</EnlacePanel>
          </div>
          <a href={URL_CUENTA} className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg">
            <CircleUserRound size={15} className="text-fuchsia-300" /> {t('landing.finalCta.account')}
          </a>
        </div>
      </section>
    </>
  );
}
