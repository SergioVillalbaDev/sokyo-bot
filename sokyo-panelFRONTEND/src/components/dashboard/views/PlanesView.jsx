// Mi Plan — superficie de venta dentro del panel: muestra el plan actual y deja
// subir a Pro / Agencia (Stripe Checkout) o gestionar la suscripción (Portal).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, Check, Sparkles, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';

// Precios de ESCAPARATE (deben coincidir con los precios que crees en Stripe).
const PRECIO = {
  free: { month: '0€', year: '0€' },
  pro: { month: '5€', year: '50€' },
  agency: { month: '25€', year: '250€' },
};

const ORDEN = [
  { id: 'free', destacado: false },
  { id: 'pro', destacado: true },
  { id: 'agency', destacado: false },
];

// Tarjeta de un plan. A nivel de módulo por la regla react-hooks (v7).
function TierCard({ id, destacado, t, intervalo, planActual, pagosActivos, cargando, onAccion }) {
  const tier = t(`dashboard.planes_v.tiers.${id}`, { returnObjects: true });
  const esActual = planActual === id;
  const precio = id === 'free' ? '0€' : PRECIO[id][intervalo];
  const periodo = id === 'free'
    ? t('dashboard.planes_v.forever')
    : intervalo === 'year' ? t('dashboard.planes_v.perYear') : t('dashboard.planes_v.perMonth');

  let etiquetaBtn = t('dashboard.planes_v.cta.choose');
  if (esActual) etiquetaBtn = t('dashboard.planes_v.cta.current');
  else if (id === 'pro') etiquetaBtn = t('dashboard.planes_v.cta.upgrade');

  const deshabilitado = id === 'free' || esActual || !pagosActivos || cargando;

  return (
    <div className={`relative flex flex-col rounded-3xl border p-6 ${destacado ? 'border-brand/50 bg-card shadow-soft' : 'border-line bg-card/60'}`}>
      {destacado && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-3 py-1 text-xs font-bold text-on-brand shadow-lg">
            <Sparkles size={13} /> {t('dashboard.planes_v.recommended')}
          </span>
        </div>
      )}
      <h3 className="text-lg font-bold text-fg">{tier.name}</h3>
      <p className="mt-1 text-sm text-muted">{tier.desc}</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight text-fg">{precio}</span>
        <span className="text-sm text-muted">{periodo}</span>
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-fg/90">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${destacado ? 'bg-gradient-brand text-on-brand' : 'bg-elevated text-brand'}`}>
              <Check size={13} strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={deshabilitado}
        onClick={() => onAccion(id, intervalo)}
        className={`mt-6 flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold transition-opacity ${
          destacado ? 'bg-gradient-brand text-on-brand' : 'border border-line bg-elevated text-fg'
        } hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {cargando && <Loader2 size={16} className="animate-spin" />}
        {etiquetaBtn}
      </button>
    </div>
  );
}

export default function PlanesView({ dash }) {
  const { t } = useTranslation();
  const { billing, irACheckout, abrirPortalPago } = dash;

  const [intervalo, setIntervalo] = useState('month'); // 'month' | 'year'
  const [cargandoId, setCargandoId] = useState(''); // qué botón está en marcha
  const [error, setError] = useState('');

  // Aviso de vuelta del pago (?pago=ok | ?pago=cancelado).
  const [aviso] = useState(() => new URLSearchParams(window.location.search).get('pago') || '');

  const planActual = (billing && billing.plan) || 'free';
  const pagosActivos = !!(billing && billing.pagosActivos);
  const tieneSuscripcion = !!(billing && billing.tieneSuscripcion);

  const fecha = billing && billing.premiumHasta
    ? new Date(billing.premiumHasta).toLocaleDateString()
    : null;

  const accion = async (id) => {
    setError('');
    setCargandoId(id);
    const r = await irACheckout(id, intervalo);
    if (r && r.error) { setError(r.error); setCargandoId(''); }
    // Si va bien, irACheckout redirige a Stripe (no hace falta limpiar el estado).
  };

  const gestionar = async () => {
    setError('');
    setCargandoId('portal');
    const r = await abrirPortalPago();
    if (r && r.error) { setError(r.error); setCargandoId(''); }
  };

  return (
    <div className="space-y-6">
      {/* Avisos de retorno del pago */}
      {aviso === 'ok' && (
        <div className="flex items-center gap-2 rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          {t('dashboard.planes_v.payOk')}
        </div>
      )}
      {aviso === 'cancelado' && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">
          {t('dashboard.planes_v.payCancel')}
        </div>
      )}

      {/* Cabecera: plan actual */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-brand text-on-brand">
            <Crown size={22} />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t('dashboard.planes_v.currentPlan')}</p>
            <p className="text-lg font-bold text-fg">{t(`dashboard.planes_v.tiers.${planActual}.name`)}</p>
          </div>
        </div>
        {planActual !== 'free' && (
          <p className="text-sm text-muted">
            {!fecha ? t('dashboard.planes_v.lifetime')
              : billing.cancelaAlFinal ? t('dashboard.planes_v.cancels', { date: fecha })
                : t('dashboard.planes_v.renews', { date: fecha })}
          </p>
        )}
      </div>

      <p className="text-sm text-muted">{t('dashboard.planes_v.intro')}</p>

      {/* Conmutador mensual / anual */}
      <div className="flex items-center justify-center gap-1 rounded-2xl border border-line bg-elevated p-1 w-fit mx-auto">
        {['month', 'year'].map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => setIntervalo(iv)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              intervalo === iv ? 'bg-gradient-brand text-on-brand' : 'text-muted hover:text-fg'
            }`}
          >
            {t(`dashboard.planes_v.billing.${iv}`)}
            {iv === 'year' && (
              <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                {t('dashboard.planes_v.billing.saveBadge')}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tarjetas de los 3 planes */}
      <div className="grid gap-5 md:grid-cols-3">
        {ORDEN.map((o) => (
          <TierCard
            key={o.id}
            id={o.id}
            destacado={o.destacado}
            t={t}
            intervalo={intervalo}
            planActual={planActual}
            pagosActivos={pagosActivos}
            cargando={cargandoId === o.id}
            onAccion={accion}
          />
        ))}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {/* Pagos no configurados todavía */}
      {billing && !pagosActivos && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-xs text-muted">{t('dashboard.planes_v.notConfigured')}</p>
        </div>
      )}

      {/* Gestionar suscripción (si ya hay cliente en Stripe) */}
      {tieneSuscripcion && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-card p-5 shadow-soft">
          <div>
            <h3 className="font-bold text-fg">{t('dashboard.planes_v.manageTitle')}</h3>
            <p className="mt-1 text-xs text-muted">{t('dashboard.planes_v.manageDesc')}</p>
          </div>
          <button
            type="button"
            disabled={cargandoId === 'portal'}
            onClick={gestionar}
            className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:opacity-50"
          >
            {cargandoId === 'portal' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
            {t('dashboard.planes_v.manageBtn')}
          </button>
        </div>
      )}
    </div>
  );
}
