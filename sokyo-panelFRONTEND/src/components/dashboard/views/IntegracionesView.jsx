// Webhooks salientes (Pro) — avisa a un endpoint externo (Slack, Discord, n8n,
// Zapier o propio) cuando pasa algo: ticket nuevo, sanción o raid.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Webhook, Save, Check, Info, Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const EVENTOS = ['ticketNuevo', 'sancion', 'raid'];

const POR_DEFECTO = {
  activo: false, url: '', secret: '',
  eventos: { ticketNuevo: true, sancion: true, raid: true },
};

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-brand' : 'bg-line'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function IntegracionesView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, guardarWebhooks, probarWebhook } = dash;

  const [w, setW] = useState(POR_DEFECTO);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [probando, setProbando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor) {
      const g = configServidor.webhooksSalientes || {};
      setW({
        activo: !!g.activo,
        url: g.url || '',
        secret: g.secret || '',
        eventos: { ...POR_DEFECTO.eventos, ...(g.eventos || {}) },
      });
    }
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = (clave, valor) => { setGuardado(false); setW((prev) => ({ ...prev, [clave]: valor })); };
  const setEvento = (ev, valor) => { setGuardado(false); setW((prev) => ({ ...prev, eventos: { ...prev.eventos, [ev]: valor } })); };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarWebhooks(w);
    setGuardando(false);
    setGuardado(ok);
  };

  const probar = async () => {
    setProbando(true); setResultadoPrueba(null);
    const r = await probarWebhook({ url: w.url, secret: w.secret });
    setProbando(false);
    setResultadoPrueba(r);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.webhooks_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.webhooks_v.note')}</p>
      </div>

      {/* Interruptor + URL */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold text-fg"><Webhook size={18} className="text-brand" /> {t('dashboard.webhooks_v.title')}</h3>
          <Toggle on={w.activo} onChange={(v) => set('activo', v)} />
        </div>

        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.webhooks_v.url')}</label>
            <input
              value={w.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand"
            />
            <p className="mt-1 text-xs text-muted">{t('dashboard.webhooks_v.urlHint')}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.webhooks_v.secret')}</label>
            <input
              value={w.secret}
              onChange={(e) => set('secret', e.target.value)}
              placeholder={t('dashboard.webhooks_v.secretPh')}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand"
            />
            <p className="mt-1 text-xs text-muted">{t('dashboard.webhooks_v.secretHint')}</p>
          </div>

          {/* Probar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={probar}
              disabled={probando || !/^https:\/\//i.test(w.url)}
              className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {probando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {t('dashboard.webhooks_v.test')}
            </button>
            {resultadoPrueba && (
              resultadoPrueba.success
                ? <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 size={16} /> {t('dashboard.webhooks_v.testOk', { status: resultadoPrueba.status })}</span>
                : <span className="flex items-center gap-1.5 text-sm font-semibold text-danger"><AlertCircle size={16} /> {t('dashboard.webhooks_v.testFail', { detail: resultadoPrueba.error || resultadoPrueba.status })}</span>
            )}
          </div>
        </div>
      </div>

      {/* Eventos */}
      <div className={card}>
        <h3 className="mb-1 font-bold text-fg">{t('dashboard.webhooks_v.eventsTitle')}</h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.webhooks_v.eventsDesc')}</p>
        <div className="space-y-3">
          {EVENTOS.map((ev) => (
            <label key={ev} className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg">{t(`dashboard.webhooks_v.events.${ev}`)}</span>
              <Toggle on={!!w.eventos[ev]} onChange={(v) => setEvento(ev, v)} />
            </label>
          ))}
        </div>
      </div>

      {/* Guardar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !configServidor}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} /> {guardando ? t('dashboard.webhooks_v.saving') : t('dashboard.webhooks_v.save')}
        </button>
        {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.webhooks_v.saved')}</span>}
      </div>
    </div>
  );
}
