// Recorrido por el panel de control: pestañas con capturas reales de cada parte
// (Inicio, tickets, moderación, niveles, estadísticas y buscador), qué se hace
// en ella y dónde está en el menú del panel. Textos vía i18n (landing.tour).
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Ticket, ShieldCheck, TrendingUp, BarChart3, Search, Check, MapPin, Crown } from 'lucide-react';
import Revelar from './Revelar';
import { EnlacePanel, Ventana } from './Marcos';
import { captura, precargar, ANCHO, ALTO } from './capturas';

// img = nombre de la captura (public/landing/<idioma>-<img>-<ancho>.webp); ruta = la URL del panel.
const PESTANAS = [
  { id: 'inicio', img: 'inicio', ruta: '', Icono: LayoutDashboard, color: '#b4d8fc' },
  { id: 'tickets', img: 'chat', ruta: '#dashboard/tickets-gestion', Icono: Ticket, color: '#60a5fa' },
  { id: 'moderacion', img: 'automod', ruta: '#dashboard/mod-automod', Icono: ShieldCheck, color: '#f87171' },
  { id: 'niveles', img: 'niveles', ruta: '#dashboard/config-niveles', Icono: TrendingUp, color: '#a855f7' },
  { id: 'analitica', img: 'analitica', ruta: '#dashboard/datos-analitica', Icono: BarChart3, color: '#818cf8', pro: true },
  { id: 'buscador', img: 'buscar', ruta: '', Icono: Search, color: '#22d3ee' },
];
const SIZES = '(min-width: 1280px) 820px, (min-width: 1024px) 64vw, 92vw';

export default function Tour({ onEnterDashboard }) {
  const { t, i18n } = useTranslation();
  const [activa, setActiva] = useState(0);
  const [cargada, setCargada] = useState(''); // la captura que ya llegó (entra con su animación)
  const botones = useRef([]);
  const p = PESTANAS[activa];
  const textos = t(`landing.tour.tabs.${p.id}`, { returnObjects: true }) || {};
  const img = captura(i18n.language, p.img);
  const clave = `${p.img}-${i18n.language}`;

  // Flechas del teclado entre pestañas (patrón de pestañas accesibles).
  const alTeclado = (e) => {
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const destino = e.key === 'Home' ? 0 : e.key === 'End' ? PESTANAS.length - 1 : paso ? (activa + paso + PESTANAS.length) % PESTANAS.length : null;
    if (destino === null) return;
    e.preventDefault();
    setActiva(destino);
    botones.current[destino]?.focus();
  };

  return (
    <section id="panel" className="lx-diferido relative mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="lx-etiqueta">{t('landing.tour.eyebrow')}</span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.tour.title')} <span className="lx-texto">{t('landing.tour.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.tour.subtitle')}</p>
      </div>

      <Revelar className="mt-12 grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-8">
        {/* Pestañas: columna en el escritorio, fila deslizable en el móvil. */}
        <div className="min-w-0">
          <div role="tablist" aria-label={t('landing.tour.eyebrow')} onKeyDown={alTeclado}
            className="lx-deslizable -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {PESTANAS.map((pe, i) => {
              const sel = i === activa;
              return (
                <button
                  key={pe.id} ref={(el) => { botones.current[i] = el; }} type="button" role="tab" id={`tour-tab-${pe.id}`}
                  aria-selected={sel} aria-controls="tour-panel" tabIndex={sel ? 0 : -1}
                  onClick={() => setActiva(i)} onPointerEnter={() => precargar(i18n.language, pe.img, SIZES)} onFocus={() => precargar(i18n.language, pe.img, SIZES)}
                  className="lx-pestana flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left lg:px-4 lg:py-3.5" style={{ '--lx-color': `${pe.color}b3` }}
                >
                  <span className="lx-orbe h-9 w-9 rounded-xl lg:h-10 lg:w-10" style={{ '--orbe': pe.color }}><pe.Icono size={17} /></span>
                  <span className="min-w-0">
                    <span className={`flex items-center gap-1.5 whitespace-nowrap text-sm font-bold ${sel ? 'text-fg' : 'text-muted'}`}>
                      {t(`landing.tour.tabs.${pe.id}.label`)}
                      {pe.pro && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-300/15 px-1.5 py-px text-[10px] font-bold text-amber-300"><Crown size={10} /> Pro</span>}
                    </span>
                    <span className="hidden text-xs text-muted lg:block">{t(`landing.tour.tabs.${pe.id}.short`)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <EnlacePanel onEnterDashboard={onEnterDashboard} className="lx-btn lx-btn-panel mt-4 hidden w-full lg:flex">
            <LayoutDashboard size={17} /> {t('landing.tour.cta')}
          </EnlacePanel>
        </div>

        <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${p.id}`} className="min-w-0">
          <Ventana url={`dashboard.sokyo.studio/panel${p.ruta}`}>
            {/* La key cambia con la pestaña: la imagen nueva entra con su animación
                cuando ya ha llegado (hasta entonces, el fondo de la ventana). */}
            <img key={clave} src={img.src} srcSet={img.srcSet} sizes={SIZES} width={ANCHO} height={ALTO}
              alt={textos.alt || ''} loading="lazy" decoding="async" onLoad={() => setCargada(clave)} onError={() => setCargada(clave)}
              className={`lx-captura ${cargada === clave ? 'lx-aparece' : 'opacity-0'}`} />
          </Ventana>
          <div className="mt-6 grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <h3 className="text-2xl font-extrabold text-fg">{textos.title}</h3>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
                {(Array.isArray(textos.points) ? textos.points : []).map((txt) => (
                  <li key={txt} className="flex items-start gap-2 text-sm text-fg/90"><Check size={16} className="mt-0.5 shrink-0 text-emerald-300" /> {txt}</li>
                ))}
              </ul>
            </div>
            <p className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-muted">
              <MapPin size={13} className="shrink-0 text-sky-300" /> <span className="font-semibold text-fg">{t('landing.tour.where')}</span> {textos.where}
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">{t('landing.tour.note')}</p>
            <EnlacePanel onEnterDashboard={onEnterDashboard} className="lx-btn lx-btn-panel lg:hidden">
              <LayoutDashboard size={17} /> {t('landing.tour.cta')}
            </EnlacePanel>
          </div>
        </div>
      </Revelar>
    </section>
  );
}
