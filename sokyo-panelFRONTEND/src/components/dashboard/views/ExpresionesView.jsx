// Vista de Emojis y Stickers — gestión con arrastrar y soltar.
// Dos secciones: emojis (png/jpg/gif ≤256 KB) y stickers (png ≤512 KB).
// Emojis (1.9.10): al tocar uno se abre su ficha para cambiarle el nombre o borrarlo
// (también en el móvil, donde no hay «pasar el ratón»), se ven los huecos que quedan
// según el nivel de mejoras y los que Discord ha desactivado por falta de hueco.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smile, Sticker, UploadCloud, Trash2, Loader2, X, Check, AlertTriangle } from 'lucide-react';
import { prepararImagen, aDataUrl, textoErrorImagen } from '../../../lib/imagenes';
import { ACEPTA_IMAGEN, ACEPTA_SOLO_IMAGEN } from '../../../hooks/useSubidaImagen';

// Lo que admite Discord: emoji ≤ 256 KB (PNG, JPG o GIF), sticker PNG ≤ 512 KB.
const OPC_EMOJI = { max: 256 * 1024, sinWebp: true };
const OPC_STICKER = { max: 512 * 1024, sinWebp: true, video: false };

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

// Nombre limpio a partir del archivo (sin extensión, solo letras/números/_).
const nombreDeArchivo = (file) => file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'nuevo';

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

// Ficha de un emoji: cambiarle el nombre o borrarlo.
function FichaEmoji({ emoji, onRenombrar, onBorrar, onCerrar }) {
  const { t } = useTranslation();
  const [nombre, setNombre] = useState(emoji.nombre);
  const [estado, setEstado] = useState(''); // '' | 'guardando' | 'ok' | 'error:…'
  const limpio = nombre.trim().replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
  const guardar = async (ev) => {
    ev?.preventDefault();
    if (limpio.length < 2 || limpio === emoji.nombre) return;
    setEstado('guardando');
    const r = await onRenombrar(emoji.id, limpio);
    setEstado(r?.error ? `error:${r.error}` : 'ok');
    if (!r?.error) setNombre(limpio);
  };
  const borrar = async () => {
    if (!window.confirm(t('dashboard.expr_v.confirmDelete', { n: emoji.nombre }))) return;
    if (await onBorrar(emoji.id)) onCerrar(); else setEstado(`error:${t('dashboard.expr_v.deleteFail')}`);
  };
  return (
    <form onSubmit={guardar} className="mt-4 rounded-2xl border border-brand/40 bg-bg p-4">
      <div className="flex flex-wrap items-center gap-3">
        <img src={emoji.url} alt="" className={`h-12 w-12 object-contain ${emoji.disponible === false ? 'opacity-40 grayscale' : ''}`} />
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold text-muted" htmlFor={`emoji-${emoji.id}`}>{t('dashboard.expr_v.name')}</label>
          <div className="flex flex-wrap gap-2">
            <input id={`emoji-${emoji.id}`} value={nombre} onChange={(e) => { setNombre(e.target.value); setEstado(''); }} maxLength={32} disabled={emoji.disponible === false}
              className="w-full min-w-0 rounded-xl border border-line bg-card px-3 py-2 font-mono text-sm text-fg focus:border-brand focus:outline-none disabled:opacity-50 sm:w-auto sm:flex-1" />
            {emoji.disponible !== false && (
              <button type="submit" disabled={limpio.length < 2 || limpio === emoji.nombre || estado === 'guardando'}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-bold text-on-brand disabled:opacity-50">
                {estado === 'guardando' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {t('dashboard.expr_v.saveName')}
              </button>
            )}
          </div>
          {limpio !== nombre.trim() && limpio.length >= 2 && <p className="mt-1 text-xs text-muted">{t('dashboard.expr_v.nameWillBe', { n: limpio })}</p>}
        </div>
      </div>
      {emoji.disponible === false && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-fg"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" /> {t('dashboard.expr_v.unavailable')}</p>
      )}
      {estado === 'ok' && <p className="mt-2 text-xs font-semibold text-success">✓ {t('dashboard.expr_v.renamed')}</p>}
      {estado.startsWith('error:') && <p className="mt-2 text-xs font-semibold text-danger">{estado.slice(6)}</p>}
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={borrar} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted hover:border-danger hover:text-danger"><Trash2 size={13} /> {t('dashboard.expr_v.delete')}</button>
        <button type="button" onClick={onCerrar} className="rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:text-fg">{t('dashboard.expr_v.close')}</button>
      </div>
    </form>
  );
}

