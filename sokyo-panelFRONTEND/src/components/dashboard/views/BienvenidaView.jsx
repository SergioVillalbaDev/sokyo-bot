// Comunidad · Bienvenida y despedida — mensajes totalmente editables (texto +
// embed con imágenes/GIFs) que se publican en un canal cuando alguien entra o
// sale. Reutiliza el constructor de embeds (EmbedBuilder) y admite placeholders
// dinámicos. Dos pestañas: bienvenida y despedida.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../ui/primitives';
import { LogIn, LogOut, Save, Check, Info, Send, Hash, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import EmbedBuilder from './EmbedBuilder';
import { EMBED_VACIO } from './embedDefaults';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import EstadoAutoguardado from '../EstadoAutoguardado';
import { estadoMensaje } from '../../../lib/estadoBienvenida';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const DEF = {
  bienvenida: { activo: false, canalId: null, contenido: '', mencionar: true, embed: null },
  despedida: { activo: false, canalId: null, contenido: '', mencionar: false, embed: null },
};

// Variables disponibles para el texto y el embed: las mismas que explica la ayuda
// (utils/bienvenida.js acepta también {servidor} y {miembros} por compatibilidad).
const VARIABLES = ['{mention}', '{user}', '{server}', '{members}', '{avatar}'];

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
  const { canales, configServidor, guardarBienvenidas, probarBienvenida, subirImagen, presetsAnuncio, guardarPresetAnuncio } = dash;

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

  // ¿Se va a mandar de verdad? Aviso arriba con el motivo y, si se puede, el arreglo en un clic.
  const estado = estadoMensaje(actual, { tipo: tab, canales });
  const arreglo = {
    apagado: { texto: 'activar', hacer: () => set('activo', true) },
    sinPing: { texto: 'activarMencion', hacer: () => set('mencionar', true) },
    sinMencion: { texto: 'anadirMencion', hacer: () => { set('mencionar', true); set('contenido', `{mention} ${actual.contenido || ''}`.trim()); } },
    mencionEnEmbed: { texto: 'anadirMencion', hacer: () => { set('mencionar', true); set('contenido', `{mention} ${actual.contenido || ''}`.trim()); } },
  }[estado.clave];
  const ESTILO_ESTADO = {
    ok: ['border-success/40 bg-success/10', CheckCircle2, 'text-success'],
    aviso: ['border-warn/50 bg-warn/10', AlertTriangle, 'text-warn'],
    error: ['border-danger/50 bg-danger/10', XCircle, 'text-danger'],
  };
  const [claseEstado, IconoEstado, colorEstado] = ESTILO_ESTADO[estado.tipo];

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarBienvenidas(b, d);
    setGuardando(false);
    setGuardado(ok);
    return ok;
  };
  // Se guarda solo al dejar de tocar algo (hooks/useAutoguardado.js).
  const autoguardado = useAutoguardado([b, d], guardar, { listo: !!configServidor });
  // La prueba usa lo que se ve en pantalla: primero se guarda (aunque el
  // autoguardado aún no haya saltado) y luego se envía, esté activado o no.
  const probar = async () => {
    setPrueba('enviando');
    const ok = await guardar();
    if (!ok) { setPrueba(`error:${t('dashboard.bienvenida_v.testSaveFail')}`); return; }
    const r = await probarBienvenida(tab);
    setPrueba(r.error ? `error:${r.error}` : (actual.activo ? 'ok' : 'okInactivo'));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.bienvenida_v.intro')}</p>

      {/* Pestañas bienvenida / despedida */}
      <div data-help="bienvenida-tabs" className="flex items-center gap-1 rounded-2xl border border-line bg-elevated p-1">
        {[['bienvenida', LogIn], ['despedida', LogOut]].map(([id, Icon]) => (
          <button key={id} type="button" onClick={() => { setTab(id); setPrueba(''); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${tab === id ? 'bg-gradient-brand text-on-brand' : 'text-muted hover:text-fg'}`}>
            <Icon size={16} /> {t(`dashboard.bienvenida_v.${id === 'bienvenida' ? 'tabWelcome' : 'tabFarewell'}`)}
          </button>
        ))}
      </div>

      <div role="status" className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${claseEstado}`}>
        <IconoEstado size={18} className={`shrink-0 ${colorEstado}`} />
        <p className="min-w-0 flex-1 text-sm font-semibold text-fg">
          {t(`dashboard.bienvenida_v.estado.${estado.clave}`, { cuando: t(`dashboard.bienvenida_v.estado.${tab === 'bienvenida' ? 'cuandoEntra' : 'cuandoSale'}`) })}
        </p>
        {arreglo && (
          <button type="button" onClick={arreglo.hacer}
            className="shrink-0 rounded-xl border border-line bg-bg px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-brand">
            {t(`dashboard.bienvenida_v.estado.${arreglo.texto}`)}
          </button>
        )}
      </div>

      <div data-help="bienvenida-mensaje" className={card}>
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
              {/* Mencionar un canal: inserta «#nombre» y el bot lo convierte en enlace al canal */}
              {canales.length > 0 && (
                <select value="" onChange={(ev) => { if (ev.target.value) insertarVar(`${(actual.contenido || '').match(/\s$|^$/) ? '' : ' '}#${ev.target.value}`); }}
                  aria-label={t('dashboard.bienvenida_v.mentionChannel')}
                  className="rounded-lg border border-line bg-bg px-2 py-1 text-xs font-semibold text-brand transition-colors hover:border-brand focus:outline-none">
                  <option value="">＃ {t('dashboard.bienvenida_v.mentionChannel')}…</option>
                  {canales.map((c) => <option key={c.id} value={c.nombre}>#{c.nombre}</option>)}
                </select>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted">{t('dashboard.bienvenida_v.varsHelp')}</p>
            <p className="mt-1 text-xs text-muted">{t('dashboard.bienvenida_v.channelsHelp')}</p>
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
      <div data-help="bienvenida-embed" className={card}>
        <h3 className="flex items-center gap-2 font-bold text-fg"><Hash size={18} className="text-brand" /> {t('dashboard.bienvenida_v.embedTitle')}</h3>
        <p className="mt-1 text-xs text-muted">{t('dashboard.bienvenida_v.embedDesc')}</p>
        <div className="mt-4 border-t border-line pt-4">
          <EmbedBuilder value={actual.embed || EMBED_VACIO} onChange={(emb) => set('embed', emb)} subirImagen={subirImagen} presets={presetsAnuncio} onGuardarPreset={(p) => guardarPresetAnuncio({ ...p, contenido: '' })} />
        </div>
      </div>

      <div data-help="bienvenida-acciones" className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando || !configServidor}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          <Save size={16} /> {guardando ? t('dashboard.bienvenida_v.saving') : t('dashboard.bienvenida_v.save')}
        </button>
        <EstadoAutoguardado estado={autoguardado} />
        <button type="button" onClick={probar} disabled={!configServidor || !actual.canalId || prueba === 'enviando'}
          title={!actual.canalId ? t('dashboard.bienvenida_v.testNeedsChannel') : undefined}
          className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50">
          <Send size={16} /> {prueba === 'enviando' ? t('dashboard.bienvenida_v.testing') : t('dashboard.bienvenida_v.test')}
        </button>
        {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.bienvenida_v.saved')}</span>}
        {prueba === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.bienvenida_v.tested')}</span>}
        {prueba === 'okInactivo' && <span className="text-sm font-semibold text-success">{t('dashboard.bienvenida_v.testedOff')}</span>}
        {prueba.startsWith('error:') && <span className="text-sm font-semibold text-danger">{prueba.slice(6)}</span>}
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.bienvenida_v.testHint')}</p>
      </div>
    </div>
  );
}
