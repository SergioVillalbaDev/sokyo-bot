// Productividad · Anuncios programados — programa un mensaje (texto y/o embed)
// para publicarse en un canal a una fecha/hora, con repetición opcional.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Trash2, Info, Repeat } from 'lucide-react';
import EmbedBuilder from './EmbedBuilder';
import { EMBED_VACIO } from './embedDefaults';

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
  const { canales, configServidor, anuncios, crearAnuncio, eliminarAnuncio, subirImagen } = dash;

  const [embed, setEmbed] = useState(EMBED_VACIO);
  const [contenido, setContenido] = useState('');
  const [canalId, setCanalId] = useState('');
  const [fechaEnvio, setFechaEnvio] = useState('');
  const [repetir, setRepetir] = useState('no');
  const [estado, setEstado] = useState(''); // '' | 'creando' | 'ok' | 'error:...'

  const programar = async () => {
    setEstado('creando');
    const r = await crearAnuncio({ canalId, contenido, embed, fechaEnvio: new Date(fechaEnvio).toISOString(), repetir });
    setEstado(r.error ? `error:${r.error}` : 'ok');
    if (!r.error) { setContenido(''); setEmbed(EMBED_VACIO); setFechaEnvio(''); setRepetir('no'); }
  };

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
      <div className={card}>
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
                <button type="button" onClick={() => eliminarAnuncio(a._id)} className="shrink-0 rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-danger"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crear */}
      <div className={card}>
        <h3 className="mb-4 font-bold text-fg">{t('dashboard.anuncios_v.createTitle')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.anuncios_v.channel')}</span>
            <select value={canalId} onChange={(e) => { setEstado(''); setCanalId(e.target.value); }} className={input}>
              <option value="">{t('dashboard.anuncios_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.anuncios_v.content')}</span>
            <input value={contenido} onChange={(e) => setContenido(e.target.value)} className={input} maxLength={2000} placeholder={t('dashboard.anuncios_v.contentPh')} />
          </label>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <EmbedBuilder value={embed} onChange={(v) => { setEstado(''); setEmbed(v); }} subirImagen={subirImagen} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={programar}
            disabled={estado === 'creando' || !configServidor || !canalId || !fechaEnvio}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarClock size={16} /> {estado === 'creando' ? t('dashboard.anuncios_v.scheduling') : t('dashboard.anuncios_v.schedule')}
          </button>
          {estado === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.anuncios_v.scheduledOk')}</span>}
          {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
        </div>
      </div>
    </div>
  );
}
