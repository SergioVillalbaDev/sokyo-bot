// Banda de estadísticas con contadores animados. Textos vía i18n.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { statsAccent } from '../../lib/landingConfig';
import { observar } from './observar';

// Cuenta de 0 al valor cuando se ve. Escribe el número directamente en el
// texto (sin renderizar React en cada fotograma: en el móvil se nota).
function Counter({ to, decimals = 0, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  const formato = (v) => `${prefix}${v.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    const animar = () => {
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / 1500);
        el.textContent = formato(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = formato(to);
      return undefined;
    }
    const dejar = observar(el, animar);
    return () => { dejar(); cancelAnimationFrame(raf); };
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={ref}>{formato(0)}</span>;
}

export default function Stats() {
  const { t } = useTranslation();
  const stats = t('landing.stats', { returnObjects: true });

  return (
    <section className="lx-diferido relative mx-auto max-w-7xl px-5 py-12 sm:px-6">
      <div className="lx-card lx-brillo grid grid-cols-2 gap-y-8 p-7 sm:p-9 md:grid-cols-4">
        {(Array.isArray(stats) ? stats : []).map((s, i) => (
          <div key={s.label} className={`px-2 text-center ${i % 2 ? 'border-l border-white/[.08]' : ''} ${i === 2 ? 'md:border-l' : ''}`}>
            <div className="text-3xl font-extrabold tracking-tight sm:text-5xl" style={{ color: statsAccent[i] || '#c4b5fd', textShadow: `0 0 28px ${statsAccent[i] || '#c4b5fd'}66` }}>
              <Counter to={s.to} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} />
            </div>
            <p className="mt-2 text-xs font-medium text-muted sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
