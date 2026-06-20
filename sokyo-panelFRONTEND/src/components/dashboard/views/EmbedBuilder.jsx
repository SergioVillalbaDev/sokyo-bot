// Constructor de embeds reutilizable: formulario + vista previa en vivo (estilo
// Discord). Controlado por el padre vía { value, onChange }. La imagen y la
// miniatura aceptan URL externa o subida desde el PC (se guardan en /uploads y
// el bot las adjunta con attachment://). Lo usan EmbedsView y AnunciosView.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { API_URL } from '../../../lib/api';
import { EMBED_VACIO } from './embedDefaults';

const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const label = 'mb-1.5 block text-sm font-semibold text-fg';

// URL mostrable de una imagen: archivo subido (vía API) o URL externa http(s).
function urlImagen(archivo, url) {
  if (archivo) return `${API_URL}/uploads/${archivo}`;
  if (url && /^https?:\/\//.test(url)) return url;
  return '';
}

// Lee un File como dataURL (base64) para mandarlo al endpoint de subida.
function leerComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Campo de imagen: input de URL + botón "Subir del PC" + estado del archivo subido.
function CampoImagen({ titulo, url, archivo, onChange, subirImagen, t }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-subir el mismo archivo
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError(t('dashboard.embed_b.tooBig')); return; }
    setError(''); setSubiendo(true);
    try {
      const dataUrl = await leerComoDataURL(file);
      const r = await subirImagen(dataUrl);
      if (r.error) setError(r.error);
      else onChange({ archivo: r.archivo, url: '' }); // archivo subido reemplaza la URL
    } catch { setError(t('dashboard.embed_b.uploadFail')); }
    setSubiendo(false);
  };

  return (
    <div>
      <span className={label}>{titulo}</span>
      {archivo ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
          <span className="flex-1 truncate text-sm text-success">✓ {t('dashboard.embed_b.uploaded')}</span>
          <button type="button" onClick={() => onChange({ archivo: '', url: '' })} className="text-muted transition-colors hover:text-danger"><X size={15} /></button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input value={url} onChange={(e) => onChange({ archivo: '', url: e.target.value })} className={input + ' flex-1'} placeholder="https://…" maxLength={500} />
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2 text-xs font-semibold text-fg transition-colors hover:border-brand">
            <Upload size={14} /> {subiendo ? t('dashboard.embed_b.uploading') : t('dashboard.embed_b.uploadPc')}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onFile} className="hidden" disabled={subiendo} />
          </label>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// --- Vista previa estilo Discord ---
function Preview({ e, t }) {
  const imgSrc = urlImagen(e.imagenArchivo, e.imagenUrl);
  const thumbSrc = urlImagen(e.miniaturaArchivo, e.miniaturaUrl);
  const vacio = !e.titulo && !e.descripcion && !e.autorNombre && !imgSrc && !thumbSrc && !e.footer && e.campos.length === 0;
  return (
    <div className="rounded-xl bg-[#313338] p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">{t('dashboard.embed_b.preview')}</p>
      {vacio ? (
        <p className="py-6 text-center text-sm italic text-white/40">{t('dashboard.embed_b.previewEmpty')}</p>
      ) : (
        <div className="flex gap-3 rounded-md bg-[#2b2d31] p-3" style={{ borderLeft: `4px solid ${/^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : '#5865F2'}` }}>
          <div className="min-w-0 flex-1">
            {e.autorNombre && <p className="mb-1 text-sm font-semibold text-white">{e.autorNombre}</p>}
            {e.titulo && <p className="mb-1 font-bold text-[#00a8fc]">{e.titulo}</p>}
            {e.descripcion && <p className="whitespace-pre-wrap text-sm text-[#dbdee1]">{e.descripcion}</p>}
            {e.campos.length > 0 && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {e.campos.map((c, i) => (
                  <div key={i}>
                    <p className="text-xs font-bold text-white">{c.nombre || '—'}</p>
                    <p className="whitespace-pre-wrap text-xs text-[#dbdee1]">{c.valor || '—'}</p>
                  </div>
                ))}
              </div>
            )}
            {imgSrc && (
              <img src={imgSrc} alt="" className="mt-2 max-h-48 rounded-md object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
            )}
            {e.footer && <p className="mt-2 text-xs text-white/50">{e.footer}{e.fecha ? ' • hoy' : ''}</p>}
          </div>
          {thumbSrc && (
            <img src={thumbSrc} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
          )}
        </div>
      )}
    </div>
  );
}

