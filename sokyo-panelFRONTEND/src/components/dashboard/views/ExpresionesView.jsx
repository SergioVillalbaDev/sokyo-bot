// Vista de Emojis y Stickers — gestión con arrastrar y soltar.
// Dos secciones: emojis (png/jpg/gif ≤256 KB) y stickers (png ≤512 KB).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smile, Sticker, UploadCloud, Trash2, Loader2, X } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

// Nombre limpio a partir del archivo (sin extensión, solo letras/números/_).
const nombreDeArchivo = (file) => file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'nuevo';
const leerDataUrl = (file) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); });

// Zona de arrastrar y soltar + selector de archivos.
function Dropzone({ onArchivos, accept, hint, subiendo }) {
  const { t } = useTranslation();
  const [arrastrando, setArrastrando] = useState(false);

  const soltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    if (e.dataTransfer.files?.length) onArchivos([...e.dataTransfer.files]);
  };

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={soltar}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${arrastrando ? 'border-brand bg-brand/5' : 'border-line bg-bg hover:border-brand/40'}`}
    >
      {subiendo ? <Loader2 size={28} className="animate-spin text-brand" /> : <UploadCloud size={28} className="text-muted" />}
      <p className="text-sm font-semibold text-fg">{t('dashboard.expr_v.drop')}</p>
      <p className="text-xs text-muted">{hint}</p>
      <input type="file" accept={accept} multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onArchivos([...e.target.files]); e.target.value = ''; }} />
    </label>
  );
}

export default function ExpresionesView({ dash }) {
  const { t } = useTranslation();
  const { emojisServidor, stickers, crearEmoji, eliminarEmoji, crearSticker, eliminarSticker } = dash;

  const [subiendoE, setSubiendoE] = useState(false);
  const [subiendoS, setSubiendoS] = useState(false);
  const [error, setError] = useState('');

  // Sube una tanda de archivos como emojis o stickers.
  const subir = async (archivos, crear, setSubiendo) => {
    setSubiendo(true); setError('');
    for (const file of archivos) {
      const datos = await leerDataUrl(file);
      const res = await crear({ nombre: nombreDeArchivo(file), datos });
      if (res?.error) setError(`${file.name}: ${res.error}`);
    }
    setSubiendo(false);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3">
          <X size={16} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-xs text-danger">{error}</p>
        </div>
      )}

      {/* ===== EMOJIS ===== */}
      <div data-help="expr-emojis" className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><Smile size={18} className="text-brand" /> {t('dashboard.expr_v.emojis')} <span className="text-sm font-normal text-muted">({emojisServidor.length})</span></h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.expr_v.emojisHint')}</p>

        <Dropzone onArchivos={(a) => subir(a, crearEmoji, setSubiendoE)} accept="image/png,image/jpeg,image/gif" hint={t('dashboard.expr_v.emojiLimits')} subiendo={subiendoE} />

        {emojisServidor.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {emojisServidor.map((e) => (
              <div key={e.id} className="group relative flex flex-col items-center gap-1 rounded-xl border border-line bg-bg p-2" title={`:${e.nombre}:`}>
                <img src={e.url} alt={e.nombre} className="h-9 w-9 object-contain" />
                <span className="max-w-[64px] truncate text-[10px] text-muted">{e.nombre}</span>
                <button onClick={() => eliminarEmoji(e.id)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100" title={t('dashboard.expr_v.delete')}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== STICKERS ===== */}
      <div data-help="expr-stickers" className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><Sticker size={18} className="text-brand" /> {t('dashboard.expr_v.stickers')} <span className="text-sm font-normal text-muted">({stickers.length})</span></h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.expr_v.stickersHint')}</p>

        <Dropzone onArchivos={(a) => subir(a, crearSticker, setSubiendoS)} accept="image/png" hint={t('dashboard.expr_v.stickerLimits')} subiendo={subiendoS} />

        {stickers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {stickers.map((s) => (
              <div key={s.id} className="group relative flex flex-col items-center gap-1 rounded-xl border border-line bg-bg p-2.5" title={s.nombre}>
                <img src={s.url} alt={s.nombre} className="h-20 w-20 object-contain" />
                <span className="max-w-[88px] truncate text-[11px] text-muted">{s.nombre}</span>
                <button onClick={() => eliminarSticker(s.id)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100" title={t('dashboard.expr_v.delete')}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
