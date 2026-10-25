// Hero de la landing: titular, las dos entradas (añadir el bot / entrar a mi
// cuenta) y una maqueta del producto: el panel de admin y, encima, el móvil con
// «Mi cuenta». Todo en HTML y CSS (sin imágenes): pesa poco y se ve nítido.
// Textos vía i18n (src/i18n/locales/*).
import { useTranslation } from 'react-i18next';
import {
  Plus, ArrowRight, Zap, CreditCard, Gift, Star, MousePointerClick, Coins,
  Ticket, ShieldCheck, TrendingUp, Music, Rocket, Home, ShoppingBag, Palette, CircleUserRound,
} from 'lucide-react';
import { inviteUrl, URL_CUENTA } from '../../lib/landingConfig';

const ICONOS_CONFIANZA = [Zap, CreditCard, Gift];
const MENU = [
  { Icono: Home, color: '#b4d8fc' },
  { Icono: Ticket, color: '#60a5fa' },
  { Icono: ShieldCheck, color: '#f87171' },
  { Icono: TrendingUp, color: '#f472b6' },
  { Icono: Music, color: '#ec4899' },
  { Icono: Rocket, color: '#fbbf24' },
];

export default function Hero({ onEnterDashboard }) {
  const { t } = useTranslation();
  const confianza = t('landing.hero.trust', { returnObjects: true });

  return (
    <section id="top" className="relative">
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20">
        <div className="text-center lg:text-left">
          <a href="#mi-cuenta" style={{ '--i': 0 }} className="lx-etiqueta sk-entra transition-colors hover:border-violet-300/50">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" />
            {t('landing.hero.badge')} <ArrowRight size={13} />
          </a>

          {/* Titular y subtítulo solo se deslizan (sin transparencia): se ven desde el primer pintado. */}
          <h1 style={{ '--i': 1 }} className="sk-entra-suave mt-6 font-extrabold leading-[1.04] tracking-tight text-fg text-[clamp(2.1rem,7.4vw,4.3rem)]">
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
            <a href={URL_CUENTA} className="lx-btn lx-btn-neon px-7 py-4 text-base">
              <CircleUserRound size={19} /> {t('landing.hero.ctaAccount')}
            </a>
          </div>
          <button style={{ '--i': 4 }} onClick={onEnterDashboard} className="sk-entra group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-fg">
            {t('landing.hero.ctaPanel')} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </button>

          <ul style={{ '--i': 5 }} className="sk-entra mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted lg:justify-start">
            {(Array.isArray(confianza) ? confianza : []).map((txt, i) => {
              const Icono = ICONOS_CONFIANZA[i] || Star;
              return <li key={txt} className="flex items-center gap-1.5"><Icono size={15} className="text-violet-300" /> {txt}</li>;
            })}
          </ul>
        </div>

        <Maqueta />
      </div>
    </section>
  );
}

