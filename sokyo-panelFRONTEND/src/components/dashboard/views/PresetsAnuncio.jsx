// Barra de presets de anuncio reutilizable: lista de mensajes guardados (cargar
// / borrar) + guardar el mensaje actual como preset. La usan el Creador de
// Anuncios y los Anuncios programados.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, Save, Trash2, FileText, LayoutTemplate, Check } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

export default function PresetsAnuncio({ presets, onCargar, onGuardar, onEliminar }) {
  const { t } = useTranslation();
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState(''); // '' | 'guardando' | 'ok' | 'error:...'

  const guardar = async () => {
    if (!nombre.trim()) return;
    setEstado('guardando');
    const r = await onGuardar(nombre.trim());
    setEstado(r && r.error ? `error:${r.error}` : 'ok');
    if (!(r && r.error)) setNombre('');
  };

  return (
    <div className={card}>
      <h3 className="mb-3 flex items-center gap-2 font-bold text-fg"><Bookmark size={18} className="text-brand" /> {t('dashboard.presets_a.title')}</h3>

      {(!presets || presets.length === 0) ? (
        <p className="py-2 text-sm italic text-muted">{t('dashboard.presets_a.empty')}</p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {presets.map((p) => (
            <div key={p._id} className="flex items-center gap-1.5 rounded-full border border-line bg-bg py-1 pl-3 pr-1.5 text-sm">
              <button type="button" onClick={() => onCargar(p)} className="flex items-center gap-1.5 font-semibold text-fg transition-colors hover:text-brand" title={t('dashboard.presets_a.load')}>
                {p.embed ? <LayoutTemplate size={13} className="text-muted" /> : <FileText size={13} className="text-muted" />}
                {p.nombre}
              </button>
              <button type="button" onClick={() => onEliminar(p._id)} className="rounded-full p-1 text-muted transition-colors hover:text-danger"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <input value={nombre} onChange={(e) => { setEstado(''); setNombre(e.target.value); }} className={input + ' max-w-xs'} placeholder={t('dashboard.presets_a.namePh')} maxLength={80} />
        <button type="button" onClick={guardar} disabled={!nombre.trim() || estado === 'guardando'} className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-4 py-2 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50">
          <Save size={15} /> {estado === 'guardando' ? t('dashboard.presets_a.saving') : t('dashboard.presets_a.save')}
        </button>
        {estado === 'ok' && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={15} /> {t('dashboard.presets_a.saved')}</span>}
        {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
      </div>
    </div>
  );
}
