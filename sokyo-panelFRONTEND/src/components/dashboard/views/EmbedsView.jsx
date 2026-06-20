// Productividad · Creador de Anuncios — crea un mensaje (texto a secas o con
// embed) y lo envía al instante a un canal. Permite guardar/usar presets.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Info, LayoutTemplate, FileText } from 'lucide-react';
import EmbedBuilder from './EmbedBuilder';
import PresetsAnuncio from './PresetsAnuncio';
import { EMBED_VACIO } from './embedDefaults';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

export default function EmbedsView({ dash }) {
  const { t } = useTranslation();
  const { canales, configServidor, enviarEmbed, subirImagen, presetsAnuncio, guardarPresetAnuncio, eliminarPresetAnuncio } = dash;

  const [modo, setModo] = useState('embed'); // 'embed' | 'texto'
  const [embed, setEmbed] = useState(EMBED_VACIO);
  const [contenido, setContenido] = useState('');
  const [canalId, setCanalId] = useState('');
  const [estado, setEstado] = useState(''); // '' | 'enviando' | 'ok' | 'error:...'

  const enviar = async () => {
    setEstado('enviando');
    // En modo texto no mandamos embed.
    const r = await enviarEmbed({ canalId, contenido, embed: modo === 'texto' ? {} : embed });
    setEstado(r.error ? `error:${r.error}` : 'ok');
    if (!r.error) { setContenido(''); setEmbed(EMBED_VACIO); }
  };

  // Presets: cargar uno repuebla el formulario y ajusta el modo.
  const cargarPreset = (p) => {
    setEstado('');
    setContenido(p.contenido || '');
    if (p.embed) { setEmbed({ ...EMBED_VACIO, ...p.embed }); setModo('embed'); }
    else { setEmbed(EMBED_VACIO); setModo('texto'); }
  };
  const guardarPreset = (nombre) => guardarPresetAnuncio({ nombre, contenido, embed: modo === 'texto' ? null : embed });

  const modoCls = (id) => `flex flex-1 items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold transition-colors ${modo === id ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:border-brand/50'}`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.embeds_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.embeds_v.note')}</p>
      </div>

      {/* Tipo de mensaje */}
      <div className="flex gap-3">
        <button type="button" onClick={() => { setEstado(''); setModo('embed'); }} className={modoCls('embed')}>
          <LayoutTemplate size={16} className="text-brand" /> {t('dashboard.embeds_v.modeEmbed')}
        </button>
        <button type="button" onClick={() => { setEstado(''); setModo('texto'); }} className={modoCls('texto')}>
          <FileText size={16} className="text-brand" /> {t('dashboard.embeds_v.modeText')}
        </button>
      </div>

      {/* Canal + texto */}
      <div className={card}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.embeds_v.channel')}</span>
            <select value={canalId} onChange={(e) => { setEstado(''); setCanalId(e.target.value); }} className={input}>
              <option value="">{t('dashboard.embeds_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
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
        <div className={card}>
          <EmbedBuilder value={embed} onChange={(v) => { setEstado(''); setEmbed(v); }} subirImagen={subirImagen} />
        </div>
      )}

      {/* Presets */}
      <PresetsAnuncio presets={presetsAnuncio} onCargar={cargarPreset} onGuardar={guardarPreset} onEliminar={eliminarPresetAnuncio} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={estado === 'enviando' || !configServidor || !canalId}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} /> {estado === 'enviando' ? t('dashboard.embeds_v.sending') : t('dashboard.embeds_v.send')}
        </button>
        {estado === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.embeds_v.sent')}</span>}
        {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
      </div>
    </div>
  );
}
