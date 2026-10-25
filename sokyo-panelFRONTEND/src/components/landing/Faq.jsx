// Preguntas frecuentes — resuelve las objeciones típicas antes del CTA final
// (¿sé programar?, ¿cómo entran mis miembros?, ¿gratis?, ¿y si cancelo?). Acordeón de cristal.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

export default function Faq() {
  const { t } = useTranslation();
  const items = t('landing.faq.items', { returnObjects: true });
  const lista = Array.isArray(items) ? items : [];
  const [abierto, setAbierto] = useState(0);

  return (
    <section id="faq" className="lx-diferido relative mx-auto max-w-3xl px-5 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.faq.title')} <span className="lx-texto">{t('landing.faq.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.faq.subtitle')}</p>
      </div>

      <div className="mt-12 flex flex-col gap-3">
        {lista.map((item, i) => {
          const open = abierto === i;
          return (
            <div key={item.q} className={`lx-card overflow-hidden rounded-2xl transition-shadow ${open ? 'lx-halo' : ''}`}>
              <button
                onClick={() => setAbierto(open ? -1 : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-fg sm:text-base">{item.q}</span>
                <ChevronDown size={18} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180 text-violet-300' : ''}`} />
              </button>
              <div className={`sk-plegable ${open ? 'sk-abierto' : ''}`} aria-hidden={!open}>
                <div>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
