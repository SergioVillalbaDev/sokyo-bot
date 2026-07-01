// Seguridad · Verificación de entrada — puerta de entrada al servidor. Tres modos:
//  - Un clic: botón que concede el rol.
//  - Captcha: el usuario resuelve un código de imagen.
//  - Doble bienvenida (Pro): reparte a cada nuevo entre dos versiones de
//    bienvenida y mide cuál retiene mejor (motor embudoAB del backend).
// El mensaje del panel (modos Un clic/Captcha) es un embed totalmente
// personalizable (color, imagen, GIF, campos…), como el resto del panel.
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../ui/primitives';
import { ShieldCheck, Save, Check, Info, Send, MousePointerClick, Puzzle, Users, Crown, Lock, FileText, LayoutTemplate, BarChart3 } from 'lucide-react';
import EmbedBuilder from './EmbedBuilder';
import { EMBED_VACIO } from './embedDefaults';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const VERIF_DEF = {
  activo: false, canalId: null, rolVerificadoId: null, modo: 'boton',
  titulo: '🔒 Verification', descripcion: 'Click the button to verify and access the server.',
  textoBoton: '✅ Verify me', embed: null,
};
const AB_DEF = {
  activo: false, entrega: 'panel', canalId: null, rolVerificadoId: null,
  varianteA: { titulo: '📋 Welcome — Read the rules', reglas: '', captcha: true, textoBoton: '✅ Accept and enter' },
  varianteB: { titulo: '👋 Welcome!', descripcion: '', color: '#5865F2', reglas: '', textoBoton: '🎉 Join' },
};

function Select({ items, value, onChange, placeholder }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} className={input + ' max-w-xs'}>
      <option value="">{placeholder}</option>
      {items.map((it) => <option key={it.id} value={it.id}>{it.nombre}</option>)}
    </select>
  );
}

// Tarjeta de un modo (Un clic / Captcha / Doble bienvenida).
function ModoCard({ activo, onClick, icon: Icon, titulo, desc, premium, bloqueado }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${activo ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}>
      <Icon size={18} className="mt-0.5 text-brand" />
      <span><span className="block font-semibold text-fg">{titulo}</span><span className="text-xs text-muted">{desc}</span></span>
      {premium && <Crown size={14} className={`absolute right-2 top-2 ${bloqueado ? 'text-amber-400' : 'text-amber-400/70'}`} />}
    </button>
  );
}

// Tarjeta de entrega del A/B (panel / MD / ambos).
function OpcionEntrega({ activo, onClick, icon: Icon, titulo, desc }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${activo ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}>
      <Icon size={18} className="mt-0.5 text-brand" />
      <span><span className="block font-semibold text-fg">{titulo}</span><span className="text-xs text-muted">{desc}</span></span>
    </button>
  );
}

