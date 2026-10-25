// Funciones — rejilla «bento» de cristal: cada tarjeta con su color y una
// pequeña muestra viva de lo que hace. Textos vía i18n (landing.features).
import { useTranslation } from 'react-i18next';
import {
  Ticket, ShieldCheck, TrendingUp, Coins, Music, CircleUserRound, LayoutDashboard, DoorOpen, Rocket,
  ArrowRight, Smartphone, Search, Palette, Ban,
} from 'lucide-react';
import { prioridadBar } from '../../lib/landingConfig';
import Revelar from './Revelar';

const META = {
  tickets: { Icono: Ticket, color: '#60a5fa', clase: 'md:col-span-2 md:row-span-2' },
  moderacion: { Icono: ShieldCheck, color: '#f87171' },
  niveles: { Icono: TrendingUp, color: '#a855f7' },
  economia: { Icono: Coins, color: '#fbbf24' },
  musica: { Icono: Music, color: '#ec4899' },
  portal: { Icono: CircleUserRound, color: '#d946ef', clase: 'md:col-span-2' },
  panel: { Icono: LayoutDashboard, color: '#b4d8fc', clase: 'md:col-span-3 lg:col-span-2' },
  entrada: { Icono: DoorOpen, color: '#34d399', clase: 'lg:col-span-2' },
  crecimiento: { Icono: Rocket, color: '#fb923c', clase: 'lg:col-span-2' },
};
const ORDEN = ['tickets', 'moderacion', 'niveles', 'economia', 'musica', 'portal', 'panel', 'entrada', 'crecimiento'];

// Una tarjeta. Revelar fuera y la tarjeta dentro (sus transiciones no se pisan).
function Tile({ id, items, retraso, children }) {
  const { Icono, color, clase = '' } = META[id];
  const item = items[id] || { title: '', desc: '' };
  return (
    <Revelar retraso={retraso} className={`flex ${clase}`}>
      <article className="lx-card lx-pulsable relative flex flex-1 flex-col overflow-hidden p-6" style={{ '--lx-color': `${color}b3` }}>
        <span className="lx-orbe h-11 w-11" style={{ '--orbe': color }}><Icono size={20} /></span>
        <h3 className="mt-5 text-lg font-bold text-fg">{item.title}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{item.desc}</p>
        {children}
      </article>
    </Revelar>
  );
}

function Chips({ lista }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {(Array.isArray(lista) ? lista : []).map((txt) => <span key={txt} className="lx-chip">{txt}</span>)}
    </div>
  );
}

export default function Features() {
  const { t } = useTranslation();
  const items = t('landing.features.items', { returnObjects: true }) || {};
  const prioridades = t('landing.features.prioridades', { returnObjects: true });
  const muestras = t('landing.features.samples', { returnObjects: true }) || {};
  const anchos = ['92%', '70%', '48%', '28%'];

  const muestra = {
    tickets: (
      <>
        <div className="mt-6 space-y-2.5">
          {(Array.isArray(prioridades) ? prioridades : []).map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-muted">{label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[.07]">
                <div style={{ '--ancho': anchos[i] }} className={`sk-crece h-full rounded-full ${prioridadBar[i]}`} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {(Array.isArray(muestras.tickets) ? muestras.tickets : []).map((txt) => <span key={txt} className="lx-chip">{txt}</span>)}
        </div>
        {/* Mini conversación de un ticket */}
        <div className="mt-auto space-y-2 pt-6">
          {(Array.isArray(muestras.chat) ? muestras.chat : []).map((m, i) => (
            <div key={i} className={`flex ${i ? 'justify-end' : ''}`}>
              <p className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${i ? 'rounded-br-md bg-gradient-to-br from-[#5865f2]/80 to-[#7c3aed]/80 text-white' : 'rounded-bl-md border border-white/10 bg-white/[.06] text-fg'}`}>
                <span className={`block text-[11px] font-bold ${i ? 'text-white/75' : 'text-muted'}`}>{m.n}</span>{m.t}
              </p>
            </div>
          ))}
        </div>
      </>
    ),
    moderacion: (
      <div className="mt-4 space-y-1.5">
        {(Array.isArray(muestras.moderacion) ? muestras.moderacion : []).map((txt) => (
          <p key={txt} className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[.06] px-2.5 py-1.5 text-xs text-red-200"><Ban size={13} className="shrink-0" /> <span className="truncate">{txt}</span></p>
        ))}
      </div>
    ),
    niveles: (
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted"><span>{muestras.nivelDe}</span><span>{muestras.nivelA}</span></div>
        <div className="lx-barra mt-1.5"><span style={{ width: '72%' }} /></div>
      </div>
    ),
    economia: (
      <p className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-sm font-bold text-amber-200"><Coins size={15} /> {muestras.oro}</p>
    ),
    musica: (
      <div className="mt-4 flex items-center gap-3">
        <div className="lx-eq"><span /><span /><span /><span /><span /></div>
        <p className="min-w-0 truncate text-xs text-muted">{muestras.cancion}</p>
      </div>
    ),
    portal: (
      <a href="#mi-cuenta" className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-fuchsia-300 hover:underline">{muestras.portalLink} <ArrowRight size={15} /></a>
    ),
    panel: (
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="lx-chip"><Search size={13} className="text-sky-300" /> {muestras.buscador}</span>
        <span className="lx-chip"><Palette size={13} className="text-violet-300" /> {muestras.temas}</span>
        <span className="lx-chip"><Smartphone size={13} className="text-emerald-300" /> {muestras.app}</span>
      </div>
    ),
    entrada: <Chips lista={muestras.entrada} />,
    crecimiento: <Chips lista={muestras.crecimiento} />,
  };

  return (
    <section id="features" className="lx-diferido relative mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="lx-etiqueta">{t('landing.features.eyebrow')}</span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.features.title')} <span className="lx-texto">{t('landing.features.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.features.subtitle')}</p>
      </div>

      {/* Con grid-flow-dense las tarjetas grandes y pequeñas encajan sin huecos. */}
      <div className="mt-14 grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {ORDEN.map((id, i) => (
          <Tile key={id} id={id} items={items} retraso={Math.min(i, 4) * 0.06}>{muestra[id]}</Tile>
        ))}
      </div>
    </section>
  );
}
