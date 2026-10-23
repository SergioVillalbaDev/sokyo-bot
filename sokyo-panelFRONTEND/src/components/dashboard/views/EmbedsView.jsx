// Productividad · Creador de Anuncios — crea un mensaje (texto a secas o con
// embed) y lo envía al instante a un canal. Permite guardar/usar presets y, para
// las IDs autorizadas (difusores), enviar a TODOS los servidores del bot.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Info, LayoutTemplate, FileText, Radio, Server, Globe2 } from 'lucide-react';
import EmbedBuilder from './EmbedBuilder';
import PresetsAnuncio from './PresetsAnuncio';
import { EMBED_VACIO } from './embedDefaults';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

export default function EmbedsView({ dash }) {
  const { t } = useTranslation();
  const { canales, configServidor, enviarEmbed, subirImagen, presetsAnuncio, guardarPresetAnuncio, eliminarPresetAnuncio, esBroadcaster, servidoresBot, difundir } = dash;

  const [modo, setModo] = useState('embed');     // 'embed' | 'texto'
  const [alcance, setAlcance] = useState('canal'); // 'canal' | 'todos' (solo difusores)
  const [embed, setEmbed] = useState(EMBED_VACIO);
  const [contenido, setContenido] = useState('');
  const [canalId, setCanalId] = useState('');
  const [estado, setEstado] = useState('');       // '' | 'enviando' | 'ok' | 'error:...'
  const [resumen, setResumen] = useState(null);   // resultado de la difusión a todos

  const todos = esBroadcaster && alcance === 'todos';

  const enviar = async () => {
    setEstado('enviando'); setResumen(null);
    const emb = modo === 'texto' ? {} : embed;
    const r = todos
      ? await difundir({ alcance: 'todos', contenido, embed: emb })
      : await enviarEmbed({ canalId, contenido, embed: emb });
    if (r.error) { setEstado(`error:${r.error}`); return; }
    setEstado('ok');
    if (todos) setResumen({ enviados: r.enviados, total: r.total, fallos: r.fallos || [] });
    setContenido(''); setEmbed(EMBED_VACIO);
  };

  const cargarPreset = (p) => {
    setEstado('');
    setContenido(p.contenido || '');
    if (p.embed) { setEmbed({ ...EMBED_VACIO, ...p.embed }); setModo('embed'); }
    else { setEmbed(EMBED_VACIO); setModo('texto'); }
  };
  const guardarPreset = (nombre) => guardarPresetAnuncio({ nombre, contenido, embed: modo === 'texto' ? null : embed });

  const cls = (activo) => `flex flex-1 items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold transition-colors ${activo ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:border-brand/50'}`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.embeds_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.embeds_v.note')}</p>
      </div>

      {/* Difusión: solo para IDs autorizadas */}
      {esBroadcaster && (
        <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-fg"><Radio size={16} className="text-warning" /> {t('dashboard.embeds_v.broadcastTitle')}</p>
            <p className="mt-1 text-xs text-muted">{t('dashboard.embeds_v.broadcastNote')}</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setEstado(''); setAlcance('canal'); }} className={cls(alcance === 'canal')}>
              <Server size={16} className="text-brand" /> {t('dashboard.embeds_v.scopeOne')}
            </button>
            <button type="button" onClick={() => { setEstado(''); setAlcance('todos'); }} className={cls(alcance === 'todos')}>
              <Globe2 size={16} className="text-brand" /> {t('dashboard.embeds_v.scopeAll')} ({servidoresBot})
            </button>
          </div>
        </div>
      )}

      {/* Tipo de mensaje */}
      <div data-help="embeds-tipo" className="flex gap-3">
        <button type="button" onClick={() => { setEstado(''); setModo('embed'); }} className={cls(modo === 'embed')}>
          <LayoutTemplate size={16} className="text-brand" /> {t('dashboard.embeds_v.modeEmbed')}
        </button>
        <button type="button" onClick={() => { setEstado(''); setModo('texto'); }} className={cls(modo === 'texto')}>
          <FileText size={16} className="text-brand" /> {t('dashboard.embeds_v.modeText')}
        </button>
      </div>

      {/* Destino + texto */}
      <div data-help="embeds-destino" className={card}>
        <div className="grid gap-4 sm:grid-cols-2">
          {todos ? (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-elevated px-3 py-2 text-sm text-muted sm:col-span-2">
              <Globe2 size={15} className="text-brand" /> {t('dashboard.embeds_v.allTarget', { n: servidoresBot })}
            </div>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embeds_v.channel')}</span>
              <select value={canalId} onChange={(e) => { setEstado(''); setCanalId(e.target.value); }} className={input}>
                <option value="">{t('dashboard.embeds_v.channelPh')}</option>
                {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
          )}
          {modo === 'embed' && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embeds_v.content')}</span>
              <input value={contenido} onChange={(e) => setContenido(e.target.value)} className={input} maxLength={2000} placeholder={t('dashboard.embeds_v.contentPh')} />
            </label>
          )}
        </div>
        {modo === 'texto' && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embeds_v.message')}</span>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={5} className={input} maxLength={2000} placeholder={t('dashboard.embeds_v.messagePh')} />
          </label>
        )}
      </div>

      {/* Embed (solo en modo embed) */}
      {modo === 'embed' && (
        <div data-help="embeds-builder" className={card}>
          <EmbedBuilder value={embed} onChange={(v) => { setEstado(''); setEmbed(v); }} subirImagen={subirImagen} />
        </div>
      )}

      {/* Presets */}
      <PresetsAnuncio presets={presetsAnuncio} onCargar={cargarPreset} onGuardar={guardarPreset} onEliminar={eliminarPresetAnuncio} />

      <div data-help="embeds-enviar" className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={estado === 'enviando' || (!todos && (!configServidor || !canalId))}
          className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${todos ? 'bg-warning' : 'bg-gradient-brand'}`}
        >
          {todos ? <Radio size={16} /> : <Send size={16} />}
          {estado === 'enviando' ? t('dashboard.embeds_v.sending') : (todos ? t('dashboard.embeds_v.broadcastSend') : t('dashboard.embeds_v.send'))}
        </button>
        {estado === 'ok' && (resumen
          ? <span className="text-sm font-semibold text-success">{t('dashboard.embeds_v.sentAll', { n: resumen.enviados, total: resumen.total })}{resumen.fallos.length ? ` · ${t('dashboard.embeds_v.failed', { n: resumen.fallos.length })}` : ''}</span>
          : <span className="text-sm font-semibold text-success">{t('dashboard.embeds_v.sent')}</span>)}
        {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
      </div>
    </div>
  );
}
