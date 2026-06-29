// Seguridad · Verificación de entrada — configura el gate (botón o captcha) y
// publica el panel de verificación en un canal.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../ui/primitives';
import { ShieldCheck, Save, Check, Info, Send, MousePointerClick, Puzzle } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const POR_DEFECTO = {
  activo: false, canalId: null, rolVerificadoId: null, modo: 'boton',
  titulo: '🔒 Verification', descripcion: 'Click the button to verify and access the server.', textoBoton: '✅ Verify me',
};

function Select({ items, value, onChange, placeholder }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} className={input + ' max-w-xs'}>
      <option value="">{placeholder}</option>
      {items.map((it) => <option key={it.id} value={it.id}>{it.nombre}</option>)}
    </select>
  );
}

export default function VerificacionView({ dash }) {
  const { t } = useTranslation();
  const { roles, canales, configServidor, guardarVerificacion, publicarVerificacion } = dash;

  const [v, setV] = useState(POR_DEFECTO);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [pub, setPub] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor) setV({ ...POR_DEFECTO, ...(configServidor.verificacion || {}) });
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = (k, val) => { setGuardado(false); setV((prev) => ({ ...prev, [k]: val })); };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarVerificacion(v);
    setGuardando(false);
    setGuardado(ok);
  };
  const publicar = async () => {
    setPub('...');
    const r = await publicarVerificacion();
    setPub(r.error ? `error:${r.error}` : 'ok');
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.verif_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.verif_v.note')}</p>
      </div>

      <div className={card}>
        <div data-help="verif-enable" className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold text-fg"><ShieldCheck size={18} className="text-brand" /> {t('dashboard.verif_v.enable')}</h3>
          <Toggle checked={v.activo} onChange={(val) => set('activo', val)} />
        </div>

        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {/* Modo */}
          <div data-help="verif-modo">
            <p className="mb-2 text-sm font-semibold text-fg">{t('dashboard.verif_v.mode')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => set('modo', 'boton')}
                className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${v.modo === 'boton' ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}
              >
                <MousePointerClick size={18} className="mt-0.5 text-brand" />
                <span><span className="block font-semibold text-fg">{t('dashboard.verif_v.modeButton')}</span><span className="text-xs text-muted">{t('dashboard.verif_v.modeButtonDesc')}</span></span>
              </button>
              <button
                type="button"
                onClick={() => set('modo', 'captcha')}
                className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${v.modo === 'captcha' ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}
              >
                <Puzzle size={18} className="mt-0.5 text-brand" />
                <span><span className="block font-semibold text-fg">{t('dashboard.verif_v.modeCaptcha')}</span><span className="text-xs text-muted">{t('dashboard.verif_v.modeCaptchaDesc')}</span></span>
              </button>
            </div>
          </div>

          <label data-help="verif-campos" className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.role')}</span>
            <Select items={roles} value={v.rolVerificadoId} onChange={(val) => set('rolVerificadoId', val)} placeholder={t('dashboard.verif_v.rolePh')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.channel')}</span>
            <Select items={canales} value={v.canalId} onChange={(val) => set('canalId', val)} placeholder={t('dashboard.verif_v.channelPh')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.title')}</span>
            <input value={v.titulo} onChange={(e) => set('titulo', e.target.value)} className={input} maxLength={256} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.desc')}</span>
            <textarea value={v.descripcion} onChange={(e) => set('descripcion', e.target.value)} rows={2} className={input} maxLength={2000} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.buttonText')}</span>
            <input value={v.textoBoton} onChange={(e) => set('textoBoton', e.target.value)} className={input + ' max-w-xs'} maxLength={80} />
          </label>
        </div>
      </div>

      <div data-help="verif-acciones" className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !configServidor}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} /> {guardando ? t('dashboard.verif_v.saving') : t('dashboard.verif_v.save')}
        </button>
        <button
          type="button"
          onClick={publicar}
          disabled={!configServidor || !v.canalId}
          className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} /> {t('dashboard.verif_v.publish')}
        </button>
        {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.verif_v.saved')}</span>}
        {pub === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.verif_v.published')}</span>}
        {pub.startsWith('error:') && <span className="text-sm font-semibold text-danger">{pub.slice(6)}</span>}
      </div>
    </div>
  );
}
