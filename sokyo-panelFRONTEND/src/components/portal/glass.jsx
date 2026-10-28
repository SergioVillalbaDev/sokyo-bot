// Piezas visuales de "Mi cuenta": fondo de espacio, tarjetas de cristal,
// estados vacíos y avisos. Los estilos gx-* están en src/portal.css.
import { useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Sparkles, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { ligeroActivo } from '../../lib/ligero';

// Fondo: nebulosas de color, estelas de luz que se mecen despacio y polvo de
// estrellas (canvas). Todo lo que se mueve detrás del cristal obliga al
// navegador a volver a difuminarlo, así que se anima con mesura: a 30 fps en el
// ordenador y quieto en el móvil, sin pestaña visible o si se pide menos movimiento.
export function FondoEspacial() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;
    // En modo ligero (lib/ligero.js) también quieto: se pinta una vez y ya.
    const quieto = ligeroActivo() || !!window.matchMedia?.('(prefers-reduced-motion: reduce), (max-width: 640px), (pointer: coarse)').matches;
    const PASO = 1000 / 30;
    let ultimo = 0;
    const colores = ['255,255,255', '221,214,254', '249,168,212', '191,219,254', '254,215,170'];
    let ancho = 0, alto = 0, motas = [], raf = 0;

    const preparar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = canvas.clientWidth; alto = canvas.clientHeight;
      canvas.width = Math.round(ancho * dpr); canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(110, Math.max(36, (ancho * alto) / 14000)));
      motas = Array.from({ length: n }, () => ({
        x: Math.random() * ancho, y: Math.random() * alto,
        r: Math.random() * 1.4 + 0.3,
        vx: (Math.random() - 0.5) * 0.06, vy: -(Math.random() * 0.1 + 0.015),
        a: Math.random() * 0.55 + 0.25, fase: Math.random() * Math.PI * 2,
        c: colores[Math.floor(Math.random() * colores.length)],
        bokeh: Math.random() < 0.09,
      }));
    };

    const pintar = (tiempo = 0) => {
      if (!quieto) {
        raf = requestAnimationFrame(pintar);
        if (tiempo - ultimo < PASO) return;
        ultimo = tiempo;
      }
      ctx.clearRect(0, 0, ancho, alto);
      for (const p of motas) {
        if (!quieto) {
          p.x += p.vx; p.y += p.vy;
          if (p.y < -20) { p.y = alto + 20; p.x = Math.random() * ancho; }
          if (p.x < -20) p.x = ancho + 20; else if (p.x > ancho + 20) p.x = -20;
        }
        const luz = p.a * (0.65 + 0.35 * Math.sin(tiempo / 1100 + p.fase));
        if (p.bokeh) {
          const radio = p.r * 9;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radio);
          g.addColorStop(0, `rgba(${p.c},${luz * 0.35})`);
          g.addColorStop(1, `rgba(${p.c},0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, radio, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${p.c},${luz})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
      }
    };

    const alCambiarTamano = () => { preparar(); if (quieto) pintar(); };
    const alCambiarVisibilidad = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !quieto) raf = requestAnimationFrame(pintar);
    };
    preparar(); pintar();
    window.addEventListener('resize', alCambiarTamano);
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', alCambiarTamano);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, []);

  // Cada estela: un halo ancho y difuminado + un hilo fino y brillante encima.
  const estelas = [
    { d: 'M-120 760 C 280 650, 600 720, 900 470 S 1300 120, 1580 50', g: 'gx-e1', w: 2.4 },
    { d: 'M-120 860 C 360 770, 700 840, 1010 610 S 1360 330, 1580 300', g: 'gx-e2', w: 1.8 },
    { d: 'M-100 130 C 280 230, 520 90, 820 190 S 1210 430, 1560 380', g: 'gx-e3', w: 1.4 },
    { d: 'M180 1000 C 480 830, 760 910, 1110 700 S 1410 520, 1620 560', g: 'gx-e4', w: 1.6 },
  ];
  return (
    <div className="gx-espacio" aria-hidden="true">
      <svg className="gx-estelas" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="gx-e1" x1="0" x2="1"><stop offset="0" stopColor="#a855f7" stopOpacity="0" /><stop offset=".35" stopColor="#a855f7" /><stop offset=".7" stopColor="#ec4899" /><stop offset="1" stopColor="#ec4899" stopOpacity="0" /></linearGradient>
          <linearGradient id="gx-e2" x1="0" x2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity="0" /><stop offset=".4" stopColor="#60a5fa" /><stop offset=".75" stopColor="#22d3ee" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient>
          <linearGradient id="gx-e3" x1="0" x2="1"><stop offset="0" stopColor="#fb923c" stopOpacity="0" /><stop offset=".45" stopColor="#fb923c" /><stop offset=".8" stopColor="#ec4899" /><stop offset="1" stopColor="#ec4899" stopOpacity="0" /></linearGradient>
          <linearGradient id="gx-e4" x1="0" x2="1"><stop offset="0" stopColor="#ec4899" stopOpacity="0" /><stop offset=".5" stopColor="#d946ef" /><stop offset=".85" stopColor="#8b5cf6" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient>
          <filter id="gx-difuso" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" /></filter>
        </defs>
        {estelas.map((e) => (
          <g key={e.g}>
            <path d={e.d} fill="none" stroke={`url(#${e.g})`} strokeWidth={e.w * 14} strokeLinecap="round" opacity=".28" filter="url(#gx-difuso)" />
            <path d={e.d} fill="none" stroke={`url(#${e.g})`} strokeWidth={e.w} strokeLinecap="round" opacity=".9" />
          </g>
        ))}
      </svg>
      <canvas ref={ref} />
    </div>
  );
}

