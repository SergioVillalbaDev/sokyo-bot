// Seguridad · Embudo de bienvenida (Test A/B) — reparte a los nuevos miembros
// entre dos variantes de onboarding y mide cuál retiene mejor. Los resultados se
// ven en Analítica. Aquí se configuran las variantes, la entrega y el rol.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../ui/primitives';
import { FlaskConical, Save, Check, Info, Send, MousePointerClick, Mail, Layers, FileText, LayoutTemplate, BarChart3, Lock, Crown } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const POR_DEFECTO = {
  activo: false, entrega: 'panel', canalId: null, rolVerificadoId: null,
  varianteA: { titulo: '📋 Bienvenido/a — Lee las normas', reglas: '', captcha: true, textoBoton: '✅ Aceptar y acceder' },
  varianteB: { titulo: '👋 ¡Te damos la bienvenida!', descripcion: '', color: '#5865F2', reglas: '', textoBoton: '🎉 Unirme' },
};

function Select({ items, value, onChange, placeholder }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} className={input + ' max-w-xs'}>
      <option value="">{placeholder}</option>
      {items.map((it) => <option key={it.id} value={it.id}>{it.nombre}</option>)}
    </select>
  );
}

// Tarjeta de entrega (panel / MD / ambos), estilo botón seleccionable.
function OpcionEntrega({ activo, onClick, icon: Icon, titulo, desc }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${activo ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}>
      <Icon size={18} className="mt-0.5 text-brand" />
      <span><span className="block font-semibold text-fg">{titulo}</span><span className="text-xs text-muted">{desc}</span></span>
    </button>
  );
}