export default function EmbedBuilder({ value, onChange, subirImagen }) {
  const { t } = useTranslation();
  const e = { ...EMBED_VACIO, ...value, campos: value?.campos || [] };
  const set = (k, v) => onChange({ ...e, [k]: v });

  const setCampo = (i, k, v) => {
    const campos = e.campos.map((c, idx) => (idx === i ? { ...c, [k]: v } : c));
    onChange({ ...e, campos });
  };
  const addCampo = () => onChange({ ...e, campos: [...e.campos, { nombre: '', valor: '', inline: false }] });
  const delCampo = (i) => onChange({ ...e, campos: e.campos.filter((_, idx) => idx !== i) });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Formulario */}
      <div className="space-y-4">
        <label className="block">
          <span className={label}>{t('dashboard.embed_b.author')}</span>
          <input value={e.autorNombre} onChange={(ev) => set('autorNombre', ev.target.value)} className={input} maxLength={256} placeholder={t('dashboard.embed_b.authorPh')} />
        </label>
        <label className="block">
          <span className={label}>{t('dashboard.embed_b.title')}</span>
          <input value={e.titulo} onChange={(ev) => set('titulo', ev.target.value)} className={input} maxLength={256} />
        </label>
        <label className="block">
          <span className={label}>{t('dashboard.embed_b.desc')}</span>
          <textarea value={e.descripcion} onChange={(ev) => set('descripcion', ev.target.value)} rows={4} className={input} maxLength={4096} />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="block">
            <span className={label}>{t('dashboard.embed_b.color')}</span>
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : '#5865F2'} onChange={(ev) => set('color', ev.target.value)} className="h-10 w-16 cursor-pointer rounded-lg border border-line bg-bg" />
          </label>
          <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm text-fg">
            <input type="checkbox" checked={e.fecha} onChange={(ev) => set('fecha', ev.target.checked)} className="h-4 w-4 cursor-pointer" />
            {t('dashboard.embed_b.timestamp')}
          </label>
        </div>

        <CampoImagen
          titulo={t('dashboard.embed_b.image')}
          url={e.imagenUrl} archivo={e.imagenArchivo}
          onChange={({ archivo, url }) => onChange({ ...e, imagenArchivo: archivo, imagenUrl: url })}
          subirImagen={subirImagen} t={t}
        />
        <CampoImagen
          titulo={t('dashboard.embed_b.thumb')}
          url={e.miniaturaUrl} archivo={e.miniaturaArchivo}
          onChange={({ archivo, url }) => onChange({ ...e, miniaturaArchivo: archivo, miniaturaUrl: url })}
          subirImagen={subirImagen} t={t}
        />

        <label className="block">
          <span className={label}>{t('dashboard.embed_b.footer')}</span>
          <input value={e.footer} onChange={(ev) => set('footer', ev.target.value)} className={input} maxLength={2048} />
        </label>

        {/* Campos */}
        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-fg">{t('dashboard.embed_b.fields')}</span>
            <button type="button" onClick={addCampo} className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand">
              <Plus size={14} /> {t('dashboard.embed_b.addField')}
            </button>
          </div>
          <div className="space-y-3">
            {e.campos.map((c, i) => (
              <div key={i} className="rounded-2xl border border-line bg-bg p-3">
                <div className="flex gap-2">
                  <input value={c.nombre} onChange={(ev) => setCampo(i, 'nombre', ev.target.value)} className={input} placeholder={t('dashboard.embed_b.fieldName')} maxLength={256} />
                  <button type="button" onClick={() => delCampo(i)} className="shrink-0 rounded-xl border border-line px-2 text-muted transition-colors hover:text-danger"><Trash2 size={15} /></button>
                </div>
                <textarea value={c.valor} onChange={(ev) => setCampo(i, 'valor', ev.target.value)} rows={2} className={input + ' mt-2'} placeholder={t('dashboard.embed_b.fieldValue')} maxLength={1024} />
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={!!c.inline} onChange={(ev) => setCampo(i, 'inline', ev.target.checked)} className="h-3.5 w-3.5 cursor-pointer" />
                  {t('dashboard.embed_b.inline')}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vista previa */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Preview e={e} t={t} />
      </div>
    </div>
  );
}
