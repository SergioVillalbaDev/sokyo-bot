// Constructor de embeds reutilizable: formulario + vista previa en vivo (estilo
// Discord). Controlado por el padre vía { value, onChange }. Lo usan EmbedsView
// (enviar ahora) y AnunciosView (programar).
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { EMBED_VACIO } from './embedDefaults';

const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const label = 'mb-1.5 block text-sm font-semibold text-fg';

// --- Vista previa estilo Discord ---
function Preview({ e, t }) {
  const vacio = !e.titulo && !e.descripcion && !e.autorNombre && !e.imagenUrl && !e.footer && e.campos.length === 0;
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
            {e.imagenUrl && /^https?:\/\//.test(e.imagenUrl) && (
              <img src={e.imagenUrl} alt="" className="mt-2 max-h-48 rounded-md object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
            )}
            {e.footer && <p className="mt-2 text-xs text-white/50">{e.footer}{e.fecha ? ' • hoy' : ''}</p>}
          </div>
          {e.miniaturaUrl && /^https?:\/\//.test(e.miniaturaUrl) && (
            <img src={e.miniaturaUrl} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
          )}
        </div>
      )}
    </div>
  );
}

export default function EmbedBuilder({ value, onChange }) {
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
        <label className="block">
          <span className={label}>{t('dashboard.embed_b.image')}</span>
          <input value={e.imagenUrl} onChange={(ev) => set('imagenUrl', ev.target.value)} className={input} placeholder="https://…" maxLength={500} />
        </label>
        <label className="block">
          <span className={label}>{t('dashboard.embed_b.thumb')}</span>
          <input value={e.miniaturaUrl} onChange={(ev) => set('miniaturaUrl', ev.target.value)} className={input} placeholder="https://…" maxLength={500} />
        </label>
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
