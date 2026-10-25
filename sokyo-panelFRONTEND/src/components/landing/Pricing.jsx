// Tabla de precios en cristal: el plan recomendado lleva borde de luz y halo.
// Textos vía i18n.
import { useTranslation } from 'react-i18next';
import { Check, Sparkles } from 'lucide-react';
import { inviteUrl } from '../../lib/landingConfig';
import Revelar from './Revelar';

const ORDEN = [
  { id: 'free', highlighted: false },
  { id: 'pro', highlighted: true },
  { id: 'agency', highlighted: false },
];

export default function Pricing() {
  const { t } = useTranslation();
  const tiers = t('landing.pricing.tiers', { returnObjects: true }) || {};

  return (
    <section id="pricing" className="lx-diferido relative mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.pricing.title')} <span className="lx-texto">{t('landing.pricing.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.pricing.subtitle')}</p>
        <p className="lx-etiqueta mt-5">{t('landing.pricing.trialNote')}</p>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 items-stretch gap-6 md:grid-cols-3">
        {ORDEN.map((o, i) => {
          const tier = tiers[o.id] || { features: [] };
          return (
            <Revelar key={o.id} retraso={i * 0.1} className={`flex ${o.highlighted ? 'md:-my-3' : ''}`}>
              <div className={`lx-card relative flex flex-1 flex-col p-8 ${o.highlighted ? 'lx-brillo lx-halo' : ''}`}>
                {o.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#d946ef] to-[#ec4899] px-3.5 py-1 text-xs font-bold text-white shadow-[0_0_24px_-4px_rgba(217,70,239,.9)]">
                      <Sparkles size={13} /> {t('landing.pricing.recommended')}
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-bold text-fg">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted">{tier.desc}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className={`text-5xl font-extrabold tracking-tight ${o.highlighted ? 'lx-texto' : 'text-fg'}`}>{tier.price}</span>
                  <span className="text-sm text-muted">{tier.period}</span>
                </div>

                <ul className="mt-7 flex flex-1 flex-col gap-3">
                  {(tier.features || []).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-fg/90">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${o.highlighted ? 'bg-gradient-to-br from-[#a855f7] to-[#ec4899] text-white' : 'bg-white/[.08] text-violet-300'}`}>
                        <Check size={13} strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <a href={inviteUrl} target="_blank" rel="noreferrer" className={`lx-btn mt-8 ${o.highlighted ? 'lx-btn-cuenta' : ''}`}>
                  {tier.cta}
                </a>
              </div>
            </Revelar>
          );
        })}
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted">{t('landing.pricing.reassurance')}</p>
    </section>
  );
}
