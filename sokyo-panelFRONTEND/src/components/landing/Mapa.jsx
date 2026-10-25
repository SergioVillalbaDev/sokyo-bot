// «Así está organizado el panel»: los tres bloques del menú del panel de control
// con cada grupo y sus secciones, para que se sepa dónde está cada cosa antes de
// entrar. La estructura sale de navConfig (la misma del menú, así no se queda
// desfasada); los nombres, de landing.map (iguales que los del menú).
import { useTranslation } from 'react-i18next';
import { Crown } from 'lucide-react';
import { navSections, navGroups } from '../dashboard/navConfig';
import Revelar from './Revelar';

const GRUPOS = Object.fromEntries(navGroups.filter((g) => !g.owner).map((g) => [g.id, g]));
// El bloque con más grupos va solo en su columna.
const MAYOR = navSections.reduce((a, b) => (b.groups.length > a.groups.length ? b : a));
const ORDEN = ['order-1', 'order-2', 'order-3', 'order-4'];

// Un bloque del menú (Día a día, Tu comunidad, Administración) con sus grupos.
function Bloque({ sec }) {
  const { t } = useTranslation();
  const i = navSections.indexOf(sec);
  return (
    <Revelar retraso={i * 0.08} className={`${ORDEN[i] || ''} lg:order-none`}>
      <div className="lx-card p-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">{t(`landing.map.sections.${sec.id}`)}</p>
        <div className="mt-4 flex flex-col gap-5">
          {sec.groups.filter((id) => GRUPOS[id]).map((id) => {
            const g = GRUPOS[id];
            return (
              <div key={id}>
                <h3 className="flex items-center gap-2.5 font-bold text-fg">
                  <span className="lx-orbe h-8 w-8 rounded-xl" style={{ '--orbe': g.color }}><g.icon size={15} /></span>
                  {t(`landing.map.groups.${id}`)}
                </h3>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {g.items.map((it) => (
                    <li key={it.tab} className="lx-chip text-[12px] font-medium text-fg/90">
                      {t(`landing.map.items.${it.tab}`)}
                      {it.premium && <Crown size={11} className="text-amber-300" aria-label="Pro" />}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </Revelar>
  );
}

export default function Mapa() {
  const { t } = useTranslation();
  return (
    <section id="mapa" className="lx-diferido relative mx-auto max-w-7xl px-5 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="lx-etiqueta">{t('landing.map.eyebrow')}</span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.map.title')} <span className="lx-texto">{t('landing.map.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.map.subtitle')}</p>
      </div>

      {/* En el escritorio, el bloque más grande («Tu comunidad») a la derecha y los
          otros dos apilados a la izquierda; en el móvil, en el orden del menú
          (la columna de la izquierda es «contents»: sus tarjetas se ordenan con order). */}
      <div className="mt-12 grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          {navSections.filter((sec) => sec !== MAYOR).map((sec) => <Bloque key={sec.id} sec={sec} />)}
        </div>
        <Bloque sec={MAYOR} />
      </div>
      <p className="mt-6 text-center text-xs text-muted"><Crown size={12} className="mb-0.5 mr-1 inline text-amber-300" />{t('landing.map.proNote')}</p>
    </section>
  );
}
