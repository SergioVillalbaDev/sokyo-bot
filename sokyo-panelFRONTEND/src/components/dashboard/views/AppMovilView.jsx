// App móvil: descargar la app de Android (APK) o, en iPhone y iPad, usar el
// panel desde Safari con un icono en la pantalla de inicio. Destaca la opción
// del dispositivo desde el que se mira y, dentro de la app, lo dice.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, TabletSmartphone, Download, Share, SquarePlus, Copy, Check, RefreshCw, ShieldCheck, KeyRound, LayoutDashboard, CheckCircle2, ScanQrCode } from 'lucide-react';
import { APK_URL, APK_VERSION, APK_MB, enLaAppAndroid, dispositivo } from '../../../lib/appMovil';
import { QR_LADO, QR_TRAZO } from './appMovilQr';
import { cn } from '../../../lib/cn';

const VERDE_ANDROID = '#3ddc84';
const AZUL_IOS = '#60a5fa';
const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft sm:p-6';

function Paso({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-bold text-fg ring-1 ring-line">{n}</span>
      <span className="pt-0.5 text-sm text-muted">{children}</span>
    </li>
  );
}

function Etiqueta({ children }) {
  return <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[11px] font-bold text-brand">{children}</span>;
}

export default function AppMovilView() {
  const { t, i18n } = useTranslation();
  const [copiado, setCopiado] = useState(false);
  const disp = dispositivo();
  const enApp = enLaAppAndroid();
  const enlace = `${window.location.origin}/panel`;
  const tamano = APK_MB.toLocaleString(i18n.language, { maximumFractionDigits: 1 });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
    } catch {
      // Sin permiso de portapapeles (http o navegador antiguo): selección a mano.
      const campo = document.createElement('textarea');
      campo.value = enlace;
      document.body.appendChild(campo);
      campo.select();
      try { document.execCommand('copy'); } catch { /* nada más que hacer */ }
      campo.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const ventajas = [
    { icono: LayoutDashboard, texto: t('dashboard.app_v.perkFull') },
    { icono: RefreshCw, texto: t('dashboard.app_v.perkUpdates') },
    { icono: KeyRound, texto: t('dashboard.app_v.perkLogin') },
  ];

  const android = (
    <section data-help="app-android" className={cn(card, 'flex flex-col', disp === 'android' && 'ring-2 ring-brand/40')} style={{ '--grupo': VERDE_ANDROID }}>
      <div className="flex items-start gap-3">
        <span className="sk-icono-grupo h-11 w-11"><Smartphone size={21} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-fg">Android</h3>
            {disp === 'android' && <Etiqueta>{t('dashboard.app_v.yourDevice')}</Etiqueta>}
          </div>
          <p className="text-xs text-muted">{t('dashboard.app_v.androidMeta', { version: APK_VERSION, size: tamano })}</p>
        </div>
      </div>

      {enApp ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-semibold text-fg">{t('dashboard.app_v.inAppTitle')}</p>
            <p className="text-xs text-muted">{t('dashboard.app_v.inAppDesc')}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href={APK_URL} download="sokyo-panel.apk"
              className="sk-foco inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-5 py-3 text-sm font-bold text-on-brand shadow-soft transition-opacity hover:opacity-90"
            >
              <Download size={17} /> {t('dashboard.app_v.download')}
            </a>
            {/* En el ordenador: escanear con el móvil es lo más cómodo. */}
            {disp === 'ordenador' && (
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-white p-2 shadow-soft">
                  <svg viewBox={`0 0 ${QR_LADO} ${QR_LADO}`} width="88" height="88" shapeRendering="crispEdges" role="img" aria-label={t('dashboard.app_v.qrAlt')}>
                    <path d={QR_TRAZO} stroke="#0b0c0e" fill="none" />
                  </svg>
                </span>
                <p className="flex max-w-[11rem] items-start gap-1.5 text-xs text-muted"><ScanQrCode size={15} className="mt-px shrink-0 text-brand" /> {t('dashboard.app_v.qrHint')}</p>
              </div>
            )}
          </div>

          <ol className="mt-5 space-y-3">
            <Paso n={1}>{t(disp === 'ordenador' ? 'dashboard.app_v.androidStep1Desktop' : 'dashboard.app_v.androidStep1')}</Paso>
            <Paso n={2}>{t('dashboard.app_v.androidStep2')}</Paso>
            <Paso n={3}>{t('dashboard.app_v.androidStep3')}</Paso>
          </ol>
        </>
      )}

      <p className="mt-auto pt-5 text-[11px] text-muted">{t('dashboard.app_v.androidReq')}</p>
    </section>
  );

  const ios = (
    <section data-help="app-ios" className={cn(card, 'flex flex-col', disp === 'ios' && 'ring-2 ring-brand/40')} style={{ '--grupo': AZUL_IOS }}>
      <div className="flex items-start gap-3">
        <span className="sk-icono-grupo h-11 w-11"><TabletSmartphone size={21} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-fg">{t('dashboard.app_v.iosTitle')}</h3>
            {disp === 'ios' && <Etiqueta>{t('dashboard.app_v.yourDevice')}</Etiqueta>}
          </div>
          <p className="text-xs text-muted">{t('dashboard.app_v.iosMeta')}</p>
        </div>
      </div>

      <p className="mt-5 text-sm text-muted">{t('dashboard.app_v.iosIntro')}</p>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-elevated py-1.5 pl-4 pr-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">{enlace.replace(/^https?:\/\//, '')}</span>
        <button onClick={copiar} className="sk-foco inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/10" aria-live="polite">
          {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? t('dashboard.app_v.copied') : t('dashboard.app_v.copy')}
        </button>
      </div>

      <ol className="mt-5 space-y-3">
        <Paso n={1}>{t('dashboard.app_v.iosStep1')}</Paso>
        <Paso n={2}>
          <span className="inline-flex flex-wrap items-center gap-1">{t('dashboard.app_v.iosStep2')} <Share size={14} className="text-brand" aria-hidden="true" /></span>
        </Paso>
        <Paso n={3}>
          <span className="inline-flex flex-wrap items-center gap-1">{t('dashboard.app_v.iosStep3')} <SquarePlus size={14} className="text-brand" aria-hidden="true" /></span>
        </Paso>
      </ol>

      <p className="mt-auto pt-5 text-[11px] text-muted">{t('dashboard.app_v.iosReq')}</p>
    </section>
  );

  const preguntas = ['safe', 'updates', 'warning', 'desktop'];

  return (
    <div className="space-y-5">
      {/* Presentación */}
      <div className="sk-glass sk-brillo relative overflow-hidden rounded-3xl border border-line bg-card p-6 shadow-soft">
        <div className="flex items-start gap-4 sm:items-center sm:gap-5">
          <span className="sk-orbe h-12 w-12 shrink-0 sm:h-16 sm:w-16" style={{ '--grupo': 'var(--accent-color)' }}><Smartphone className="h-6 w-6 sm:h-[30px] sm:w-[30px]" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold text-fg sm:text-2xl">{t('dashboard.app_v.heroTitle')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{t('dashboard.app_v.heroDesc')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ventajas.map(({ icono: Icono, texto }) => (
                <span key={texto} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-elevated px-3 py-1 text-xs font-semibold text-fg">
                  <Icono size={13} className="text-brand" /> {texto}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* La opción del dispositivo actual va primero. */}
      <div className="grid gap-5 lg:grid-cols-2">
        {disp === 'ios' ? <>{ios}{android}</> : <>{android}{ios}</>}
      </div>

      <section data-help="app-faq" className={card}>
        <h3 className="flex items-center gap-2 font-bold text-fg"><ShieldCheck size={18} className="text-brand" /> {t('dashboard.app_v.faqTitle')}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {preguntas.map((p) => (
            <div key={p} className="rounded-2xl border border-line bg-elevated/60 p-4">
              <p className="text-sm font-semibold text-fg">{t(`dashboard.app_v.faq.${p}.q`)}</p>
              <p className="mt-1 text-sm text-muted">{t(`dashboard.app_v.faq.${p}.a`)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