export default function ExpresionesView({ dash }) {
  const { t, i18n } = useTranslation();
  const { emojisServidor, stickers, crearEmoji, eliminarEmoji, renombrarEmoji, cargarLimiteEmojis, crearSticker, eliminarSticker } = dash;

  const [subiendoE, setSubiendoE] = useState(false);
  const [subiendoS, setSubiendoS] = useState(false);
  const [error, setError] = useState('');
  const [elegido, setElegido] = useState(null); // id del emoji con la ficha abierta
  const [limite, setLimite] = useState(null);   // { max, nivel }
  // Una vez al abrir (la vista se vuelve a montar al cambiar de servidor).
  const [cargarLimite] = useState(() => cargarLimiteEmojis);
  useEffect(() => { cargarLimite?.().then((l) => { if (l && l.max) setLimite(l); }); }, [cargarLimite]);
  const estaticos = emojisServidor.filter((e) => !e.animado).length;
  const animados = emojisServidor.length - estaticos;
  const desactivados = emojisServidor.filter((e) => e.disponible === false).length;
  const fichaDe = emojisServidor.find((e) => e.id === elegido) || null;

  // Sube una tanda de archivos como emojis o stickers. Antes se prepara cada uno
  // (lib/imagenes.js): un GIF del móvil que pasa de 256 KB se encoge hasta que cabe, un
  // vídeo corto se convierte en GIF y un WebP se pasa a PNG.
  const subir = async (archivos, crear, setSubiendo, opciones, sticker = false) => {
    setSubiendo(true); setError('');
    const fallos = [];
    for (const file of archivos) {
      try {
        const r = await prepararImagen(file, opciones);
        if (sticker && r.tipo !== 'image/png') { fallos.push(`${file.name}: ${t('dashboard.expr_v.stickerPng')}`); continue; }
        const res = await crear({ nombre: nombreDeArchivo(file), datos: await aDataUrl(r.archivo) });
        if (res?.error) fallos.push(`${file.name}: ${res.error}`);
      } catch (e) {
        fallos.push(`${file.name}: ${textoErrorImagen(e, t, { max: opciones.max, idioma: i18n.language })}`);
      }
    }
    setError(fallos.join(' · '));
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
        <p className="mb-3 text-xs text-muted">{t('dashboard.expr_v.emojisHint')}</p>
        {limite && (
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {[['static', estaticos], ['animated', animados]].map(([k, n]) => (
              <span key={k} className={`rounded-full px-2.5 py-1 font-semibold ${n >= limite.max ? 'bg-warning/15 text-warning' : 'bg-elevated text-muted'}`}>
                {t(`dashboard.expr_v.${k}`)}: {n} / {limite.max}{n >= limite.max ? ` · ${t('dashboard.expr_v.full')}` : ''}
              </span>
            ))}
            <span className="rounded-full bg-elevated px-2.5 py-1 text-muted">{t('dashboard.expr_v.boostLevel', { n: limite.nivel })}</span>
          </div>
        )}
        {desactivados > 0 && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs text-fg"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" /> {t('dashboard.expr_v.someUnavailable', { count: desactivados })}</p>
        )}

        <Dropzone onArchivos={(a) => subir(a, crearEmoji, setSubiendoE, OPC_EMOJI)} accept={ACEPTA_IMAGEN} hint={t('dashboard.expr_v.emojiLimits')} subiendo={subiendoE} />

        {emojisServidor.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {emojisServidor.map((e) => (
              <button key={e.id} type="button" onClick={() => setElegido(elegido === e.id ? null : e.id)} aria-pressed={elegido === e.id}
                className={`relative flex flex-col items-center gap-1 rounded-xl border bg-bg p-2 transition-colors ${elegido === e.id ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-brand/50'}`}
                title={e.disponible === false ? t('dashboard.expr_v.unavailableShort') : t('dashboard.expr_v.tapToEdit', { n: e.nombre })}>
                <img src={e.url} alt={e.nombre} className={`h-9 w-9 object-contain ${e.disponible === false ? 'opacity-40 grayscale' : ''}`} />
                <span className="max-w-[64px] truncate text-[10px] text-muted">{e.nombre}</span>
                {e.disponible === false && <AlertTriangle size={12} className="absolute -right-1 -top-1 text-warning" />}
              </button>
            ))}
          </div>
        )}
        {fichaDe && <FichaEmoji key={fichaDe.id} emoji={fichaDe} onRenombrar={renombrarEmoji} onBorrar={eliminarEmoji} onCerrar={() => setElegido(null)} />}
        {emojisServidor.length > 0 && !fichaDe && <p className="mt-3 text-xs text-muted">{t('dashboard.expr_v.tapHint')}</p>}
      </div>

      {/* ===== STICKERS ===== */}
      <div data-help="expr-stickers" className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><Sticker size={18} className="text-brand" /> {t('dashboard.expr_v.stickers')} <span className="text-sm font-normal text-muted">({stickers.length})</span></h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.expr_v.stickersHint')}</p>

        <Dropzone onArchivos={(a) => subir(a, crearSticker, setSubiendoS, OPC_STICKER, true)} accept={ACEPTA_SOLO_IMAGEN} hint={t('dashboard.expr_v.stickerLimits')} subiendo={subiendoS} />

        {stickers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {stickers.map((s) => (
              <div key={s.id} className="group relative flex flex-col items-center gap-1 rounded-xl border border-line bg-bg p-2.5" title={s.nombre}>
                <img src={s.url} alt={s.nombre} className="h-20 w-20 object-contain" />
                <span className="max-w-[88px] truncate text-[11px] text-muted">{s.nombre}</span>
                <button onClick={() => eliminarSticker(s.id)} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 pointer-coarse:opacity-100" title={t('dashboard.expr_v.delete')}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
