// «Dos entradas, cada una a lo suyo»: justo después del hero, dónde está cada
// cosa. El panel de control (quien gestiona el servidor) y «Mi cuenta» (cada
// miembro), con su dirección, qué hay dentro y una captura real. Textos vía i18n.
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, CircleUserRound, Plus, ArrowDown, Check, Link2 } from 'lucide-react';
import { inviteUrl, URL_CUENTA } from '../../lib/landingConfig';
import Revelar from './Revelar';
import { EnlacePanel, Movil } from './Marcos';
import { captura, capturaMovil, ANCHO, ALTO } from './capturas';

// Una tarjeta de acceso. Revelar va fuera y la tarjeta dentro: así sus
// transiciones (aparecer al hacer scroll / elevarse al pasar) no se pisan.
function Acceso({ id, Icono, color, tono, retraso = 0, acciones, imagen }) {
  const { t } = useTranslation();
  const puntos = t(`landing.access.${id}.points`, { returnObjects: true });
  return (
    <Revelar retraso={retraso} className="flex">
      <article className="lx-card lx-brillo lx-pulsable relative flex flex-1 flex-col overflow-hidden" style={{ '--lx-color': `${color}b3` }}>
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3.5">
            <span className="lx-orbe h-12 w-12" style={{ '--orbe': color }}><Icono size={22} /></span>
            <div className="min-w-0">
              <p className={`text-xs font-bold uppercase tracking-wider ${tono}`}>{t(`landing.access.${id}.tag`)}</p>
              <h3 className="text-2xl font-extrabold text-fg">{t(`landing.access.${id}.title`)}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">{t(`landing.access.${id}.desc`)}</p>
          <p className="mt-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-semibold tracking-tight text-fg sm:text-sm">
            <Link2 size={14} className={`shrink-0 ${tono}`} /> <span className="truncate">{t(`landing.access.${id}.url`)}</span>
          </p>
          <ul className="mt-5 space-y-2">
            {(Array.isArray(puntos) ? puntos : []).map((txt) => (
              <li key={txt} className="flex items-start gap-2 text-sm text-fg/90"><Check size={16} className={`mt-0.5 shrink-0 ${tono}`} /> {txt}</li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">{acciones}</div>
        </div>
        <div className="relative mt-auto h-48 overflow-hidden sm:h-56" aria-hidden="true">{imagen}</div>
      </article>
    </Revelar>
  );
}

export default function Accesos({ onEnterDashboard }) {
  const { t, i18n } = useTranslation();
  const panel = captura(i18n.language, 'inicio');
  return (
    <section id="accesos" aria-labelledby="accesos-titulo" className="lx-diferido relative mx-auto max-w-7xl px-5 pb-10 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="accesos-titulo" className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          {t('landing.access.title')} <span className="lx-texto">{t('landing.access.titleHighlight')}</span>
        </h2>
        <p className="mt-3 text-muted sm:text-lg">{t('landing.access.subtitle')}</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <Acceso
          id="panel" Icono={LayoutDashboard} color="#93c5fd" tono="text-sky-300"
          acciones={<>
            <EnlacePanel onEnterDashboard={onEnterDashboard} className="lx-btn lx-btn-panel flex-1"><LayoutDashboard size={18} /> {t('landing.access.panel.cta')}</EnlacePanel>
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="lx-btn flex-1"><Plus size={18} /> {t('landing.access.panel.cta2')}</a>
          </>}
          imagen={
            <div className="absolute inset-x-6 top-0 overflow-hidden rounded-t-2xl border border-b-0 border-white/10 sm:inset-x-8">
              <img src={panel.src} srcSet={panel.srcSet} sizes="(min-width: 768px) 560px, 90vw" width={ANCHO} height={ALTO} alt="" loading="lazy" decoding="async" className="block h-auto w-full" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0d0b1c]" />
            </div>
          }
        />
        <Acceso
          id="cuenta" Icono={CircleUserRound} color="#d946ef" tono="text-fuchsia-300" retraso={0.1}
          acciones={<>
            <a href={URL_CUENTA} className="lx-btn lx-btn-cuenta flex-1"><CircleUserRound size={18} /> {t('landing.access.cuenta.cta')}</a>
            <a href="#mi-cuenta" className="lx-btn flex-1"><ArrowDown size={18} /> {t('landing.access.cuenta.cta2')}</a>
          </>}
          imagen={
            <>
              <Movil imagen={capturaMovil(i18n.language, 'cuenta')} sizes="(min-width: 768px) 220px, 42vw" className="absolute left-1/2 top-0 w-[46%] max-w-[220px] -translate-x-1/2" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0d0b1c]" />
            </>
          }
        />
      </div>
    </section>
  );
}
