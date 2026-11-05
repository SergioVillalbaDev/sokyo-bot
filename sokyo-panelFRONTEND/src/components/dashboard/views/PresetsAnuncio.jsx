// Barra de presets de anuncio reutilizable: lista de mensajes guardados (cargar
// / borrar) + guardar el mensaje actual como preset. La usan el Creador de
// Anuncios y los Anuncios programados.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, Save, Trash2, FileText, LayoutTemplate, Check, Pencil } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

// `sinGuardar`: sin la fila de guardar (el Creador de mensajes tiene su «Guardar»
// junto a «Enviar») y con los textos de «Mensajes guardados». `abierto`: el que se edita.
// `onGuardarActual`: botón «Guardar» también arriba, junto a la lista. `onRenombrar(p, nombre)`:
// lápiz para cambiar el nombre de uno sin tener que borrarlo y guardarlo otra vez.
export default function PresetsAnuncio({ presets, onCargar, onGuardar, onEliminar, sinGuardar = false, abierto = null, onGuardarActual = null, onRenombrar = null }) {
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-fg"><Bookmark size={18} className="text-brand" /> {t(sinGuardar ? 'dashboard.presets_a.titleSaved' : 'dashboard.presets_a.title')}</h3>
        {onGuardarActual && (
          <button type="button" onClick={onGuardarActual} className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-xs font-bold text-fg transition-colors hover:border-brand">
            <Save size={14} /> {t('dashboard.presets_a.saveCurrent')}
          </button>
        )}
      </div>

      {(!presets || presets.length === 0) ? (
        <p className="py-2 text-sm italic text-muted">{t(sinGuardar ? 'dashboard.presets_a.emptySaved' : 'dashboard.presets_a.empty')}</p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {presets.map((p) => (
            <div key={p._id} className={`flex items-center gap-1.5 rounded-full border bg-bg py-1 pl-3 pr-1.5 text-sm ${abierto === p._id ? 'border-brand ring-2 ring-brand/25' : 'border-line'}`}>
              <button type="button" onClick={() => onCargar(p)} className="flex items-center gap-1.5 font-semibold text-fg transition-colors hover:text-brand" title={t('dashboard.presets_a.load')}>
                {p.embed ? <LayoutTemplate size={13} className="text-muted" /> : <FileText size={13} className="text-muted" />}
                {p.nombre}
              </button>
              {onRenombrar && (
                <button type="button" onClick={() => { const n = window.prompt(t('dashboard.presets_a.renamePrompt'), p.nombre); if (n && n.trim() && n.trim() !== p.nombre) onRenombrar(p, n.trim().slice(0, 80)); }}
                  className="rounded-full p-1 text-muted transition-colors hover:text-brand" aria-label={t('dashboard.presets_a.rename')} title={t('dashboard.presets_a.rename')}><Pencil size={13} /></button>
              )}
              <button type="button" onClick={() => { if (window.confirm(t('dashboard.presets_a.confirmDelete', { n: p.nombre }))) onEliminar(p._id); }} className="rounded-full p-1 text-muted transition-colors hover:text-danger" aria-label={t('dashboard.presets_a.delete')}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {!sinGuardar && <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <input value={nombre} onChange={(e) => { setEstado(''); setNombre(e.target.value); }} className={input + ' max-w-xs'} placeholder={t('dashboard.presets_a.namePh')} maxLength={80} />
        <button type="button" onClick={guardar} disabled={!nombre.trim() || estado === 'guardando'} className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-4 py-2 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50">
          <Save size={15} /> {estado === 'guardando' ? t('dashboard.presets_a.saving') : t('dashboard.presets_a.save')}
        </button>
        {estado === 'ok' && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={15} /> {t('dashboard.presets_a.saved')}</span>}
        {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
      </div>}
    </div>
  );
}
