// Sección de funciones — bento grid. Textos vía i18n.
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Ticket, ScrollText, ShieldCheck, SlidersHorizontal, Bot } from 'lucide-react';
import { prioridadBar, comandos } from '../../lib/landingConfig';

const tile = 'group relative overflow-hidden rounded-3xl border border-line bg-card p-6 transition-colors hover:border-brand/40';
const enter = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.06 } }),
};
const META = {
  tickets: { Icon: Ticket, color: 'var(--accent-color)' },
  audit: { Icon: ScrollText, color: '#fbbf24' },
  portal: { Icon: ShieldCheck, color: '#34d399' },
  brand: { Icon: SlidersHorizontal, color: '#d4d4d8' },
  bot: { Icon: Bot, color: '#34d399' },
};

function Tile({ id, items, className = '', children }) {
  const { Icon, color } = META[id];
  const item = items[id] || { title: '', desc: '' };
  return (
    <motion.article variants={enter} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className={`${tile} ${className}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}26`, color }}><Icon size={22} /></div>
      <h3 className="mt-5 text-lg font-bold text-fg">{item.title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{item.desc}</p>
      {children}
    </motion.article>
  );
}

export default function Features() {
  const { t } = useTranslation();
  const items = t('landing.features.items', { returnObjects: true });
  const prioridades = t('landing.features.prioridades', { returnObjects: true });
  const anchos = ['92%', '70%', '48%', '28%'];

  return (
    <section id="features" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-brand">
          {t('landing.features.eyebrow')}
        </span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.features.title')} <span className="text-gradient-brand">{t('landing.features.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.features.subtitle')}</p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[minmax(0,1fr)]">
        <Tile id="tickets" items={items} className="md:col-span-2 md:row-span-2">
          <div className="mt-6 space-y-2.5">
            {prioridades.map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-muted">{label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-elevated">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: anchos[i] }} viewport={{ once: true }} transition={{ duration: 0.9, ease: 'easeOut' }} className={`h-full rounded-full ${prioridadBar[i]}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/20 opacity-0 blur-3xl transition-opacity group-hover:opacity-100" />
        </Tile>

        <Tile id="audit" items={items}>
          <div className="mt-4 space-y-2">
            {['#e74c3c', '#f1c40f', '#2ecc71'].map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c }} />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${70 - i * 14}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 + i * 0.12 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: c }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Tile>

        <Tile id="portal" items={items} />
        <Tile id="brand" items={items} />

        <Tile id="bot" items={items} className="md:col-span-2">
          <div className="mt-5 flex flex-wrap gap-2">
            {comandos.map((c) => (
              <span key={c} className="rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-xs text-muted">{c}</span>
            ))}
          </div>
        </Tile>
      </div>
    </section>
  );
}
