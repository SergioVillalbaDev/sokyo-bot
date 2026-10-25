// «Cada miembro, su propia web»: cómo entra cualquiera de un servidor a su
// cuenta, en tres pasos que se ven (Discord → su botón privado → dentro). La
// demo avanza sola al verse y cada paso se puede tocar. Es la sección a la que
// llevan «Mi cuenta» del menú y «¿Cómo entro?». Textos vía i18n (landing.cuenta).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MousePointerClick, KeyRound, PartyPopper, MousePointer2, Eye, ExternalLink, Hash, Copy, Check,
  CircleUserRound, Ticket, ShoppingBag, Music, Palette, Gift, Home, Coins, Flame, Trophy,
} from 'lucide-react';
import { URL_CUENTA } from '../../lib/landingConfig';
import { observar } from './observar';

const PASOS = [
  { Icono: MousePointerClick, color: '#a855f7' },
  { Icono: KeyRound, color: '#ec4899' },
  { Icono: PartyPopper, color: '#22d3ee' },
];
const DURACION = 4200; // ms por paso cuando avanza sola
const DENTRO = [
  { Icono: Ticket, color: '#60a5fa' },
  { Icono: ShoppingBag, color: '#fbbf24' },
  { Icono: Music, color: '#ec4899' },
  { Icono: Palette, color: '#a855f7' },
  { Icono: Gift, color: '#34d399' },
];

