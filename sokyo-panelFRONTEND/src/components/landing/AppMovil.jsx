// «El panel, también en el móvil»: la app de Android (descarga directa de la
// APK) y cómo tenerlo en el iPhone, con una captura real del panel en el móvil.
// Se destaca la opción del dispositivo desde el que se mira. Textos vía i18n.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Smartphone, Share, SquarePlus, Check, CircleUserRound, Compass } from 'lucide-react';
import { APK_URL, APK_VERSION, APK_MB, dispositivo } from '../../lib/appMovil';
import Revelar from './Revelar';
import { Movil } from './Marcos';
import { capturaMovil } from './capturas';

export default function AppMovil() {
  const { t, i18n } = useTranslation();
  const [disp] = useState(dispositivo);
  const puntos = t('landing.app.points', { returnObjects: true });
  const pasosIos = t('landing.app.ios.steps', { returnObjects: true });
  const tamano = APK_MB.toLocaleString(i18n.language, { maximumFractionDigits: 1 });

  return (
    <section id="app" className="lx-diferido relative mx-auto max-w-7xl px-5 py-20 sm:px-6">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <span className="lx-etiqueta"><Smartphone size={13} /> {t('landing.app.eyebrow')}</span>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
            {t('landing.app.title')} <span className="lx-texto">{t('landing.app.titleHighlight')}</span>
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted">{t('landing.app.subtitle')}</p>
          <ul className="mt-6 space-y-2">
            {(Array.isArray(puntos) ? puntos : []).map((txt) => (
              <li key={txt} className="flex items-start gap-2 text-sm text-fg/90"><Check size={16} className="mt-0.5 shrink-0 text-emerald-300" /> {txt}</li>
            ))}
          </ul>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Revelar className="flex">
              <div className={`lx-card flex flex-1 flex-col p-5 ${disp === 'android' ? 'lx-brillo lx-halo' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="lx-orbe h-10 w-10 rounded-xl" style={{ '--orbe': '#34d399' }}><Smartphone size={18} /></span>
                  <div>
                    <h3 className="font-bold text-fg">{t('landing.app.android.title')}</h3>
                    <p className="text-xs text-muted">{t('landing.app.android.meta', { version: APK_VERSION, mb: tamano })}</p>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{t('landing.app.android.desc')}</p>
                <a href={APK_URL} download className="lx-btn lx-btn-discord mt-5 w-full text-sm">
                  <Download size={17} /> {t('landing.app.android.cta')}
                </a>
                <p className="mt-2.5 text-[11px] leading-snug text-muted">{t('landing.app.android.note')}</p>
              </div>
            </Revelar>
            <Revelar retraso={0.08} className="flex">
              <div className={`lx-card flex flex-1 flex-col p-5 ${disp === 'ios' ? 'lx-brillo lx-halo' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="lx-orbe h-10 w-10 rounded-xl" style={{ '--orbe': '#94a3b8' }}><Smartphone size={18} /></span>
                  <div>
                    <h3 className="font-bold text-fg">{t('landing.app.ios.title')}</h3>
                    <p className="text-xs text-muted">{t('landing.app.ios.meta')}</p>
                  </div>
                </div>
                <ol className="mt-3 space-y-2">
                  {(Array.isArray(pasosIos) ? pasosIos : []).map((txt, i) => {
                    const Icono = [Compass, Share, SquarePlus][i] || Check;
                    return (
                      <li key={txt} className="flex items-start gap-2.5 text-sm text-muted">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[.07] text-fg"><Icono size={12} /></span> {txt}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </Revelar>
          </div>
          <p className="mt-5 flex items-start gap-2 text-sm text-muted">
            <CircleUserRound size={16} className="mt-0.5 shrink-0 text-fuchsia-300" /> {t('landing.app.account')}
          </p>
        </div>

        <Revelar retraso={0.1} className="relative mx-auto w-full max-w-[300px]">
          <div className="sk-halo pointer-events-none absolute left-1/2 top-1/2 h-[80%] w-[160%] -translate-x-1/2 -translate-y-1/2" style={{ '--halo': 'rgba(52, 211, 153, .22)' }} />
          <Movil imagen={capturaMovil(i18n.language, 'inicio')} sizes="300px" alt={t('landing.app.alt')} className="relative" />
        </Revelar>
      </div>
    </section>
  );
}
