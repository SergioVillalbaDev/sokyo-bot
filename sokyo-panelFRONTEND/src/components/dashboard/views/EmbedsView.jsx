// Productividad · Creador de Anuncios — crea un mensaje (texto a secas o con
// embed) y lo envía al instante a un canal. Permite guardar/usar presets y, para
// las IDs autorizadas (difusores), enviar a TODOS los servidores del bot.
// 1.9.10: lo que se está escribiendo se queda como borrador en este dispositivo y se
// recupera al volver (useAutoguardado sin `guardar`), y «Guardar» junto a «Enviar»
// lo guarda en el servidor como mensaje guardado (o guarda los cambios del abierto).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Info, LayoutTemplate, FileText, Radio, Server, Globe2, Save, Check, Bookmark, FilePlus2 } from 'lucide-react';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import EstadoAutoguardado from '../EstadoAutoguardado';
import EmbedBuilder from './EmbedBuilder';
import PresetsAnuncio from './PresetsAnuncio';
import { EMBED_VACIO } from './embedDefaults';
import { OpcionCrear } from '../CrearAlVuelo';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

export default function EmbedsView({ dash }) {
  const { t } = useTranslation();
  const { canales, configServidor, enviarEmbed, subirImagen, presetsAnuncio, guardarPresetAnuncio, actualizarPresetAnuncio, eliminarPresetAnuncio, esBroadcaster, servidoresBot, difundir } = dash;

  const [modo, setModo] = useState('embed');     // 'embed' | 'texto'
  const [alcance, setAlcance] = useState('canal'); // 'canal' | 'todos' (solo difusores)
  const [embed, setEmbed] = useState(EMBED_VACIO);
  const [contenido, setContenido] = useState('');
  const [canalId, setCanalId] = useState('');
  const [estado, setEstado] = useState('');       // '' | 'enviando' | 'ok' | 'error:...'
  const [resumen, setResumen] = useState(null);   // resultado de la difusión a todos

  const [plantilla, setPlantilla] = useState(null); // { id, nombre }: el mensaje guardado que se edita
  const [guardado, setGuardado] = useState('');     // '' | 'nombre' | 'guardando' | 'ok' | 'error:…'
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [avisoNombre, setAvisoNombre] = useState(''); // por qué se pide nombre (si no es el primero)

  const todos = esBroadcaster && alcance === 'todos';

  // Borrador en este dispositivo: lo que se está escribiendo vuelve tras recargar.
  // Vacío (sin texto ni embed) no hay borrador: así, al enviar, desaparece solo.
  const vacio = !contenido.trim() && JSON.stringify(embed) === JSON.stringify(EMBED_VACIO);
  const borrador = useAutoguardado(vacio && !plantilla ? null : { modo, contenido, embed, canalId, plantilla }, null, {
    borrador: 'creador-mensajes',
    restaurar: (v) => {
      if (!v) { setContenido(''); setEmbed(EMBED_VACIO); setPlantilla(null); return; }
      setModo(v.modo === 'texto' ? 'texto' : 'embed');
      setContenido(v.contenido || '');
      setEmbed({ ...EMBED_VACIO, ...(v.embed || {}) });
      setCanalId(v.canalId || '');
      setPlantilla(v.plantilla || null);
    },
  });

  const datosMensaje = () => ({ contenido, embed: modo === 'texto' ? null : embed });
  // «Guardar»: con un mensaje guardado abierto, guarda sus cambios; si no, pide un nombre.
  const guardarMensaje = async () => {
    if (!plantilla) { setAvisoNombre(''); setGuardado('nombre'); return; }
    setGuardado('guardando');
    const r = await actualizarPresetAnuncio(plantilla.id, datosMensaje());
    // Ya no existe (lo han borrado mientras tanto): se guarda como uno nuevo, con nombre.
    if (r?.noExiste) { setPlantilla(null); setNombreNuevo(plantilla.nombre); setGuardado('nombre'); setAvisoNombre(t('dashboard.embeds_v.gone', { n: plantilla.nombre })); return; }
    setGuardado(r?.error ? `error:${r.error}` : 'ok');
  };
  const guardarComoNuevo = async (ev) => {
    ev?.preventDefault();
    if (!nombreNuevo.trim()) return;
    setGuardado('guardando');
    const r = await guardarPresetAnuncio({ nombre: nombreNuevo.trim(), ...datosMensaje() });
    if (r?.error) { setGuardado(`error:${r.error}`); return; }
    if (r?.preset) setPlantilla({ id: r.preset._id, nombre: r.preset.nombre });
    setNombreNuevo('');
    setGuardado('ok');
  };
  const empezarNuevo = () => {
    if (!vacio && !window.confirm(t('dashboard.embeds_v.newConfirm'))) return;
    setContenido(''); setEmbed(EMBED_VACIO); setPlantilla(null); setEstado(''); setGuardado('');
  };
  const eliminarGuardado = async (id) => {
    const ok = await eliminarPresetAnuncio(id);
    if (ok && plantilla?.id === id) setPlantilla(null);
    return ok;
  };

  const enviar = async () => {
    setEstado('enviando'); setResumen(null);
    const emb = modo === 'texto' ? {} : embed;
    const r = todos
      ? await difundir({ alcance: 'todos', contenido, embed: emb })
      : await enviarEmbed({ canalId, contenido, embed: emb });
    if (r.error) { setEstado(`error:${r.error}`); return; }
    setEstado('ok');
    if (todos) setResumen({ enviados: r.enviados, total: r.total, fallos: r.fallos || [] });
    setContenido(''); setEmbed(EMBED_VACIO); setPlantilla(null); setGuardado('');
  };

  const cargarPreset = (p) => {
    if (!vacio && plantilla?.id !== p._id && !window.confirm(t('dashboard.embeds_v.loadConfirm', { n: p.nombre }))) return;
    setEstado(''); setGuardado('');
    setPlantilla({ id: p._id, nombre: p.nombre });
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
                <OpcionCrear tipo="canal" />
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
          <EmbedBuilder value={embed} onChange={(v) => { setEstado(''); setEmbed(v); }} subirImagen={subirImagen} texto={contenido} />
        </div>
      )}

      {/* Mensajes guardados (cargar / borrar; se guarda con «Guardar», abajo) */}
      <PresetsAnuncio presets={presetsAnuncio} onCargar={cargarPreset} onGuardar={guardarPreset} onEliminar={eliminarGuardado} sinGuardar abierto={plantilla?.id} />

      {plantilla && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-fg">
          <Bookmark size={16} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1">{t('dashboard.embeds_v.editing', { n: plantilla.nombre })}</span>
          <button type="button" onClick={empezarNuevo} className="flex items-center gap-1.5 rounded-xl bg-elevated px-3 py-1.5 text-xs font-semibold text-fg ring-1 ring-line hover:text-brand"><FilePlus2 size={14} /> {t('dashboard.embeds_v.startNew')}</button>
        </div>
      )}

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
        <button type="button" onClick={guardarMensaje} disabled={vacio || guardado === 'guardando'}
          className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          title={t('dashboard.embeds_v.saveHint')}>
          <Save size={16} /> {guardado === 'guardando' ? t('dashboard.embeds_v.saving') : plantilla ? t('dashboard.embeds_v.saveChanges') : t('dashboard.embeds_v.save')}
        </button>
        {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
        {guardado === 'ok' && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={15} /> {t('dashboard.embeds_v.savedAs', { n: plantilla?.nombre || '' })}</span>}
        {guardado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{guardado.slice(6)}</span>}
        {!estado && !guardado && <EstadoAutoguardado estado={borrador} />}
      </div>
      {guardado === 'nombre' && (
        <form onSubmit={guardarComoNuevo} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-3">
          {avisoNombre && <p className="w-full text-xs text-warning">{avisoNombre}</p>}
          <input autoFocus value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} maxLength={80} placeholder={t('dashboard.embeds_v.namePh')}
            className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none" />
          <button type="submit" disabled={!nombreNuevo.trim()} className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-bold text-on-brand disabled:opacity-50"><Save size={15} /> {t('dashboard.embeds_v.save')}</button>
          <button type="button" onClick={() => setGuardado('')} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-fg">{t('dashboard.embeds_v.cancel')}</button>
        </form>
      )}
    </div>
  );
}
