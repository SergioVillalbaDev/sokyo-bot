// Productividad · Anuncios programados — programa un mensaje (texto y/o embed)
// para publicarse en un canal a una fecha/hora, con repetición opcional.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Trash2, Info, Repeat, Pencil, X } from 'lucide-react';
import EmbedBuilder from './EmbedBuilder';
import PresetsAnuncio from './PresetsAnuncio';
import { EMBED_VACIO } from './embedDefaults';
import { OpcionCrear } from '../CrearAlVuelo';
import { useBorrador } from '../../../hooks/useAutoguardado';
import EstadoAutoguardado from '../EstadoAutoguardado';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

// Mínimo del input datetime-local: ahora + 1 min, en formato local sin zona.
function minLocal() {
  const d = new Date(Date.now() + 60000);
  d.setSeconds(0, 0);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default function AnunciosView({ dash }) {
  const { t } = useTranslation();
  const { canales, configServidor, anuncios, crearAnuncio, eliminarAnuncio, subirImagen, presetsAnuncio, guardarPresetAnuncio, actualizarPresetAnuncio, eliminarPresetAnuncio, editarCreado } = dash;
  const [editando, setEditando] = useState(null); // id del anuncio que se está editando (1.9.12)

  const [embed, setEmbed] = useState(EMBED_VACIO);
  const [contenido, setContenido] = useState('');
  const [canalId, setCanalId] = useState('');
  const [fechaEnvio, setFechaEnvio] = useState('');
  const [repetir, setRepetir] = useState('no');
  const [estado, setEstado] = useState(''); // '' | 'creando' | 'ok' | 'error:...'

  // Borrador: lo que se está escribiendo vuelve tras recargar (useBorrador).
  const borrador = useBorrador('anuncios', { embed, contenido, canalId, fechaEnvio, repetir },
    !contenido.trim() && JSON.stringify(embed) === JSON.stringify(EMBED_VACIO),
    (v) => { setEmbed(v ? { ...EMBED_VACIO, ...(v.embed || {}) } : EMBED_VACIO); setContenido(v?.contenido || ''); setCanalId(v?.canalId || canalId); setFechaEnvio(v?.fechaEnvio || ''); setRepetir(v?.repetir || 'no'); });

  const vaciar = () => { setContenido(''); setEmbed(EMBED_VACIO); setFechaEnvio(''); setRepetir('no'); setEditando(null); };
  const programar = async () => {
    setEstado('creando');
    const datos = { canalId, contenido, embed, fechaEnvio: new Date(fechaEnvio).toISOString(), repetir };
    const r = editando ? await editarCreado('anuncios', editando, datos) : await crearAnuncio(datos);
    setEstado(r.error ? `error:${r.error}` : (editando ? 'editado' : 'ok'));
    if (!r.error) vaciar();
  };
  // «Editar»: el anuncio vuelve al formulario de abajo (la fecha, en hora local).
  const aLocal = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  const editar = (a) => {
    setEstado(''); setEditando(a._id);
    setCanalId(a.canalId); setContenido(a.contenido || ''); setEmbed(a.embed ? { ...EMBED_VACIO, ...a.embed } : EMBED_VACIO);
    setFechaEnvio(aLocal(a.fechaEnvio)); setRepetir(a.repetir || 'no');
    document.querySelector('[data-help="anuncios-crear"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Presets: cargar uno repuebla el embed/texto; guardar guarda el actual.
  const cargarPreset = (p) => {
    setEstado('');
    setContenido(p.contenido || '');
    setEmbed(p.embed ? { ...EMBED_VACIO, ...p.embed } : EMBED_VACIO);
  };
  const guardarPreset = (nombre) => guardarPresetAnuncio({ nombre, contenido, embed });

  const nombreCanal = (id) => (canales.find((c) => c.id === id) || {}).nombre || id;
  const fecha = (d) => new Date(d).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.anuncios_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.anuncios_v.note')}</p>
      </div>

      {/* Programados */}
      <div data-help="anuncios-lista" className={card}>
        <h3 className="mb-3 font-bold text-fg">{t('dashboard.anuncios_v.scheduled')}</h3>
        {(!anuncios || anuncios.length === 0) ? (
          <p className="py-6 text-center text-sm italic text-muted">{t('dashboard.anuncios_v.empty')}</p>
        ) : (
          <div className="space-y-3">
            {anuncios.map((a) => (
              <div key={a._id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-bg p-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                    <CalendarClock size={15} className="text-brand" /> {fecha(a.fechaEnvio)}
                    {a.repetir !== 'no' && <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand"><Repeat size={11} /> {t(`dashboard.anuncios_v.repeat.${a.repetir}`)}</span>}
                  </p>
                  <p className="mt-1 text-xs text-muted">#{nombreCanal(a.canalId)}</p>
                  <p className="mt-1 truncate text-sm text-muted">{a.contenido || (a.embed && (a.embed.titulo || a.embed.descripcion)) || t('dashboard.anuncios_v.embedOnly')}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => editar(a)} className="rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-brand" aria-label={t('dashboard.editar.edit')} title={t('dashboard.editar.edit')}><Pencil size={15} /></button>
                  <button type="button" onClick={() => { if (editando === a._id) vaciar(); eliminarAnuncio(a._id); }} className="rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-danger"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Presets */}
      <PresetsAnuncio presets={presetsAnuncio} onCargar={cargarPreset} onGuardar={guardarPreset} onEliminar={eliminarPresetAnuncio}
        onRenombrar={(p, nombre) => actualizarPresetAnuncio(p._id, { nombre, contenido: p.contenido || '', embed: p.embed || null })} />

      {/* Crear */}
      <div data-help="anuncios-crear" className={card}>
        <h3 className="mb-4 font-bold text-fg">{editando ? t('dashboard.editar.edit') : t('dashboard.anuncios_v.createTitle')}</h3>
        {editando && <p className="mb-4 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-xs font-semibold text-fg">{t('dashboard.editar.editing', { n: fechaEnvio ? fecha(fechaEnvio) : '' })}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.anuncios_v.channel')}</span>
            <select value={canalId} onChange={(e) => { setEstado(''); setCanalId(e.target.value); }} className={input}>
              <option value="">{t('dashboard.anuncios_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              <OpcionCrear tipo="canal" />
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.anuncios_v.when')}</span>
            <input type="datetime-local" value={fechaEnvio} min={minLocal()} onChange={(e) => { setEstado(''); setFechaEnvio(e.target.value); }} className={input} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.anuncios_v.repeatLabel')}</span>
            <select value={repetir} onChange={(e) => setRepetir(e.target.value)} className={input}>
              <option value="no">{t('dashboard.anuncios_v.repeat.no')}</option>
              <option value="diario">{t('dashboard.anuncios_v.repeat.diario')}</option>
              <option value="semanal">{t('dashboard.anuncios_v.repeat.semanal')}</option>
              <option value="mensual">{t('dashboard.anuncios_v.repeat.mensual')}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.anuncios_v.content')}</span>
            <input value={contenido} onChange={(e) => setContenido(e.target.value)} className={input} maxLength={2000} placeholder={t('dashboard.anuncios_v.contentPh')} />
          </label>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <EmbedBuilder value={embed} onChange={(v) => { setEstado(''); setEmbed(v); }} subirImagen={subirImagen} texto={contenido} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={programar}
            disabled={estado === 'creando' || !configServidor || !canalId || !fechaEnvio}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarClock size={16} /> {estado === 'creando' ? t('dashboard.anuncios_v.scheduling') : editando ? t('dashboard.editar.save') : t('dashboard.anuncios_v.schedule')}
          </button>
          {editando && (
            <button type="button" onClick={() => { vaciar(); setEstado(''); }} className="flex items-center gap-1.5 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">
              <X size={15} /> {t('dashboard.editar.cancel')}
            </button>
          )}
          {estado === 'editado' && <span className="text-sm font-semibold text-success">{t('dashboard.editar.saved')}</span>}
          {!estado && <EstadoAutoguardado estado={borrador} />}
          {estado === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.anuncios_v.scheduledOk')}</span>}
          {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
        </div>
      </div>
    </div>
  );
}
