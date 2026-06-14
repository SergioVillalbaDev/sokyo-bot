// Banda de estadísticas con contadores animados al entrar en viewport.
import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

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
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
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

// // TODO: DESIGN TEAM — sustituir por métricas reales del producto cuando existan.
const stats = [
  { to: 2400, suffix: '+', label: 'Servidores confían en Sokyo', accent: 'text-brand' },
  { to: 180000, suffix: '+', label: 'Tickets gestionados', accent: 'text-emerald-400' },
  { to: 99.9, decimals: 1, suffix: '%', label: 'Uptime garantizado', accent: 'text-lime-300' },
  { to: 60, prefix: '<', suffix: 's', label: 'Para ponerlo en marcha', accent: 'text-zinc-200' },
];

export default function Stats() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-12">
      <div className="grid grid-cols-2 gap-4 rounded-3xl border border-line bg-card/60 p-8 backdrop-blur md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${s.accent}`}>
              <Counter to={s.to} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} />
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
