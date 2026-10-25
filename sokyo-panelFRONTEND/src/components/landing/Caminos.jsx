// «¿Quién eres?» — dos caminos claros justo después del hero: quien gestiona un
// servidor (añadir el bot / abrir el panel) y quien es miembro de uno (entrar a
// su cuenta). Así nadie tiene que adivinar adónde ir. Textos vía i18n.
import { useTranslation } from 'react-i18next';
import { Crown, CircleUserRound, Plus, LayoutDashboard, ArrowDown, Check } from 'lucide-react';
import { inviteUrl, URL_CUENTA } from '../../lib/landingConfig';
import Revelar from './Revelar';

// Una tarjeta de camino. Revelar va fuera y la tarjeta dentro: así sus
// transiciones (aparecer al hacer scroll / elevarse al pasar) no se pisan.
function Camino({ id, Icono, color, tono, brillo = false, retraso = 0, children }) {
  const { t } = useTranslation();
  const puntos = t(`landing.paths.${id}.points`, { returnObjects: true });
  return (
    <Revelar retraso={retraso} className="flex">
      <div className={`lx-card lx-pulsable flex flex-1 flex-col p-6 sm:p-8 ${brillo ? 'lx-brillo' : ''}`} style={{ '--lx-color': `${color}b3` }}>
        <div className="flex items-center gap-3.5">
          <span className="lx-orbe h-12 w-12" style={{ '--orbe': color }}><Icono size={22} /></span>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider ${tono}`}>{t(`landing.paths.${id}.tag`)}</p>
            <h3 className="text-xl font-extrabold text-fg">{t(`landing.paths.${id}.title`)}</h3>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">{t(`landing.paths.${id}.desc`)}</p>
        <ul className="mt-4 space-y-2">
          {(Array.isArray(puntos) ? puntos : []).map((txt) => (
            <li key={txt} className="flex items-start gap-2 text-sm text-fg/90"><Check size={16} className={`mt-0.5 shrink-0 ${tono}`} /> {txt}</li>
          ))}
        </ul>
        <div className="mt-auto flex flex-col gap-2.5 pt-6 sm:flex-row">{children}</div>
      </div>
    </Revelar>
  );
}

export default function Caminos({ onEnterDashboard }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="caminos-titulo" className="relative mx-auto max-w-7xl px-5 pb-8 sm:px-6">
      <h2 id="caminos-titulo" className="text-center text-sm font-bold uppercase tracking-[.2em] text-muted">{t('landing.paths.title')}</h2>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Camino id="admin" Icono={Crown} color="#60a5fa" tono="text-sky-300">
          <a href={inviteUrl} target="_blank" rel="noreferrer" className="lx-btn lx-btn-discord flex-1"><Plus size={18} /> {t('landing.paths.admin.cta')}</a>
          <button onClick={onEnterDashboard} className="lx-btn flex-1"><LayoutDashboard size={18} /> {t('landing.paths.admin.cta2')}</button>
        </Camino>
        <Camino id="member" Icono={CircleUserRound} color="#d946ef" tono="text-fuchsia-300" brillo retraso={0.1}>
          <a href={URL_CUENTA} className="lx-btn lx-btn-cuenta flex-1"><CircleUserRound size={18} /> {t('landing.paths.member.cta')}</a>
          <a href="#mi-cuenta" className="lx-btn flex-1"><ArrowDown size={18} /> {t('landing.paths.member.cta2')}</a>
        </Camino>
      </div>
    </section>
  );
}
