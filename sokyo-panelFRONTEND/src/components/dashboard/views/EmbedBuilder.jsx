// Constructor de embeds reutilizable: formulario + vista previa en vivo (estilo
// Discord). Controlado por el padre vía { value, onChange }. Permite tipografías
// "de fantasía" (Unicode), barra de formato Markdown, paletas de color, imagen/
// miniatura/iconos por URL o subida desde el PC (el bot los adjunta con
// attachment://). Lo usan EmbedsView y AnunciosView.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Upload, X, Bold, Italic, Underline, Strikethrough, Code, Quote, Heading1, Heading2, Heading3, List, Link2, Minus } from 'lucide-react';
import { API_URL } from '../../../lib/api';
import { ESTILOS_FUENTE_EMBED, estilizar } from '../../../lib/fancyText';
import { EMBED_VACIO, PALETAS_COLOR } from './embedDefaults';

const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const label = 'mb-1.5 block text-sm font-semibold text-fg';

// URL mostrable de una imagen: archivo subido (vía API) o URL externa http(s).
function urlImagen(archivo, url) {
  if (archivo) return `${API_URL}/uploads/${archivo}`;
  if (url && /^https?:\/\//.test(url)) return url;
  return '';
}

function leerComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Selector de tipografía: cada opción se muestra ya con su propio estilo.
// Si recibe `value` es controlado (modo "fuente activa"); si no, es de acción
// puntual (se aplica y vuelve al placeholder).
function SelectorFuente({ value, onPick, t }) {
  const controlado = value !== undefined;
  return (
    <select
      value={controlado ? value : ''}
      onChange={(e) => { const v = e.target.value; if (controlado || v) onPick(v); if (!controlado) e.target.value = ''; }}
      className={input + ' max-w-[10rem] shrink-0'}
      title={t('dashboard.embed_b.font')}
    >
      {!controlado && <option value="">🅰 {t('dashboard.embed_b.font')}</option>}
      <option value="normal">🅰 {t('dashboard.embed_b.fontNormal')}</option>
      {ESTILOS_FUENTE_EMBED.filter((id) => id !== 'normal').map((id) => (
        <option key={id} value={id}>{estilizar('Abcd 123', id)}</option>
      ))}
    </select>
  );
}

// Barra de formato Markdown (envuelve la selección o inserta texto).
function BarraFormato({ onWrap, onInsert, t }) {
  const btn = 'rounded-lg border border-line bg-bg p-1.5 text-muted transition-colors hover:border-brand hover:text-fg';
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.bold')} onClick={() => onWrap('**', '**')}><Bold size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.italic')} onClick={() => onWrap('*', '*')}><Italic size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.underline')} onClick={() => onWrap('__', '__')}><Underline size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.strike')} onClick={() => onWrap('~~', '~~')}><Strikethrough size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.code')} onClick={() => onWrap('`', '`')}><Code size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.quote')} onClick={() => onInsert('\n> ')}><Quote size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.h1')} onClick={() => onInsert('\n# ')}><Heading1 size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.h2')} onClick={() => onInsert('\n## ')}><Heading2 size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.h3')} onClick={() => onInsert('\n### ')}><Heading3 size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.list')} onClick={() => onInsert('\n- ')}><List size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.link')} onClick={() => onWrap('[', '](https://)')}><Link2 size={14} /></button>
      <button type="button" className={btn} title={t('dashboard.embed_b.fmt.divider')} onClick={() => onInsert('\n▬▬▬▬▬▬▬▬▬▬▬\n')}><Minus size={14} /></button>
    </div>
  );
}

// Campo de imagen/icono: input de URL + botón "Subir del PC" + estado del archivo.
function CampoImagen({ titulo, url, archivo, onChange, subirImagen, t }) {
  const [estado, setEstado] = useState('');
  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setEstado(`error:${t('dashboard.embed_b.tooBig')}`); return; }
    setEstado('subiendo');
    try {
      const dataUrl = await leerComoDataURL(file);
      const r = await subirImagen(dataUrl);
      if (r.error) setEstado(`error:${r.error}`);
      else { onChange({ archivo: r.archivo, url: '' }); setEstado(''); }
    } catch { setEstado(`error:${t('dashboard.embed_b.uploadFail')}`); }
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
            <Upload size={14} /> {estado === 'subiendo' ? t('dashboard.embed_b.uploading') : t('dashboard.embed_b.uploadPc')}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onFile} className="hidden" disabled={estado === 'subiendo'} />
          </label>
        </div>
      )}
      {estado.startsWith('error:') && <p className="mt-1 text-xs text-danger">{estado.slice(6)}</p>}
    </div>
  );
}

