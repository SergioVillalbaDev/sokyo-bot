// Hero de la landing: qué es Sokyo, las dos acciones de quien gestiona un
// servidor (añadir el bot / abrir el panel de control) y, para los miembros, el
// enlace a «Mi cuenta». Al lado, capturas reales: el panel de control en el
// navegador y, delante, «Mi cuenta» en el móvil. Textos vía i18n.
import { useTranslation } from 'react-i18next';
import { Plus, ArrowRight, Zap, CreditCard, Gift, Star, LayoutDashboard, CircleUserRound, MousePointerClick } from 'lucide-react';
import { inviteUrl, URL_CUENTA } from '../../lib/landingConfig';
import { EnlacePanel, Ventana, Movil } from './Marcos';
import { captura, capturaMovil, ANCHO, ALTO } from './capturas';

const ICONOS_CONFIANZA = [Zap, CreditCard, Gift];

export default function Hero({ onEnterDashboard }) {
  const { t } = useTranslation();
  const confianza = t('landing.hero.trust', { returnObjects: true });

  return (
    <section id="top" className="relative">
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 pb-16 pt-10 sm:px-6 lg:grid-cols-[.92fr_1.08fr] lg:gap-10 lg:pb-24 lg:pt-16">
        <div className="text-center lg:text-left">
          <a href="#panel" style={{ '--i': 0 }} className="lx-etiqueta sk-entra transition-colors hover:border-violet-300/50">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" />
            {t('landing.hero.badge')} <ArrowRight size={13} />
          </a>

          {/* Titular y subtítulo solo se deslizan (sin transparencia): se ven desde el primer pintado. */}
          <h1 style={{ '--i': 1 }} className="sk-entra-suave mt-6 font-extrabold leading-[1.04] tracking-tight text-fg text-[clamp(2.1rem,6.6vw,4.1rem)]">
            <span className="block">{t('landing.hero.titleLine1')}</span>
            <span className="lx-texto block pb-1">{t('landing.hero.titleLine2')}</span>
          </h1>

          <p style={{ '--i': 2 }} className="sk-entra-suave mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
            {t('landing.hero.subtitle')}
          </p>

          <div style={{ '--i': 3 }} className="sk-entra mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="lx-btn lx-btn-discord px-7 py-4 text-base">
              <Plus size={19} /> {t('landing.hero.ctaPrimary')}
            </a>
            <EnlacePanel onEnterDashboard={onEnterDashboard} className="lx-btn lx-btn-panel px-7 py-4 text-base">
              <LayoutDashboard size={19} /> {t('landing.hero.ctaPanel')}
            </EnlacePanel>
          </div>
          <a href={URL_CUENTA} style={{ '--i': 4 }} className="sk-entra group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-fg">
            <CircleUserRound size={16} className="text-fuchsia-300" /> {t('landing.hero.ctaAccount')} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </a>

          <ul style={{ '--i': 5 }} className="sk-entra mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start">
            {(Array.isArray(confianza) ? confianza : []).map((txt, i) => {
              const Icono = ICONOS_CONFIANZA[i] || Star;
              return <li key={txt} className="flex items-center gap-1.5"><Icono size={15} className="text-violet-300" /> {txt}</li>;
            })}
          </ul>
        </div>

        <Capturas />
      </div>
    </section>
  );
}

// El panel de control (captura real) y, delante, «Mi cuenta» en el móvil.
function Capturas() {
  const { t, i18n } = useTranslation();
  const p = t('landing.hero.preview', { returnObjects: true });
  const panel = captura(i18n.language, 'inicio');

  return (
    <div style={{ '--i': 4 }} className="sk-entra relative mx-auto w-full max-w-[680px] pb-12 pr-8 sm:pr-16 lg:max-w-none">
      {/* Halo: degradado radial (un filtro blur grande cuesta mucho al pintar en el móvil). */}
      <div className="sk-halo pointer-events-none absolute left-1/2 top-1/2 h-3/4 w-[110%] -translate-x-1/2 -translate-y-1/2" style={{ '--halo': 'rgba(124, 58, 237, .32)' }} />

      <Ventana url={p.url}>
        <img
          src={panel.src} srcSet={panel.srcSet} sizes="(min-width: 1280px) 680px, (min-width: 1024px) 52vw, 84vw"
          width={ANCHO} height={ALTO} alt={p.alt} fetchPriority="high" decoding="async" className="lx-captura"
        />
      </Ventana>

      <Movil imagen={capturaMovil(i18n.language, 'cuenta')} sizes="(min-width: 1024px) 190px, 28vw" alt={p.altPhone} cargar="eager" className="absolute -bottom-1 right-0 w-[29%] max-w-[190px]" />

      {/* Avisos flotantes */}
      <div style={{ '--retraso': '1s', '--flota': '-8px' }} className="sk-flota lx-card absolute -top-6 right-14 hidden items-center gap-2 rounded-2xl px-3 py-2 sm:flex" aria-hidden="true">
        <span className="lx-orbe h-8 w-8 rounded-xl" style={{ '--orbe': '#34d399' }}><Star size={15} /></span>
        <div>
          <p className="text-[11px] font-bold text-fg">{p.chip1Title}</p>
          <p className="text-[10px] text-amber-300">★★★★★</p>
        </div>
      </div>
      <div style={{ '--retraso': '1.3s', '--flota': '8px' }} className="sk-flota lx-card absolute -left-2 bottom-3 hidden items-center gap-2 rounded-2xl px-3 py-2 sm:flex lg:-left-8" aria-hidden="true">
        <span className="lx-orbe h-8 w-8 rounded-xl" style={{ '--orbe': '#a855f7' }}><MousePointerClick size={15} /></span>
        <div>
          <p className="font-mono text-[11px] font-bold text-fg">{p.chip2Title}</p>
          <p className="text-[10px] text-muted">{p.chip2Sub}</p>
        </div>
      </div>
    </div>
  );
}
