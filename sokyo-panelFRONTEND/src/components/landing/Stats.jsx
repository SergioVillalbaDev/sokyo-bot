// Banda de estadísticas con contadores animados. Textos vía i18n.
import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { statsAccent } from '../../lib/landingConfig';

function Counter({ to, decimals = 0, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf;
    const start = performance.now();
    const dur = 1500;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return (
    <span ref={ref}>
      {prefix}{val.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

export default function Stats() {
  const { t } = useTranslation();
  const stats = t('landing.stats', { returnObjects: true });

  return (
    <section className="relative mx-auto max-w-7xl px-6 py-12">
      <div className="grid grid-cols-2 gap-4 rounded-3xl border border-line bg-card/60 p-8 backdrop-blur md:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className="text-center">
            <div className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${statsAccent[i] || 'text-brand'}`}>
              <Counter to={s.to} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} />
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
