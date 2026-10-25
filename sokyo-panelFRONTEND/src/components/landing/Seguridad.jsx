// «Seguro y bajo tu control»: cómo se entra, quién ve qué y qué queda
// registrado. Solo lo que el producto hace de verdad. Textos vía i18n.
import { useTranslation } from 'react-i18next';
import { Fingerprint, KeyRound, ScrollText, DatabaseBackup, Timer, ShieldCheck } from 'lucide-react';
import Revelar from './Revelar';

const PIEZAS = [
  { Icono: Fingerprint, color: '#5865f2' },
  { Icono: KeyRound, color: '#fbbf24' },
  { Icono: ScrollText, color: '#34d399' },
  { Icono: Timer, color: '#d946ef' },
  { Icono: DatabaseBackup, color: '#60a5fa' },
  { Icono: ShieldCheck, color: '#f87171' },
];

export default function Seguridad() {
  const { t } = useTranslation();
  const items = t('landing.security.items', { returnObjects: true });
  return (
    <section id="seguridad" className="lx-diferido relative mx-auto max-w-7xl px-5 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="lx-etiqueta">{t('landing.security.eyebrow')}</span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.security.title')} <span className="lx-texto">{t('landing.security.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.security.subtitle')}</p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(Array.isArray(items) ? items : []).map((it, i) => {
          const { Icono, color } = PIEZAS[i] || PIEZAS[0];
          return (
            <Revelar key={it.title} retraso={Math.min(i, 3) * 0.06} className="flex">
              <div className="lx-card lx-pulsable flex flex-1 gap-4 p-5" style={{ '--lx-color': `${color}b3` }}>
                <span className="lx-orbe h-11 w-11" style={{ '--orbe': color }}><Icono size={19} /></span>
                <div className="min-w-0">
                  <h3 className="font-bold text-fg">{it.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{it.desc}</p>
                </div>
              </div>
            </Revelar>
          );
        })}
      </div>
    </section>
  );
}
