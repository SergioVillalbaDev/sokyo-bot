// Gráfica de área de "Mi cuenta": mensajes por día en los últimos 14 días.
// Una sola serie (el título la nombra, no hace falta leyenda), línea de 2px con
// brillo de neón, cruz que sigue al puntero o a las flechas del teclado y una
// tabla oculta con los mismos datos para lectores de pantalla.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { maximoBonito, trazoMonotono, fmtNum } from './portalUtils';

const ALTO = 190;
const M = { arriba: 14, derecha: 14, abajo: 26, izquierda: 34 };

// 'YYYY-MM-DD' -> fecha a mediodía UTC (formatear sin que la zona mueva el día).
const aFecha = (dia) => new Date(`${dia}T12:00:00Z`);

export default function GraficaActividad({ serie = [] }) {
  const { t, i18n } = useTranslation();
  const idioma = i18n.language === 'en' ? 'en' : 'es';
  const caja = useRef(null);
  const [ancho, setAncho] = useState(300);
  const [activo, setActivo] = useState(null);

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fmtDia = useMemo(() => new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }), [idioma]);
  const fmtLargo = useMemo(() => new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }), [idioma]);

  const n = serie.length;
  const maxY = maximoBonito(Math.max(0, ...serie.map((d) => d.mensajes)));
  const interiorW = ancho - M.izquierda - M.derecha;
  const interiorH = ALTO - M.arriba - M.abajo;
  const x = (i) => M.izquierda + (n <= 1 ? interiorW / 2 : (i * interiorW) / (n - 1));
  const y = (v) => M.arriba + interiorH - (v / maxY) * interiorH;
  const base = M.arriba + interiorH;

  const puntos = serie.map((d, i) => [x(i), y(d.mensajes)]);
  const linea = trazoMonotono(puntos);
  const area = n ? `${linea} L${x(n - 1)},${base} L${x(0)},${base} Z` : '';
  const marcas = [0, maxY / 2, maxY];
  // Etiquetas del eje X: una de cada tres, contando desde hoy hacia atrás.
  const conEtiqueta = (i) => (n - 1 - i) % 3 === 0;

  const elegir = (clientX) => {
    const r = caja.current.getBoundingClientRect();
    const rel = clientX - r.left - M.izquierda;
    const i = Math.round((rel / interiorW) * (n - 1));
    setActivo(Math.max(0, Math.min(n - 1, i)));
  };
  const teclas = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActivo((a) => Math.max(0, (a ?? n - 1) - 1)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setActivo((a) => Math.min(n - 1, (a ?? n - 1) + 1)); }
    if (e.key === 'Escape') setActivo(null);
  };

  const sel = activo != null ? serie[activo] : null;
  const izqTooltip = activo != null ? Math.min(Math.max(x(activo), 70), ancho - 70) : 0;

  return (
    <div ref={caja} className="relative select-none" style={{ height: ALTO }}>
      <svg width={ancho} height={ALTO} role="img" aria-label={t('portal.home.chartAria')} className="block overflow-visible">
        <defs>
          <linearGradient id="gx-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c026d3" stopOpacity=".34" />
            <stop offset=".55" stopColor="#7c3aed" stopOpacity=".12" />
            <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gx-linea" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#818cf8" />
            <stop offset=".5" stopColor="#c084fc" />
            <stop offset="1" stopColor="#f472b6" />
          </linearGradient>
        </defs>

        {/* Rejilla: líneas finas y discretas */}
        {marcas.map((v) => (
          <g key={v}>
            <line x1={M.izquierda} x2={ancho - M.derecha} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
            <text x={M.izquierda - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--text-secondary)">{fmtNum(v, idioma)}</text>
          </g>
        ))}
        {serie.map((d, i) => conEtiqueta(i) && (
          <text key={d.dia} x={x(i)} y={ALTO - 6} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">
            {i === n - 1 ? t('portal.home.today') : fmtDia.format(aFecha(d.dia))}
          </text>
        ))}

        {n > 0 && <path d={area} fill="url(#gx-area)" />}
        {n > 0 && <path d={linea} fill="none" stroke="url(#gx-linea)" strokeWidth="2.25" strokeLinecap="round" className="gx-grafica-linea" />}

        {/* Hoy, siempre marcado */}
        {n > 0 && activo == null && (
          <circle cx={x(n - 1)} cy={y(serie[n - 1].mensajes)} r="5" fill="#f9a8d4" stroke="#0d0b1c" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px #ec4899)' }} />
        )}

        {/* Cruz del punto elegido */}
        {sel && (
          <g pointerEvents="none">
            <line x1={x(activo)} x2={x(activo)} y1={M.arriba} y2={base} stroke="rgba(255,255,255,.28)" strokeWidth="1" />
            <circle cx={x(activo)} cy={y(sel.mensajes)} r="5.5" fill="#fff" stroke="#0d0b1c" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 8px #d946ef)' }} />
          </g>
        )}

        {/* Zona sensible: todo el ancho, para no tener que acertar en la línea */}
        <rect
          x={M.izquierda} y={0} width={interiorW} height={ALTO} fill="transparent" tabIndex={0}
          aria-label={t('portal.home.chartKeys')}
          onPointerMove={(e) => elegir(e.clientX)}
          onPointerDown={(e) => elegir(e.clientX)}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActivo(null); }}
          onFocus={() => setActivo((a) => a ?? n - 1)}
          onBlur={() => setActivo(null)}
          onKeyDown={teclas}
          style={{ outline: 'none', cursor: 'crosshair' }}
        />
      </svg>

      {sel && (
        <div
          className="gx-card pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap px-3 py-2 text-center"
          style={{ left: izqTooltip, top: Math.max(0, y(sel.mensajes) - 64), borderRadius: 12 }}
        >
          <div className="text-base font-extrabold text-fg">{t('portal.home.messagesCount', { count: sel.mensajes, n: fmtNum(sel.mensajes, idioma) })}</div>
          <div className="text-[11px] capitalize text-muted">{fmtLargo.format(aFecha(sel.dia))}</div>
        </div>
      )}

      {/* Los mismos datos, en tabla, para lectores de pantalla */}
      <table className="sr-only">
        <caption>{t('portal.home.chartAria')}</caption>
        <thead><tr><th scope="col">{t('portal.home.day')}</th><th scope="col">{t('portal.home.messages')}</th></tr></thead>
        <tbody>{serie.map((d) => <tr key={d.dia}><td>{fmtLargo.format(aFecha(d.dia))}</td><td>{d.mensajes}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