export default function MiCuentaDemo() {
  const { t } = useTranslation();
  const [paso, setPaso] = useState(0);
  // Avanza sola hasta que se toca un paso (y nunca si se pide menos movimiento).
  const [auto, setAuto] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const ref = useRef(null);

  useEffect(() => observar(ref.current, () => setVisible(true)), []);
  useEffect(() => {
    if (!auto || !visible) return undefined;
    const id = setInterval(() => setPaso((p) => (p + 1) % PASOS.length), DURACION);
    return () => clearInterval(id);
  }, [auto, visible]);

  const elegir = (i) => { setAuto(false); setPaso(i); };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(t('landing.cuenta.cmd')); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ }
  };
  const pasos = t('landing.cuenta.steps', { returnObjects: true });
  const dentro = t('landing.cuenta.inside', { returnObjects: true });

  return (
    <section id="mi-cuenta" ref={ref} className="lx-diferido relative mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <span className="lx-etiqueta"><CircleUserRound size={14} /> {t('landing.cuenta.eyebrow')}</span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.cuenta.title')} <span className="lx-texto">{t('landing.cuenta.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.cuenta.subtitle')}</p>
      </div>

      <div className="mt-14 grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
        {/* Móvil: los pasos como pestañas justo encima de la demo, para ver el cambio al tocar. */}
        <div className="lg:hidden">
          <div role="tablist" aria-label={t('landing.cuenta.stepsLabel')} className="lx-card grid grid-cols-3 gap-1 p-1.5">
            {PASOS.map(({ Icono, color }, i) => (
              <button
                key={i} role="tab" aria-selected={paso === i} onClick={() => elegir(i)}
                className={`relative flex flex-col items-center gap-1.5 overflow-hidden rounded-2xl px-2 py-2.5 text-xs font-bold transition-colors ${paso === i ? 'bg-white/10 text-fg' : 'text-muted'}`}
              >
                <span className="lx-orbe h-8 w-8 rounded-xl" style={{ '--orbe': color }}><Icono size={15} /></span>
                {t('landing.cuenta.step', { n: i + 1 })}
                {paso === i && auto && visible && <span key={paso} className="lx-progreso absolute bottom-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-[#b4d8fc] via-[#a855f7] to-[#ec4899]" style={{ '--duracion': `${DURACION}ms` }} />}
              </button>
            ))}
          </div>
          <p className="mt-5 text-center text-xl font-extrabold text-fg">{pasos[paso]?.t}</p>
          <p className="mx-auto mt-1.5 max-w-md text-center text-sm leading-relaxed text-muted">{pasos[paso]?.d}</p>
        </div>

        {/* Ordenador: los tres pasos en columna, al lado de la demo */}
        <ol className="hidden flex-col gap-3 lg:flex" aria-label={t('landing.cuenta.stepsLabel')}>
          {PASOS.map(({ Icono, color }, i) => {
            const activo = paso === i;
            return (
              <li key={i}>
                <button
                  onClick={() => elegir(i)} aria-current={activo ? 'step' : undefined}
                  className={`lx-card relative flex w-full items-start gap-4 overflow-hidden p-4 text-left transition-[border-color,box-shadow,opacity] sm:p-5 ${activo ? 'lx-brillo lx-halo' : 'opacity-70 hover:opacity-100'}`}
                >
                  <span className="lx-orbe h-12 w-12" style={{ '--orbe': color }}><Icono size={21} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">{t('landing.cuenta.step', { n: i + 1 })}</span>
                    <span className="mt-0.5 block text-lg font-extrabold text-fg">{pasos[i]?.t}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{pasos[i]?.d}</span>
                  </span>
                  {/* Barra de tiempo del paso activo mientras avanza sola */}
                  {activo && auto && visible && <span key={paso} className="lx-progreso absolute bottom-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-[#b4d8fc] via-[#a855f7] to-[#ec4899]" style={{ '--duracion': `${DURACION}ms` }} />}
                </button>
              </li>
            );
          })}
        </ol>

        {/* La demo */}
        <div className="relative" aria-hidden="true">
          <div className="sk-halo pointer-events-none absolute left-1/2 top-1/2 h-3/4 w-full -translate-x-1/2 -translate-y-1/2" style={{ '--halo': 'rgba(217, 70, 239, .22)' }} />
          <div key={paso} className="lx-aparece relative min-h-[420px] sm:min-h-[440px]">
            {paso === 0 && <PasoDiscord />}
            {paso === 1 && <PasoBoton />}
            {paso === 2 && <PasoDentro />}
          </div>
        </div>
      </div>

      {/* Qué hay dentro */}
      <ul className="mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-2.5">
        {DENTRO.map(({ Icono, color }, i) => (
          <li key={i} className="lx-chip px-3 py-1.5 text-sm"><Icono size={15} style={{ color }} /> {Array.isArray(dentro) ? dentro[i] : ''}</li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a href={URL_CUENTA} className="lx-btn lx-btn-cuenta px-7 py-4 text-base"><CircleUserRound size={19} /> {t('landing.cuenta.cta')}</a>
        <button onClick={copiar} className="lx-btn px-6 py-4 text-base">
          {copiado ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
          {copiado ? t('landing.cuenta.copied') : t('landing.cuenta.copy')}
        </button>
      </div>
      <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-muted">
        <strong className="text-fg">{t('landing.cuenta.adminTitle')}</strong> {t('landing.cuenta.adminPre')} <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-fg">{t('landing.cuenta.adminCmd')}</code> {t('landing.cuenta.adminPost')}
      </p>
    </section>
  );
}

// Cabecera y mensaje de Sokyo con los colores reales de Discord.
function MensajeBot({ children }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3">
      <img src="/assets/logo-96.webp" alt="" width="40" height="40" loading="lazy" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[15px] font-medium text-white">
          Sokyo <span className="rounded-[3px] bg-[#5865f2] px-1 text-[10px] font-semibold leading-4 text-white">{t('landing.cuenta.mock.app')}</span>
          <span className="text-[11px] font-normal text-[#949ba4]">{t('landing.cuenta.mock.time')}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

function VentanaDiscord({ children, pie }) {
  const { t } = useTranslation();
  return (
    <div className="lx-discord lx-halo overflow-hidden rounded-2xl ring-1 ring-white/10">
      <div className="flex items-center gap-1.5 border-b border-black/30 px-4 py-3 text-[15px] font-semibold text-white">
        <Hash size={18} className="text-[#80848e]" /> {t('landing.cuenta.mock.channel')}
      </div>
      <div className="space-y-4 p-4">{children}</div>
      {pie}
    </div>
  );
}

// Paso 1: el mensaje fijo del canal con «Abrir mi cuenta» (y /cuenta escrito abajo).
function PasoDiscord() {
  const { t } = useTranslation();
  const m = (k) => t(`landing.cuenta.mock.${k}`);
  return (
    <VentanaDiscord pie={(
      // Abajo, la otra forma: escribir /cuenta (con la sugerencia de Discord encima).
      <div className="space-y-1.5 px-4 pb-4">
        <div className="rounded-lg bg-[#2b2d31] p-1.5 ring-1 ring-black/40">
          <p className="flex items-center gap-2 rounded bg-[#404249] px-2 py-1.5 text-[13px]">
            <span className="font-semibold text-white">{m('cmd')}</span>
            <span className="truncate text-[#b5bac1]">{m('cmdDesc')}</span>
          </p>
        </div>
        <div className="flex items-center rounded-lg bg-[#383a40] px-4 py-3 text-[14px] text-white">
          <span className="lx-escribe inline-block font-mono" style={{ '--letras': m('cmd').length }}>{m('cmd')}</span>
        </div>
      </div>
    )}>
      <MensajeBot>
        <div className="lx-discord-embed mt-1 p-3">
          <p className="text-[15px] font-semibold text-white">{m('embedTitle')}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed">{m('embedDesc')}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="lx-discord-btn lx-pulso relative bg-[#248046]">
            ✨ {m('open')}
            <MousePointer2 size={22} className="absolute -bottom-4 -right-3 fill-white text-black drop-shadow" />
          </span>
          <span className="lx-discord-btn bg-[#4e5058]">🌐 {m('web')} <ExternalLink size={12} /></span>
        </div>
      </MensajeBot>
    </VentanaDiscord>
  );
}

// Paso 2: la respuesta que solo ve quien ha pulsado, con su botón de entrada.
function PasoBoton() {
  const { t } = useTranslation();
  const m = (k) => t(`landing.cuenta.mock.${k}`);
  return (
    <VentanaDiscord>
      <MensajeBot>
        <div className="lx-discord-embed mt-1 p-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <img src="/assets/logo-96.webp" alt="" width="20" height="20" loading="lazy" className="h-5 w-5 rounded-full" /> {m('replyTitle')}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed">{m('replyDesc')}</p>
          <p className="mt-2 text-[13px] leading-relaxed">{m('replyList')}</p>
          <p className="mt-2.5 text-[11px] text-[#949ba4]">{m('expires')}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="lx-discord-btn lx-pulso relative bg-[#4e5058]">
            ✨ {m('open')} <ExternalLink size={12} />
            <MousePointer2 size={22} className="absolute -bottom-4 -right-3 fill-white text-black drop-shadow" />
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#949ba4]">
          <Eye size={14} /> {m('onlyYou')} · <span className="text-[#00a8fc]">{m('dismiss')}</span>
        </p>
      </MensajeBot>
    </VentanaDiscord>
  );
}

// Paso 3: ya dentro de «Mi cuenta».
function PasoDentro() {
  const { t } = useTranslation();
  const m = (k) => t(`landing.cuenta.mock.${k}`);
  const casillas = t('landing.cuenta.mock.tiles', { returnObjects: true });
  return (
    <div className="lx-card lx-brillo lx-halo lx-ventana">
      <div className="flex items-center gap-2 border-b border-white/[.07] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <div className="ml-3 flex-1 truncate rounded-lg bg-black/30 px-3 py-1 text-center text-[11px] text-muted">{m('url')}</div>
      </div>
      <div className="relative p-4 pb-20 sm:p-5 sm:pb-20">
        <div className="flex items-center gap-3">
          <span className="lx-aro shrink-0"><img src="/assets/logo-96.webp" alt="" width="44" height="44" loading="lazy" className="h-11 w-11 object-cover" /></span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-fg">{m('hello')}</p>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-fuchsia-300">{m('brand')}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[[Trophy, m('level'), '#a855f7'], [Coins, m('gold'), '#fbbf24'], [Flame, m('streak'), '#fb923c']].map(([Icono, txt, color], i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[.05] p-2.5">
              <Icono size={15} style={{ color }} />
              <p className="mt-1 truncate text-[12px] font-bold text-fg">{txt}</p>
            </div>
          ))}
        </div>
        <div className="mt-2.5 lx-barra"><span style={{ width: '68%' }} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {[[Ticket, '#60a5fa'], [ShoppingBag, '#fbbf24'], [Music, '#ec4899'], [Palette, '#a855f7']].map(([Icono, color], i) => (
            <div key={i} className="relative flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[.05] p-3">
              <span className="lx-orbe h-9 w-9 rounded-xl" style={{ '--orbe': color }}><Icono size={16} /></span>
              <span className="min-w-0 truncate text-sm font-bold text-fg">{Array.isArray(casillas) ? casillas[i] : ''}</span>
              {i === 0 && <span className="absolute right-2 top-2 rounded-full bg-pink-500 px-1.5 text-[10px] font-extrabold text-white shadow-[0_0_10px_rgba(236,72,153,.9)]">1</span>}
            </div>
          ))}
        </div>
        {/* Menú inferior de «Mi cuenta» */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-2xl border border-white/10 bg-[#1a1535]/90 p-1.5">
          {[Home, Ticket, ShoppingBag, Music, Palette].map((Icono, i) => (
            <span key={i} className={`grid h-9 w-11 place-items-center rounded-xl ${i === 0 ? 'bg-gradient-to-br from-violet-500/70 to-pink-500/60 text-white' : 'text-muted'}`}><Icono size={16} /></span>
          ))}
        </div>
      </div>
    </div>
  );
}

