// Componentes compartidos de la sección Comunidad: selector de hora amigable
// (con preview en la zona horaria del usuario) y subida de imágenes desde el PC.
import { useState } from 'react';
import { Upload, Clock, Image as ImageIcon, X } from 'lucide-react';

const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const label = 'mb-1.5 block text-sm font-semibold text-fg';

// Zona horaria detectada del navegador (p. ej. "Europe/Madrid").
export const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone || 'tu zona';

function isoLocalPreview(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}

// Convierte un valor de <input datetime-local> (hora local) a ISO UTC.
function localAIso(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

// Presets de duración (minutos) para "cierra en…".
const PRESETS = [
  { label: '30 minutos', min: 30 },
  { label: '1 hora', min: 60 },
  { label: '6 horas', min: 360 },
  { label: '12 horas', min: 720 },
  { label: '1 día', min: 1440 },
  { label: '3 días', min: 4320 },
  { label: '1 semana', min: 10080 },
];

// Selector de CIERRE para sorteos/encuestas: elige una duración rápida o una
// fecha personalizada. Devuelve siempre un ISO UTC en onChange.
export function CierrePicker({ value, onChange, titulo = 'Cuándo se cierra' }) {
  const [modo, setModo] = useState('preset'); // 'preset' | 'custom'
  const [preset, setPreset] = useState('');

  const elegirPreset = (min) => {
    setPreset(String(min));
    if (!min) { onChange(''); return; }
    onChange(new Date(Date.now() + Number(min) * 60000).toISOString());
  };

  const preview = isoLocalPreview(value);

  return (
    <div>
      <span className={label}>{titulo}</span>
      <div className="mb-2 flex gap-2">
        <button type="button" onClick={() => setModo('preset')}
          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${modo === 'preset' ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-fg'}`}>
          ⏱️ Duración
        </button>
        <button type="button" onClick={() => setModo('custom')}
          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${modo === 'custom' ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-fg'}`}>
          📅 Fecha exacta
        </button>
      </div>

      {modo === 'preset' ? (
        <select value={preset} onChange={(e) => elegirPreset(e.target.value)} className={input}>
          <option value="">Elige cuánto dura…</option>
          {PRESETS.map((p) => <option key={p.min} value={p.min}>{p.label}</option>)}
        </select>
      ) : (
        <input type="datetime-local" className={input}
          onChange={(e) => onChange(localAIso(e.target.value))} />
      )}

      {preview && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
          <Clock size={11} /> Cierra: {preview} <span className="text-muted">({ZONA})</span>
        </p>
      )}
    </div>
  );
}

// Selector de FECHA EXACTA para eventos: datetime-local con preview y zona.
export function FechaPicker({ value, onChange, titulo = 'Fecha y hora' }) {
  const preview = isoLocalPreview(value);
  return (
    <div>
      <span className={label}>{titulo} <span className="font-normal text-muted">· tu hora ({ZONA})</span></span>
      <input type="datetime-local" className={input}
        onChange={(e) => onChange(localAIso(e.target.value))} />
      {preview && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
          <Clock size={11} /> {preview}
        </p>
      )}
    </div>
  );
}

function leerComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Campo de imagen: URL manual o "Subir del PC". Devuelve la URL en onChange.
export function SubirImagen({ value, onChange, subirImagen, titulo = 'Imagen' }) {
  const [estado, setEstado] = useState('');

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setEstado('error:La imagen supera los 8 MB'); return; }
    setEstado('subiendo');
    try {
      const dataUrl = await leerComoDataURL(file);
      const r = await subirImagen(dataUrl);
      if (r.error) setEstado(`error:${r.error}`);
      else { onChange(r.url); setEstado(''); }
    } catch { setEstado('error:Fallo al subir'); }
  };

  return (
    <div>
      <span className={label}>{titulo} <span className="font-normal text-muted">(opcional)</span></span>
      {value ? (
        <div className="flex items-center gap-2">
          <img src={value} alt="" className="h-12 w-20 rounded-lg border border-line object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
          <span className="flex-1 truncate text-xs text-success">✓ Imagen lista</span>
          <button type="button" onClick={() => onChange('')} className="rounded-xl border border-line px-2 py-2 text-muted transition-colors hover:text-danger">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input value="" onChange={(e) => onChange(e.target.value)} className={`${input} flex-1`} placeholder="https://… o sube del PC" />
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2 text-xs font-semibold text-fg transition-colors hover:border-brand">
            {estado === 'subiendo' ? <ImageIcon size={14} className="animate-pulse" /> : <Upload size={14} />}
            {estado === 'subiendo' ? 'Subiendo…' : 'Subir del PC'}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onFile} className="hidden" disabled={estado === 'subiendo'} />
          </label>
        </div>
      )}
      {estado.startsWith('error:') && <p className="mt-1 text-xs text-danger">{estado.slice(6)}</p>}
    </div>
  );
}
