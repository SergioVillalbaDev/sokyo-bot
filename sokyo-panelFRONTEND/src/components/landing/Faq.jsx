// Preguntas frecuentes — resuelve las objeciones típicas antes del CTA final
// (¿sé programar?, ¿mis datos?, ¿gratis?, ¿y si cancelo?). Acordeón simple.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

export default function Faq() {
  const { t } = useTranslation();
  const items = t('landing.faq.items', { returnObjects: true });
  const lista = Array.isArray(items) ? items : [];
  const [abierto, setAbierto] = useState(0);

  return (
    <section id="faq" className="relative mx-auto max-w-3xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.faq.title')} <span className="text-gradient-brand">{t('landing.faq.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.faq.subtitle')}</p>
      </div>

      <div className="mt-12 flex flex-col gap-3">
        {lista.map((item, i) => {
          const open = abierto === i;
          return (
            <div key={item.q} className="overflow-hidden rounded-2xl border border-line bg-card/60">
              <button
                onClick={() => setAbierto(open ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-fg sm:text-base">{item.q}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180 text-brand' : ''}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