// --- Vista previa estilo Discord ---
function Preview({ e, t }) {
  const imgSrc = urlImagen(e.imagenArchivo, e.imagenUrl);
  const thumbSrc = urlImagen(e.miniaturaArchivo, e.miniaturaUrl);
  const autorIcono = urlImagen(e.autorIconoArchivo, e.autorIconoUrl);
  const footerIcono = urlImagen(e.footerIconoArchivo, e.footerIconoUrl);
  const vacio = !e.titulo && !e.descripcion && !e.autorNombre && !imgSrc && !thumbSrc && !e.footer && e.campos.length === 0;
  return (
    <div className="rounded-xl bg-[#313338] p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">{t('dashboard.embed_b.preview')}</p>
      {vacio ? (
        <p className="py-6 text-center text-sm italic text-white/40">{t('dashboard.embed_b.previewEmpty')}</p>
      ) : (
        <div className="flex gap-3 rounded-md bg-[#2b2d31] p-3" style={{ borderLeft: `4px solid ${/^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : '#5865F2'}` }}>
          <div className="min-w-0 flex-1">
            {e.autorNombre && (
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-white">
                {autorIcono && <img src={autorIcono} alt="" className="h-5 w-5 rounded-full object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />}
                {e.autorNombre}
              </p>
            )}
            {e.titulo && <p className={`mb-1 font-bold ${e.tituloUrl ? 'text-[#00a8fc]' : 'text-white'}`}>{e.titulo}</p>}
            {e.descripcion && <p className="whitespace-pre-wrap text-sm text-[#dbdee1]">{e.descripcion}</p>}
            {e.campos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {/* "En línea" = comparten fila (hasta 3); si no, ocupa la fila entera. */}
                {e.campos.map((c, i) => (
                  <div key={i} className={c.inline ? 'min-w-[30%] flex-1' : 'w-full'}>
                    <p className="text-xs font-bold text-white">{c.nombre || '—'}</p>
                    <p className="whitespace-pre-wrap text-xs text-[#dbdee1]">{c.valor || '—'}</p>
                  </div>
                ))}
              </div>
            )}
            {imgSrc && <img src={imgSrc} alt="" className="mt-2 max-h-48 rounded-md object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />}
            {(e.footer || footerIcono) && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-white/50">
                {footerIcono && <img src={footerIcono} alt="" className="h-4 w-4 rounded-full object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />}
                {e.footer}{e.fecha ? ' • hoy' : ''}
              </p>
            )}
          </div>
          {thumbSrc && <img src={thumbSrc} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />}
        </div>
      )}
    </div>
  );
}

export default function EmbedBuilder({ value, onChange, subirImagen }) {
  const { t } = useTranslation();
  const e = { ...EMBED_VACIO, ...value, campos: value?.campos || [] };
  const set = (k, v) => onChange({ ...e, [k]: v });
  const descRef = useRef(null);
  const [fuenteActiva, setFuenteActiva] = useState('normal'); // modo type-through de la descripción

  const setCampo = (i, k, v) => onChange({ ...e, campos: e.campos.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)) });
  const addCampo = () => onChange({ ...e, campos: [...e.campos, { nombre: '', valor: '', inline: false }] });
  const delCampo = (i) => onChange({ ...e, campos: e.campos.filter((_, idx) => idx !== i) });

  // Barra de formato sobre la descripción (envolver selección / insertar texto).
  const editarDesc = (fn) => {
    const ta = descRef.current;
    const val = e.descripcion || '';
    const s = ta ? (ta.selectionStart ?? val.length) : val.length;
    const en = ta ? (ta.selectionEnd ?? val.length) : val.length;
    const { texto, cursor } = fn(val, s, en);
    set('descripcion', texto);
    requestAnimationFrame(() => { if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = cursor; } });
  };
  const envolver = (pre, post) => editarDesc((val, s, en) => {
    const sel = val.slice(s, en);
    const texto = val.slice(0, s) + pre + sel + post + val.slice(en);
    // Sin selección: deja el cursor ENTRE los marcadores para escribir ya estilizado.
    const cursor = sel ? s + pre.length + sel.length + post.length : s + pre.length;
    return { texto, cursor };
  });
  const insertar = (txt) => editarDesc((val, s) => ({ texto: val.slice(0, s) + txt + val.slice(s), cursor: s + txt.length }));

  // Aplica una fuente a la selección de la descripción (o a todo si no hay selección).
  const fuenteDesc = (id) => editarDesc((val, s, en) => {
    const hay = s !== en;
    const ini = hay ? s : 0;
    const fin = hay ? en : val.length;
    const trozo = estilizar(val.slice(ini, fin), id);
    return { texto: val.slice(0, ini) + trozo + val.slice(fin), cursor: ini + trozo.length };
  });

  // Elige la "fuente activa": lo que se escriba a partir de ahora saldrá en ella.
  // Si hay texto seleccionado al elegirla, también lo convierte al momento.
  const elegirFuenteDesc = (id) => {
    setFuenteActiva(id);
    const ta = descRef.current;
    if (ta && ta.selectionStart !== ta.selectionEnd) fuenteDesc(id);
  };

  // onChange de la descripción: si hay fuente activa, estiliza solo lo recién tecleado.
  const onDescChange = (nuevo) => {
    const viejo = e.descripcion || '';
    if (fuenteActiva === 'normal' || nuevo.length <= viejo.length) { set('descripcion', nuevo); return; }
    // Localiza el tramo insertado (prefijo + sufijo común) y lo estiliza.
    let ini = 0;
    const min = Math.min(viejo.length, nuevo.length);
    while (ini < min && viejo[ini] === nuevo[ini]) ini++;
    let finV = viejo.length, finN = nuevo.length;
    while (finV > ini && finN > ini && viejo[finV - 1] === nuevo[finN - 1]) { finV--; finN--; }
    const estilizado = estilizar(nuevo.slice(ini, finN), fuenteActiva);
    const texto = nuevo.slice(0, ini) + estilizado + nuevo.slice(finN);
    set('descripcion', texto);
    const cursor = ini + estilizado.length;
    requestAnimationFrame(() => { const ta = descRef.current; if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = cursor; } });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Formulario */}
      <div className="space-y-4">
        {/* Autor */}
        <div>
          <span className={label}>{t('dashboard.embed_b.author')}</span>
          <div className="flex gap-2">
            <input value={e.autorNombre} onChange={(ev) => set('autorNombre', ev.target.value)} className={input} maxLength={256} placeholder={t('dashboard.embed_b.authorPh')} />
            <SelectorFuente onPick={(id) => set('autorNombre', estilizar(e.autorNombre, id))} t={t} />
          </div>
        </div>
        <label className="block">
          <span className={label}>{t('dashboard.embed_b.authorUrl')}</span>
          <input value={e.autorUrl} onChange={(ev) => set('autorUrl', ev.target.value)} className={input} placeholder="https://…" maxLength={500} />
        </label>
        <CampoImagen titulo={t('dashboard.embed_b.authorIcon')} url={e.autorIconoUrl} archivo={e.autorIconoArchivo}
          onChange={({ archivo, url }) => onChange({ ...e, autorIconoArchivo: archivo, autorIconoUrl: url })} subirImagen={subirImagen} t={t} />

        {/* Título */}
        <div>
          <span className={label}>{t('dashboard.embed_b.title')}</span>
          <div className="flex gap-2">
            <input value={e.titulo} onChange={(ev) => set('titulo', ev.target.value)} className={input} maxLength={256} />
            <SelectorFuente onPick={(id) => set('titulo', estilizar(e.titulo, id))} t={t} />
          </div>
        </div>
        <label className="block">
          <span className={label}>{t('dashboard.embed_b.titleUrl')}</span>
          <input value={e.tituloUrl} onChange={(ev) => set('tituloUrl', ev.target.value)} className={input} placeholder={t('dashboard.embed_b.titleUrlPh')} maxLength={500} />
        </label>

        {/* Descripción + barra de formato + fuente (sobre la selección) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-fg">{t('dashboard.embed_b.desc')}</span>
            <SelectorFuente value={fuenteActiva} onPick={elegirFuenteDesc} t={t} />
          </div>
          <BarraFormato onWrap={envolver} onInsert={insertar} t={t} />
          <textarea ref={descRef} value={e.descripcion} onChange={(ev) => onDescChange(ev.target.value)} rows={5} className={input} maxLength={4096} />
          <p className="mt-1 text-xs text-muted">{t('dashboard.embed_b.descHint')}</p>
        </div>

        {/* Color + paletas + fecha */}
        <div>
          <span className={label}>{t('dashboard.embed_b.color')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : '#5865F2'} onChange={(ev) => set('color', ev.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-bg" />
            <div className="flex flex-wrap gap-1.5">
              {PALETAS_COLOR.map((c) => (
                <button key={c} type="button" onClick={() => set('color', c)} title={c} style={{ backgroundColor: c }} className={`h-6 w-6 rounded-full border ${e.color?.toLowerCase() === c ? 'border-fg ring-2 ring-brand' : 'border-line'}`} />
              ))}
            </div>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-fg">
              <input type="checkbox" checked={e.fecha} onChange={(ev) => set('fecha', ev.target.checked)} className="h-4 w-4 cursor-pointer" />
              {t('dashboard.embed_b.timestamp')}
            </label>
          </div>
        </div>

        <CampoImagen titulo={t('dashboard.embed_b.image')} url={e.imagenUrl} archivo={e.imagenArchivo}
          onChange={({ archivo, url }) => onChange({ ...e, imagenArchivo: archivo, imagenUrl: url })} subirImagen={subirImagen} t={t} />
        <CampoImagen titulo={t('dashboard.embed_b.thumb')} url={e.miniaturaUrl} archivo={e.miniaturaArchivo}
          onChange={({ archivo, url }) => onChange({ ...e, miniaturaArchivo: archivo, miniaturaUrl: url })} subirImagen={subirImagen} t={t} />

        {/* Pie + icono */}
        <label className="block">
          <span className={label}>{t('dashboard.embed_b.footer')}</span>
          <input value={e.footer} onChange={(ev) => set('footer', ev.target.value)} className={input} maxLength={2048} />
        </label>
        <CampoImagen titulo={t('dashboard.embed_b.footerIcon')} url={e.footerIconoUrl} archivo={e.footerIconoArchivo}
          onChange={({ archivo, url }) => onChange({ ...e, footerIconoArchivo: archivo, footerIconoUrl: url })} subirImagen={subirImagen} t={t} />

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