export default function EmbudoView({ dash }) {
  const { t } = useTranslation();
  const { roles, canales, configServidor, guardarEmbudo, publicarEmbudo, setActiveTab, esPremium } = dash;

  const [e, setE] = useState(POR_DEFECTO);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [pub, setPub] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor) {
      const c = configServidor.embudoAB || {};
      setE({
        ...POR_DEFECTO, ...c,
        varianteA: { ...POR_DEFECTO.varianteA, ...(c.varianteA || {}) },
        varianteB: { ...POR_DEFECTO.varianteB, ...(c.varianteB || {}) },
      });
    }
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const set = (k, val) => { setGuardado(false); setE((prev) => ({ ...prev, [k]: val })); };
  const setA = (k, val) => { setGuardado(false); setE((prev) => ({ ...prev, varianteA: { ...prev.varianteA, [k]: val } })); };
  const setB = (k, val) => { setGuardado(false); setE((prev) => ({ ...prev, varianteB: { ...prev.varianteB, [k]: val } })); };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarEmbudo(e);
    setGuardando(false);
    setGuardado(ok);
  };
  const publicar = async () => {
    setPub('...');
    const r = await publicarEmbudo();
    setPub(r.error ? `error:${r.error}` : 'ok');
  };

  const entregaConPanel = e.entrega === 'panel' || e.entrega === 'ambos';

  // Candado para Free: el embudo A/B es una función Pro.
  if (!esPremium) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40 blur-[3px]">
          <div className={`${card}`}><div className="h-20" /></div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">{[1, 2].map((i) => <div key={i} className={card}><div className="h-44" /></div>)}</div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-on-brand"><Lock size={26} /></span>
          <h3 className="text-lg font-bold text-fg">{t('dashboard.embudo_v.lockTitle')}</h3>
          <p className="max-w-md text-sm text-muted">{t('dashboard.embudo_v.lockDesc')}</p>
          <button type="button" onClick={() => setActiveTab('cuenta-plan')}
            className="mt-1 flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-transform hover:scale-[1.02]">
            <Crown size={16} /> {t('dashboard.embudo_v.lockCta')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.embudo_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.embudo_v.note')}</p>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold text-fg"><FlaskConical size={18} className="text-brand" /> {t('dashboard.embudo_v.enable')}</h3>
          <Toggle checked={e.activo} onChange={(val) => set('activo', val)} />
        </div>

        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {/* Entrega */}
          <div>
            <p className="mb-2 text-sm font-semibold text-fg">{t('dashboard.embudo_v.delivery')}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <OpcionEntrega activo={e.entrega === 'panel'} onClick={() => set('entrega', 'panel')} icon={MousePointerClick} titulo={t('dashboard.embudo_v.deliveryPanel')} desc={t('dashboard.embudo_v.deliveryPanelDesc')} />
              <OpcionEntrega activo={e.entrega === 'md'} onClick={() => set('entrega', 'md')} icon={Mail} titulo={t('dashboard.embudo_v.deliveryMd')} desc={t('dashboard.embudo_v.deliveryMdDesc')} />
              <OpcionEntrega activo={e.entrega === 'ambos'} onClick={() => set('entrega', 'ambos')} icon={Layers} titulo={t('dashboard.embudo_v.deliveryBoth')} desc={t('dashboard.embudo_v.deliveryBothDesc')} />
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embudo_v.role')}</span>
            <Select items={roles} value={e.rolVerificadoId} onChange={(val) => set('rolVerificadoId', val)} placeholder={t('dashboard.embudo_v.rolePh')} />
          </label>
          {entregaConPanel && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embudo_v.channel')}</span>
              <Select items={canales} value={e.canalId} onChange={(val) => set('canalId', val)} placeholder={t('dashboard.embudo_v.channelPh')} />
            </label>
          )}
        </div>
      </div>

      {/* Las dos variantes */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Variante A */}
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand text-sm font-extrabold text-on-brand">A</span>
            <FileText size={16} className="text-brand" /> {t('dashboard.embudo_v.variantA')}
          </h3>
          <p className="mt-1 text-xs text-muted">{t('dashboard.embudo_v.variantADesc')}</p>
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embudo_v.title')}</span>
              <input value={e.varianteA.titulo} onChange={(ev) => setA('titulo', ev.target.value)} className={input} maxLength={256} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embudo_v.rules')}</span>
              <textarea value={e.varianteA.reglas} onChange={(ev) => setA('reglas', ev.target.value)} rows={5} className={input} maxLength={2000} />
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-fg">{t('dashboard.embudo_v.captcha')}<span className="block text-xs font-normal text-muted">{t('dashboard.embudo_v.captchaDesc')}</span></span>
              <Toggle checked={e.varianteA.captcha} onChange={(val) => setA('captcha', val)} />
            </div>
            {!e.varianteA.captcha && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embudo_v.buttonText')}</span>
                <input value={e.varianteA.textoBoton} onChange={(ev) => setA('textoBoton', ev.target.value)} className={input + ' max-w-xs'} maxLength={80} />
              </label>
            )}
          </div>
        </div>

        {/* Variante B */}
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand text-sm font-extrabold text-on-brand">B</span>
            <LayoutTemplate size={16} className="text-brand" /> {t('dashboard.embudo_v.variantB')}
          </h3>
          <p className="mt-1 text-xs text-muted">{t('dashboard.embudo_v.variantBDesc')}</p>
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embudo_v.title')}</span>
              <input value={e.varianteB.titulo} onChange={(ev) => setB('titulo', ev.target.value)} className={input} maxLength={256} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embudo_v.desc')}</span>
              <textarea value={e.varianteB.descripcion} onChange={(ev) => setB('descripcion', ev.target.value)} rows={2} className={input} maxLength={2000} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embudo_v.rules')}</span>
              <textarea value={e.varianteB.reglas} onChange={(ev) => setB('reglas', ev.target.value)} rows={3} className={input} maxLength={2000} />
            </label>
            <label className="flex items-center gap-3">
              <span className="text-sm font-semibold text-fg">{t('dashboard.embudo_v.color')}</span>
              <input type="color" value={e.varianteB.color} onChange={(ev) => setB('color', ev.target.value)} className="h-9 w-14 cursor-pointer rounded-lg border border-line bg-bg" />
              <span className="text-xs text-muted">{e.varianteB.color}</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embudo_v.buttonText')}</span>
              <input value={e.varianteB.textoBoton} onChange={(ev) => setB('textoBoton', ev.target.value)} className={input + ' max-w-xs'} maxLength={80} />
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando || !configServidor}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          <Save size={16} /> {guardando ? t('dashboard.embudo_v.saving') : t('dashboard.embudo_v.save')}
        </button>
        {entregaConPanel && (
          <button type="button" onClick={publicar} disabled={!configServidor || !e.canalId}
            className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50">
            <Send size={16} /> {t('dashboard.embudo_v.publish')}
          </button>
        )}
        <button type="button" onClick={() => setActiveTab('datos-analitica')}
          className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand">
          <BarChart3 size={16} /> {t('dashboard.embudo_v.seeResults')}
        </button>
        {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.embudo_v.saved')}</span>}
        {pub === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.embudo_v.published')}</span>}
        {pub.startsWith('error:') && <span className="text-sm font-semibold text-danger">{pub.slice(6)}</span>}
      </div>
    </div>
  );
}
