// Fondo de la web: nebulosas y polvo de estrellas en CSS (landing.css) y unas
// estelas de luz en SVG, como en «Mi cuenta». Fijo detrás de todo: se pinta una
// vez. Las estelas solo se mecen en el ordenador; en el móvil, quietas y sin su
// halo difuminado (es lo que más cuesta pintar).
const ESTELAS = [
  { d: 'M-120 720 C 260 620, 600 700, 900 460 S 1300 110, 1580 40', g: 'lx-e1', w: 2.2 },
  { d: 'M-120 840 C 360 760, 700 830, 1010 600 S 1360 320, 1580 290', g: 'lx-e2', w: 1.7 },
  { d: 'M-100 150 C 280 240, 520 100, 820 200 S 1210 440, 1560 390', g: 'lx-e3', w: 1.3 },
];

export default function FondoLanding() {
  return (
    <div className="lx-fondo" aria-hidden="true">
      <svg className="lx-estelas" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="lx-e1" x1="0" x2="1"><stop offset="0" stopColor="#a855f7" stopOpacity="0" /><stop offset=".35" stopColor="#a855f7" /><stop offset=".7" stopColor="#ec4899" /><stop offset="1" stopColor="#ec4899" stopOpacity="0" /></linearGradient>
          <linearGradient id="lx-e2" x1="0" x2="1"><stop offset="0" stopColor="#60a5fa" stopOpacity="0" /><stop offset=".4" stopColor="#b4d8fc" /><stop offset=".75" stopColor="#22d3ee" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient>
          <linearGradient id="lx-e3" x1="0" x2="1"><stop offset="0" stopColor="#fb923c" stopOpacity="0" /><stop offset=".45" stopColor="#fb923c" /><stop offset=".8" stopColor="#ec4899" /><stop offset="1" stopColor="#ec4899" stopOpacity="0" /></linearGradient>
          <filter id="lx-difuso" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" /></filter>
        </defs>
        {ESTELAS.map((e) => (
          <g key={e.g}>
            <path className="lx-estela-halo" d={e.d} fill="none" stroke={`url(#${e.g})`} strokeWidth={e.w * 14} strokeLinecap="round" opacity=".22" filter="url(#lx-difuso)" />
            <path d={e.d} fill="none" stroke={`url(#${e.g})`} strokeWidth={e.w} strokeLinecap="round" opacity=".85" />
          </g>
        ))}
      </svg>
    </div>
  );
}
