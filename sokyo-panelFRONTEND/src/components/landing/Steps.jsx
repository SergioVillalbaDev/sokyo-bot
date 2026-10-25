// Sección "Cómo funciona" (para quien gestiona un servidor). Textos vía i18n.
import { useTranslation } from 'react-i18next';
import { Plus, Wand2, Rocket } from 'lucide-react';
import Revelar from './Revelar';

const ORDEN = [
  { id: 'add', Icon: Plus, color: '#60a5fa' },
  { id: 'config', Icon: Wand2, color: '#a855f7' },
  { id: 'support', Icon: Rocket, color: '#ec4899' },
];

export default function Steps() {
  const { t } = useTranslation();
  const items = t('landing.steps.items', { returnObjects: true }) || {};

  return (
    <section className="lx-diferido relative mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="lx-etiqueta">{t('landing.steps.eyebrow')}</span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.steps.title')} <span className="lx-texto">{t('landing.steps.titleHighlight')}</span>
        </h2>
      </div>

      <div className="relative mt-16 grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Hilo de luz que une los tres pasos */}
        <div className="pointer-events-none absolute left-[16%] right-[16%] top-12 hidden h-px bg-gradient-to-r from-sky-300/0 via-violet-400/60 to-pink-400/0 md:block" />
        {ORDEN.map((s, i) => {
          const item = items[s.id] || { title: '', desc: '' };
          return (
            <Revelar key={s.id} retraso={i * 0.12} className="flex">
              <div className="lx-card flex flex-1 flex-col items-center p-7 text-center">
                <span className="lx-orbe relative h-14 w-14" style={{ '--orbe': s.color }}>
                  <s.Icon size={24} />
                  <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-[#0d0b1c] bg-white text-xs font-extrabold text-[#0d0b1c]">{i + 1}</span>
                </span>
                <h3 className="mt-5 text-lg font-bold text-fg">{item.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{item.desc}</p>
              </div>
            </Revelar>
          );
        })}
      </div>
    </section>
  );
}