// Tarjeta de cristal. `brillo` = borde de luz en degradado; `halo` = resplandor
// alrededor; `pulsable` = se eleva al pasar por encima (botones y enlaces).
export function Tarjeta({ as: Etiqueta = 'div', brillo = false, halo = false, pulsable = false, className = '', children, ...resto }) {
  return (
    <Etiqueta className={cn('gx-card', brillo && 'gx-brillo', halo && 'gx-halo', pulsable && 'gx-pulsable', className)} {...resto}>
      {children}
    </Etiqueta>
  );
}

// Título de sección con su icono brillante.
export function TituloVista({ icono: Icono, color = '#a855f7', titulo, subtitulo, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3.5">
        {Icono && <span className="gx-orbe h-12 w-12" style={{ '--orbe': color }}><Icono size={22} /></span>}
        <div>
          <h1 className="gx-titulo text-2xl font-extrabold text-fg sm:text-[28px]">{titulo}</h1>
          {subtitulo && <p className="mt-0.5 text-sm text-muted">{subtitulo}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// Estado vacío: icono, título, texto y (opcional) una acción.
export function Vacio({ icono: Icono, titulo, texto, children, className = '' }) {
  return (
    <Tarjeta className={cn('flex flex-col items-center gap-2 px-6 py-12 text-center', className)}>
      {Icono && <span className="gx-orbe mb-1 h-14 w-14" style={{ '--orbe': '#7c3aed' }}><Icono size={24} /></span>}
      <h3 className="text-base font-bold text-fg">{titulo}</h3>
      {texto && <p className="max-w-sm text-sm text-muted">{texto}</p>}
      {children}
    </Tarjeta>
  );
}

// Avisos flotantes (abajo a la derecha, por encima del menú).
const ESTILO_AVISO = {
  ok: { icono: CheckCircle2, color: '#4ade80' },
  oro: { icono: Sparkles, color: '#fbbf24' },
  error: { icono: AlertTriangle, color: '#fb7185' },
};
export function Avisos({ lista, onCerrar }) {
  return (
    <div className="gx-toasts" role="status" aria-live="polite">
      {lista.map((a) => {
        const e = ESTILO_AVISO[a.tipo] || ESTILO_AVISO.ok;
        const Icono = e.icono;
        return (
          <div key={a.id} className="gx-card gx-toast flex items-start gap-3 px-4 py-3 text-sm" style={{ boxShadow: `0 0 30px -10px ${e.color}, 0 20px 50px -25px rgba(0,0,0,.9)`, borderColor: `${e.color}55` }}>
            <Icono size={18} className="mt-0.5 shrink-0" style={{ color: e.color }} />
            <span className="flex-1 font-medium text-fg">{a.texto}</span>
            <button onClick={() => onCerrar(a.id)} className="shrink-0 rounded-md p-0.5 text-muted hover:text-fg" aria-label="OK"><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