// El panel de admin en una ventana de cristal y, delante, el móvil con «Mi cuenta».
function Maqueta() {
  const { t } = useTranslation();
  const p = t('landing.hero.preview', { returnObjects: true });
  const menu = Array.isArray(p.menu) ? p.menu : [];

  return (
    <div style={{ '--i': 4 }} className="sk-entra relative mx-auto w-full max-w-[600px] pb-10 pr-6 sm:pr-14" aria-hidden="true">
      {/* Halo: degradado radial (un filtro blur grande cuesta mucho al pintar en el móvil). */}
      <div className="sk-halo pointer-events-none absolute left-1/2 top-1/2 h-3/4 w-[110%] -translate-x-1/2 -translate-y-1/2" style={{ '--halo': 'rgba(124, 58, 237, .32)' }} />

      <div className="lx-card lx-brillo lx-halo lx-ventana relative">
        <div className="flex items-center gap-2 border-b border-white/[.07] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <div className="ml-3 flex-1 truncate rounded-lg bg-black/30 px-3 py-1 text-center text-[11px] text-muted">{p.url}</div>
        </div>
        <div className="flex">
          {/* Menú lateral */}
          <div className="hidden w-[138px] shrink-0 flex-col gap-1 border-r border-white/[.07] p-2.5 sm:flex">
            {MENU.map(({ Icono, color }, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${i === 0 ? 'bg-gradient-to-r from-[#b4d8fc] to-[#7860c0] text-[#0a0b18]' : 'text-muted'}`}>
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md" style={i === 0 ? undefined : { color, background: `${color}22` }}><Icono size={11} /></span>
                <span className="truncate">{menu[i]}</span>
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-3 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-fg">{p.home}</p>
              <span className="lx-chip text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {p.online}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(Array.isArray(p.stats) ? p.stats : []).map((s, i) => (
                <div key={i} className="rounded-xl border border-white/[.07] bg-white/[.04] p-2">
                  <p className="truncate text-[9.5px] text-muted">{s.l}</p>
                  <p className="text-sm font-extrabold text-fg">{s.v}</p>
                </div>
              ))}
            </div>
            {/* Gráfica de actividad */}
            <div className="rounded-xl border border-white/[.07] bg-white/[.03] p-2.5">
              <p className="text-[10px] font-semibold text-muted">{p.chart}</p>
              <svg viewBox="0 0 240 56" className="mt-1 h-14 w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lx-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a855f7" stopOpacity=".45" /><stop offset="1" stopColor="#a855f7" stopOpacity="0" /></linearGradient>
                  <linearGradient id="lx-linea" x1="0" x2="1"><stop offset="0" stopColor="#b4d8fc" /><stop offset=".55" stopColor="#a855f7" /><stop offset="1" stopColor="#ec4899" /></linearGradient>
                </defs>
                <path d="M0 46 C 24 40, 34 30, 56 34 S 92 22, 112 26 S 150 10, 172 16 S 212 4, 240 8 L 240 56 L 0 56 Z" fill="url(#lx-area)" />
                <path d="M0 46 C 24 40, 34 30, 56 34 S 92 22, 112 26 S 150 10, 172 16 S 212 4, 240 8" fill="none" stroke="url(#lx-linea)" strokeWidth="2.2" />
              </svg>
            </div>
            {(Array.isArray(p.tickets) ? p.tickets : []).map((tk, i) => (
              <div key={i} className="flex items-center gap-2.5 overflow-hidden rounded-xl border border-white/[.07] bg-white/[.03] p-2.5">
                <span className={`h-8 w-1 shrink-0 rounded-full ${i === 0 ? 'bg-red-400' : 'bg-amber-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-fg">{tk.t}</p>
                  <p className="text-[10px] text-muted">{tk.n}</p>
                </div>
                <span className="rounded-full bg-white/[.07] px-2 py-0.5 text-[9.5px] font-bold text-muted">{tk.p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* El móvil con «Mi cuenta» */}
      <div className="lx-movil absolute -bottom-2 right-0 w-[150px] sm:w-[178px]">
        <div className="lx-movil-pantalla px-3 pb-3.5 pt-3">
          <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-white/15" />
          <div className="flex items-center gap-2">
            <span className="lx-aro shrink-0"><img src="/assets/logo-96.webp" alt="" width="30" height="30" className="h-[30px] w-[30px] object-cover" /></span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold text-white">{p.phone?.hello}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-fuchsia-300">{p.phone?.brand}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[9.5px] text-muted"><span>{p.phone?.level}</span><span>68%</span></div>
          <div className="lx-barra mt-1"><span style={{ width: '68%' }} /></div>
          <p className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-amber-300"><Coins size={12} /> {p.phone?.gold}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {[[Ticket, '#60a5fa'], [ShoppingBag, '#fbbf24'], [Music, '#ec4899'], [Palette, '#a855f7']].map(([Icono, color], i) => (
              <div key={i} className="relative rounded-xl border border-white/10 bg-white/[.06] p-1.5">
                <span className="lx-orbe h-6 w-6 rounded-lg" style={{ '--orbe': color }}><Icono size={12} /></span>
                <p className="mt-1 truncate text-[9px] font-semibold text-fg">{p.phone?.tiles?.[i]}</p>
                {i === 0 && <span className="absolute right-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-pink-500 px-1 text-[8px] font-extrabold text-white">1</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Avisos flotantes */}
      <div style={{ '--retraso': '1s', '--flota': '-8px' }} className="sk-flota lx-card absolute -top-6 right-16 hidden items-center gap-2 rounded-2xl px-3 py-2 sm:flex">
        <span className="lx-orbe h-8 w-8 rounded-xl" style={{ '--orbe': '#34d399' }}><Star size={15} /></span>
        <div>
          <p className="text-[11px] font-bold text-fg">{p.chip1Title}</p>
          <p className="text-[10px] text-amber-300">★★★★★</p>
        </div>
      </div>
      <div style={{ '--retraso': '1.3s', '--flota': '8px' }} className="sk-flota lx-card absolute -left-2 bottom-4 hidden items-center gap-2 rounded-2xl px-3 py-2 sm:flex lg:-left-10">
        <span className="lx-orbe h-8 w-8 rounded-xl" style={{ '--orbe': '#a855f7' }}><MousePointerClick size={15} /></span>
        <div>
          <p className="font-mono text-[11px] font-bold text-fg">{p.chip2Title}</p>
          <p className="text-[10px] text-muted">{p.chip2Sub}</p>
        </div>
      </div>
    </div>
  );
}
