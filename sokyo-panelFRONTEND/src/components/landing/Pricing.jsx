// Tabla de precios. Textos vía i18n.
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Sparkles } from 'lucide-react';
import { inviteUrl } from '../../lib/landingConfig';

const ORDEN = [
  { id: 'free', highlighted: false },
  { id: 'pro', highlighted: true },
  { id: 'agency', highlighted: false },
];

export default function Pricing() {
  const { t } = useTranslation();
  const tiers = t('landing.pricing.tiers', { returnObjects: true });

  return (
    <section id="pricing" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.pricing.title')} <span className="text-gradient-brand">{t('landing.pricing.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.pricing.subtitle')}</p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand">
          {t('landing.pricing.trialNote')}
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
        {ORDEN.map((o, i) => {
          const tier = tiers[o.id];
          return (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative flex flex-col rounded-3xl border p-8 ${
                o.highlighted ? 'border-brand/50 bg-card shadow-2xl shadow-brand/20' : 'border-line bg-card/60'
              }`}
            >
              {o.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1 text-xs font-bold text-on-brand shadow-lg">
                    <Sparkles size={13} /> {t('landing.pricing.recommended')}
                  </span>
                </div>
              )}
              <h3 className="text-lg font-bold text-fg">{tier.name}</h3>
              <p className="mt-1 text-sm text-muted">{tier.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold tracking-tight text-fg">{tier.price}</span>
                <span className="text-sm text-muted">{tier.period}</span>
              </div>

              <ul className="mt-7 flex flex-1 flex-col gap-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-fg/90">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${o.highlighted ? 'bg-gradient-brand text-on-brand' : 'bg-elevated text-brand'}`}>
                      <Check size={13} strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={inviteUrl}
                target="_blank" rel="noreferrer"
                className={`mt-8 flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] ${
                  o.highlighted ? 'bg-gradient-brand text-on-brand glow-brand' : 'border border-line bg-elevated text-fg'
                }`}
              >
                {tier.cta}
              </a>
            </motion.div>
          );
        })}
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted">
        {t('landing.pricing.reassurance')}
      </p>
    </section>
  );
}
