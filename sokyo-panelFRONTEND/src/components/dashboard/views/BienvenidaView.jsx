// Comunidad · Bienvenida y despedida — mensajes totalmente editables (texto +
// embed con imágenes/GIFs) que se publican en un canal cuando alguien entra o
// sale. Reutiliza el constructor de embeds (EmbedBuilder) y admite placeholders
// dinámicos. Dos pestañas: bienvenida y despedida.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../ui/primitives';
import { LogIn, LogOut, Save, Check, Info, Send, Hash } from 'lucide-react';
import EmbedBuilder from './EmbedBuilder';
import { EMBED_VACIO } from './embedDefaults';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const DEF = {
  bienvenida: { activo: false, canalId: null, contenido: '', mencionar: true, embed: null },
  despedida: { activo: false, canalId: null, contenido: '', mencionar: false, embed: null },
};

// Variables disponibles para el texto y el embed.
const VARIABLES = ['{mention}', '{user}', '{servidor}', '{miembros}', '{avatar}'];

function Select({ items, value, onChange, placeholder }) {
  return (
    <select value={value || ''} onChange={(ev) => onChange(ev.target.value || null)} className={input + ' max-w-xs'}>
      <option value="">{placeholder}</option>
      {items.map((it) => <option key={it.id} value={it.id}>{it.nombre}</option>)}
    </select>
  );
}

export default function BienvenidaView({ dash }) {
  const { t } = useTranslation();
  const { canales, configServidor, guardarBienvenidas, probarBienvenida, subirImagen } = dash;

  const [tab, setTab] = useState('bienvenida');
  const [b, setB] = useState(DEF.bienvenida);
  const [d, setD] = useState(DEF.despedida);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [prueba, setPrueba] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor) {
      setB({ ...DEF.bienvenida, ...(configServidor.bienvenida || {}) });
      setD({ ...DEF.despedida, ...(configServidor.despedida || {}) });
    }
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const actual = tab === 'bienvenida' ? b : d;
  const setActual = tab === 'bienvenida' ? setB : setD;
  const set = (k, val) => { setGuardado(false); setActual((prev) => ({ ...prev, [k]: val })); };
  const insertarVar = (v) => set('contenido', `${actual.contenido || ''}${v}`);

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarBienvenidas(b, d);
    setGuardando(false);
    setGuardado(ok);
  };
  const probar = async () => {
    setPrueba('...');
    const r = await probarBienvenida(tab);
    setPrueba(r.error ? `error:${r.error}` : 'ok');
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.bienvenida_v.intro')}</p>

      {/* Pestañas bienvenida / despedida */}
      <div className="flex items-center gap-1 rounded-2xl border border-line bg-elevated p-1">
        {[['bienvenida', LogIn], ['despedida', LogOut]].map(([id, Icon]) => (
          <button key={id} type="button" onClick={() => { setTab(id); setPrueba(''); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${tab === id ? 'bg-gradient-brand text-on-brand' : 'text-muted hover:text-fg'}`}>
            <Icon size={16} /> {t(`dashboard.bienvenida_v.${id === 'bienvenida' ? 'tabWelcome' : 'tabFarewell'}`)}
          </button>
        ))}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold text-fg">
            {tab === 'bienvenida' ? <LogIn size={18} className="text-brand" /> : <LogOut size={18} className="text-brand" />}
            {t('dashboard.bienvenida_v.enable')}
          </h3>
          <Toggle checked={actual.activo} onChange={(val) => set('activo', val)} />
        </div>

        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.bienvenida_v.channel')}</span>
            <Select items={canales} value={actual.canalId} onChange={(val) => set('canalId', val)} placeholder={t('dashboard.bienvenida_v.channelPh')} />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.bienvenida_v.content')}</span>
            <textarea value={actual.contenido} onChange={(ev) => set('contenido', ev.target.value)} rows={3} className={input} maxLength={2000} placeholder={t('dashboard.bienvenida_v.contentPh')} />
            {/* Variables insertables */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">{t('dashboard.bienvenida_v.variables')}:</span>
              {VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => insertarVar(v)}
                  className="rounded-lg border border-line bg-bg px-2 py-1 font-mono text-xs text-brand transition-colors hover:border-brand">
                  {v}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{t('dashboard.bienvenida_v.varsHelp')}</p>
          </div>

          {tab === 'bienvenida' && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-fg">{t('dashboard.bienvenida_v.mention')}<span className="block text-xs font-normal text-muted">{t('dashboard.bienvenida_v.mentionDesc')}</span></span>
              <Toggle checked={actual.mencionar} onChange={(val) => set('mencionar', val)} />
            </div>
          )}
        </div>
      </div>

      {/* Embed opcional */}
      <div className={card}>
        <h3 className="flex items-center gap-2 font-bold text-fg"><Hash size={18} className="text-brand" /> {t('dashboard.bienvenida_v.embedTitle')}</h3>
        <p className="mt-1 text-xs text-muted">{t('dashboard.bienvenida_v.embedDesc')}</p>
        <div className="mt-4 border-t border-line pt-4">
          <EmbedBuilder value={actual.embed || EMBED_VACIO} onChange={(emb) => set('embed', emb)} subirImagen={subirImagen} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando || !configServidor}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          <Save size={16} /> {guardando ? t('dashboard.bienvenida_v.saving') : t('dashboard.bienvenida_v.save')}
        </button>
        <button type="button" onClick={probar} disabled={!configServidor || !actual.canalId}
          className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50">
          <Send size={16} /> {t('dashboard.bienvenida_v.test')}
        </button>
        {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.bienvenida_v.saved')}</span>}
        {prueba === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.bienvenida_v.tested')}</span>}
        {prueba.startsWith('error:') && <span className="text-sm font-semibold text-danger">{prueba.slice(6)}</span>}
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.bienvenida_v.testHint')}</p>
      </div>
    </div>
  );
}