export default function VerificacionView({ dash }) {
  const { t } = useTranslation();
  const {
    roles, canales, configServidor, esPremium, setActiveTab, subirImagen,
    guardarVerificacion, publicarVerificacion, guardarEmbudo, publicarEmbudo,
  } = dash;

  const [modo, setModo] = useState('boton'); // 'boton' | 'captcha' | 'ab'
  const [v, setV] = useState(VERIF_DEF);
  const [e, setE] = useState(AB_DEF);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [pub, setPub] = useState('');
  const modoInit = useRef(false); // el modo se elige una vez; guardar no debe cambiarlo

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!configServidor) return;
    const vv = { ...VERIF_DEF, ...(configServidor.verificacion || {}) };
    setV(vv);
    const ab = configServidor.embudoAB || {};
    setE({
      ...AB_DEF, ...ab,
      varianteA: { ...AB_DEF.varianteA, ...(ab.varianteA || {}) },
      varianteB: { ...AB_DEF.varianteB, ...(ab.varianteB || {}) },
    });
    // Modo inicial SOLO la primera vez: si la Doble bienvenida está activa,
    // arrancamos ahí. Después lo controla el usuario (guardar no lo cambia).
    if (!modoInit.current) {
      modoInit.current = true;
      setModo(ab.activo ? 'ab' : (vv.modo === 'captcha' ? 'captcha' : 'boton'));
    }
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setVerif = (k, val) => { setGuardado(false); setV((prev) => ({ ...prev, [k]: val })); };
  const setAB = (k, val) => { setGuardado(false); setE((prev) => ({ ...prev, [k]: val })); };
  const setA = (k, val) => { setGuardado(false); setE((prev) => ({ ...prev, varianteA: { ...prev.varianteA, [k]: val } })); };
  const setB = (k, val) => { setGuardado(false); setE((prev) => ({ ...prev, varianteB: { ...prev.varianteB, [k]: val } })); };

  // Elegir modo. Un clic / Captcha guardan también el `modo` de verificación.
  const elegirModo = (m) => {
    setGuardado(false); setPub(''); setModo(m);
    if (m === 'boton' || m === 'captcha') setV((prev) => ({ ...prev, modo: m }));
  };

  const esAB = modo === 'ab';

  const guardar = async () => {
    setGuardando(true);
    const ok = esAB ? await guardarEmbudo(e) : await guardarVerificacion(v);
    setGuardando(false);
    setGuardado(ok);
  };
  const publicar = async () => {
    setPub('...');
    const r = esAB ? await publicarEmbudo() : await publicarVerificacion();
    setPub(r.error ? `error:${r.error}` : 'ok');
  };

  const entregaConPanel = e.entrega === 'panel' || e.entrega === 'ambos';
  const abBloqueado = esAB && !esPremium;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.verif_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{esAB ? t('dashboard.dobleBienv.note') : t('dashboard.verif_v.note')}</p>
      </div>

      {/* Selector de modo */}
      <div className={card}>
        <p className="mb-2 text-sm font-semibold text-fg">{t('dashboard.verif_v.mode')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ModoCard activo={modo === 'boton'} onClick={() => elegirModo('boton')} icon={MousePointerClick}
            titulo={t('dashboard.verif_v.modeButton')} desc={t('dashboard.verif_v.modeButtonDesc')} />
          <ModoCard activo={modo === 'captcha'} onClick={() => elegirModo('captcha')} icon={Puzzle}
            titulo={t('dashboard.verif_v.modeCaptcha')} desc={t('dashboard.verif_v.modeCaptchaDesc')} />
          <ModoCard activo={modo === 'ab'} onClick={() => elegirModo('ab')} icon={Users}
            titulo={t('dashboard.verif_v.modeAb')} desc={t('dashboard.verif_v.modeAbDesc')} premium bloqueado={abBloqueado} />
        </div>
        <p className="mt-2 text-xs text-muted">{t('dashboard.verif_v.modeExclusive')}</p>
      </div>

      {/* ─────────── DOBLE BIENVENIDA bloqueada (Free) ─────────── */}
      {abBloqueado && (
        <div className="relative">
          <div className="pointer-events-none select-none opacity-40 blur-[3px]">
            <div className={card}><div className="h-20" /></div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">{[1, 2].map((i) => <div key={i} className={card}><div className="h-44" /></div>)}</div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-on-brand"><Lock size={26} /></span>
            <h3 className="text-lg font-bold text-fg">{t('dashboard.dobleBienv.lockTitle')}</h3>
            <p className="max-w-md text-sm text-muted">{t('dashboard.dobleBienv.lockDesc')}</p>
            <button type="button" onClick={() => setActiveTab('cuenta-plan')}
              className="mt-1 flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-transform hover:scale-[1.02]">
              <Crown size={16} /> {t('dashboard.dobleBienv.lockCta')}
            </button>
          </div>
        </div>
      )}

      {/* ─────────── MODOS UN CLIC / CAPTCHA ─────────── */}
      {!esAB && (
        <>
          <div className={card}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-bold text-fg"><ShieldCheck size={18} className="text-brand" /> {t('dashboard.verif_v.enable')}</h3>
              <Toggle checked={v.activo} onChange={(val) => setVerif('activo', val)} />
            </div>

            <div className="mt-4 space-y-4 border-t border-line pt-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.role')}</span>
                <Select items={roles} value={v.rolVerificadoId} onChange={(val) => setVerif('rolVerificadoId', val)} placeholder={t('dashboard.verif_v.rolePh')} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.channel')}</span>
                <Select items={canales} value={v.canalId} onChange={(val) => setVerif('canalId', val)} placeholder={t('dashboard.verif_v.channelPh')} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.verif_v.buttonText')}</span>
                <input value={v.textoBoton} onChange={(ev) => setVerif('textoBoton', ev.target.value)} className={input + ' max-w-xs'} maxLength={80} />
              </label>
            </div>
          </div>

          {/* Mensaje del panel: embed personalizable */}
          <div className={card}>
            <h3 className="flex items-center gap-2 font-bold text-fg"><LayoutTemplate size={18} className="text-brand" /> {t('dashboard.verif_v.embedTitle')}</h3>
            <p className="mt-1 text-xs text-muted">{t('dashboard.verif_v.embedDesc')}</p>
            <div className="mt-4 border-t border-line pt-4">
              <EmbedBuilder value={v.embed || EMBED_VACIO} onChange={(emb) => setVerif('embed', emb)} subirImagen={subirImagen} />
            </div>
          </div>
        </>
      )}

      {/* ─────────── MODO DOBLE BIENVENIDA (Pro, desbloqueado) ─────────── */}
      {esAB && !abBloqueado && (
        <>
          <div className={card}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-bold text-fg"><Users size={18} className="text-brand" /> {t('dashboard.dobleBienv.enable')}</h3>
              <Toggle checked={e.activo} onChange={(val) => setAB('activo', val)} />
            </div>

            <div className="mt-4 space-y-4 border-t border-line pt-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-fg">{t('dashboard.dobleBienv.delivery')}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <OpcionEntrega activo={e.entrega === 'panel'} onClick={() => setAB('entrega', 'panel')} icon={MousePointerClick} titulo={t('dashboard.dobleBienv.deliveryPanel')} desc={t('dashboard.dobleBienv.deliveryPanelDesc')} />
                  <OpcionEntrega activo={e.entrega === 'md'} onClick={() => setAB('entrega', 'md')} icon={Send} titulo={t('dashboard.dobleBienv.deliveryMd')} desc={t('dashboard.dobleBienv.deliveryMdDesc')} />
                  <OpcionEntrega activo={e.entrega === 'ambos'} onClick={() => setAB('entrega', 'ambos')} icon={LayoutTemplate} titulo={t('dashboard.dobleBienv.deliveryBoth')} desc={t('dashboard.dobleBienv.deliveryBothDesc')} />
                </div>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.dobleBienv.role')}</span>
                <Select items={roles} value={e.rolVerificadoId} onChange={(val) => setAB('rolVerificadoId', val)} placeholder={t('dashboard.dobleBienv.rolePh')} />
              </label>
              {entregaConPanel && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.dobleBienv.channel')}</span>
                  <Select items={canales} value={e.canalId} onChange={(val) => setAB('canalId', val)} placeholder={t('dashboard.dobleBienv.channelPh')} />
                </label>
              )}
            </div>
          </div>

          {/* Las dos versiones */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Versión A */}
            <div className={card}>
              <h3 className="flex items-center gap-2 font-bold text-fg">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand text-sm font-extrabold text-on-brand">A</span>
                <FileText size={16} className="text-brand" /> {t('dashboard.dobleBienv.variantA')}
              </h3>
              <p className="mt-1 text-xs text-muted">{t('dashboard.dobleBienv.variantADesc')}</p>
              <div className="mt-4 space-y-4 border-t border-line pt-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.dobleBienv.title')}</span>
                  <input value={e.varianteA.titulo} onChange={(ev) => setA('titulo', ev.target.value)} className={input} maxLength={256} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.dobleBienv.rules')}</span>
                  <textarea value={e.varianteA.reglas} onChange={(ev) => setA('reglas', ev.target.value)} rows={5} className={input} maxLength={2000} />
                </label>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-fg">{t('dashboard.dobleBienv.captcha')}<span className="block text-xs font-normal text-muted">{t('dashboard.dobleBienv.captchaDesc')}</span></span>
                  <Toggle checked={e.varianteA.captcha} onChange={(val) => setA('captcha', val)} />
                </div>
                {!e.varianteA.captcha && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.dobleBienv.buttonText')}</span>
                    <input value={e.varianteA.textoBoton} onChange={(ev) => setA('textoBoton', ev.target.value)} className={input + ' max-w-xs'} maxLength={80} />
                  </label>
                )}
              </div>
            </div>

            {/* Versión B */}
            <div className={card}>
              <h3 className="flex items-center gap-2 font-bold text-fg">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand text-sm font-extrabold text-on-brand">B</span>
                <LayoutTemplate size={16} className="text-brand" /> {t('dashboard.dobleBienv.variantB')}
              </h3>
              <p className="mt-1 text-xs text-muted">{t('dashboard.dobleBienv.variantBDesc')}</p>
              <div className="mt-4 space-y-4 border-t border-line pt-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.dobleBienv.title')}</span>
                  <input value={e.varianteB.titulo} onChange={(ev) => setB('titulo', ev.target.value)} className={input} maxLength={256} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.dobleBienv.desc')}</span>
                  <textarea value={e.varianteB.descripcion} onChange={(ev) => setB('descripcion', ev.target.value)} rows={2} className={input} maxLength={2000} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.dobleBienv.rules')}</span>
                  <textarea value={e.varianteB.reglas} onChange={(ev) => setB('reglas', ev.target.value)} rows={3} className={input} maxLength={2000} />
                </label>
                <label className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-fg">{t('dashboard.dobleBienv.color')}</span>
                  <input type="color" value={e.varianteB.color} onChange={(ev) => setB('color', ev.target.value)} className="h-9 w-14 cursor-pointer rounded-lg border border-line bg-bg" />
                  <span className="text-xs text-muted">{e.varianteB.color}</span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.dobleBienv.buttonText')}</span>
                  <input value={e.varianteB.textoBoton} onChange={(ev) => setB('textoBoton', ev.target.value)} className={input + ' max-w-xs'} maxLength={80} />
                </label>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─────────── ACCIONES ─────────── */}
      {!abBloqueado && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={guardar} disabled={guardando || !configServidor}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            <Save size={16} /> {guardando ? t('dashboard.verif_v.saving') : t('dashboard.verif_v.save')}
          </button>
          <button type="button" onClick={publicar}
            disabled={!configServidor || (esAB ? (entregaConPanel && !e.canalId) : !v.canalId)}
            className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50">
            <Send size={16} /> {t('dashboard.verif_v.publish')}
          </button>
          {esAB && (
            <button type="button" onClick={() => setActiveTab('datos-analitica')}
              className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand">
              <BarChart3 size={16} /> {t('dashboard.dobleBienv.seeResults')}
            </button>
          )}
          {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.verif_v.saved')}</span>}
          {pub === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.verif_v.published')}</span>}
          {pub.startsWith('error:') && <span className="text-sm font-semibold text-danger">{pub.slice(6)}</span>}
        </div>
      )}
    </div>
  );
}
