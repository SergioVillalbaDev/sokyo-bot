// Fondo de un diseño de tarjeta de nivel del catálogo (Niveles → Diseños de tarjeta):
// la muestra con la forma de la tarjeta y, si el fondo es una imagen o un GIF, subirla,
// ajustarla (mover, ampliar, girar: RecortarImagen, forma «tarjeta») y quitarla. Además,
// «Ver la tarjeta real» pide al bot la misma imagen que mandará (PNG o GIF).
// El encuadre lo aplica el bot al dibujarla (utils/rankCard.js); aquí se pinta igual
// con lib/encuadreTarjeta.js.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Crop, X, Eye, Loader2 } from 'lucide-react';
import { API_URL, apiFetch } from '../../lib/api';
import { estiloFondoTarjeta } from '../../lib/encuadreTarjeta';
import RecortarImagen from './RecortarImagen';

const MAX_BYTES = 8 * 1024 * 1024; // lo que admite /api/paneles/upload
const urlDe = (ruta) => (ruta && ruta.startsWith('/uploads/') ? `${API_URL}${ruta}` : ruta || '');
const boton = 'flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50';

// La muestra: color o degradado, la imagen encima con su encuadre y el borde de acento.
export function MuestraDiseno({ p, className = '' }) {
  const fondo = p.fondoTipo === 'color' ? p.fondoColor : `linear-gradient(135deg, ${p.fondoColor}, ${p.colorSecundario})`;
  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ aspectRatio: '900 / 270', background: p.fondoTipo === 'imagen' ? p.fondoColor : fondo, border: `2px solid ${p.colorAcento}` }}>
      {p.fondoTipo === 'imagen' && p.fondoImagen && (
        <>
          <img src={urlDe(p.fondoImagen)} alt="" style={estiloFondoTarjeta(p.encuadre)} />
          <div className="absolute inset-0 bg-[rgba(18,20,32,0.38)]" />
        </>
      )}
    </div>
  );
}

export default function FondoDiseno({ p, onCambiar, subirImagen }) {
  const { t } = useTranslation();
  const [ajustando, setAjustando] = useState(null); // { archivo, nuevo, inicial }
  const [estado, setEstado] = useState(''); // '', 'subiendo', 'error:<texto>'
  const [real, setReal] = useState(null); // { url, cargando }
  const urlReal = useRef('');
  useEffect(() => () => { if (urlReal.current) URL.revokeObjectURL(urlReal.current); }, []);

  const elegir = (ev) => {
    const archivo = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!archivo) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(archivo.type)) { setEstado(`error:${t('dashboard.niveles_v.catImgType')}`); return; }
    if (archivo.size > MAX_BYTES) { setEstado(`error:${t('dashboard.niveles_v.catImgBig')}`); return; }
    setEstado('');
    setAjustando({ archivo, nuevo: true, inicial: null });
  };

  // Retocar la imagen ya subida: se abre la original con el encuadre de antes.
  const ajustar = async () => {
    try {
      const r = await fetch(urlDe(p.fondoImagen));
      if (!r.ok) throw new Error('descarga');
      const blob = await r.blob();
      setAjustando({ archivo: new File([blob], 'fondo', { type: blob.type }), nuevo: false, inicial: p.encuadre || null });
    } catch { setEstado(`error:${t('dashboard.recorte.noAjustable')}`); }
  };

  const listo = async (resultado) => {
    const { archivo, nuevo } = ajustando;
    setAjustando(null);
    if (!resultado || !resultado.encuadre) return;
    if (!nuevo) { onCambiar({ encuadre: resultado.encuadre }); return; }
    setEstado('subiendo');
    const datos = await new Promise((ok) => { const l = new FileReader(); l.onload = () => ok(l.result); l.onerror = () => ok(null); l.readAsDataURL(archivo); });
    const r = datos ? await subirImagen(datos) : { error: t('dashboard.recorte.errorCargar') };
    if (!r || r.error || !r.archivo) { setEstado(`error:${(r && r.error) || t('dashboard.niveles_v.catImgError')}`); return; }
    setEstado('');
    onCambiar({ fondoImagen: `/uploads/${r.archivo}`, encuadre: resultado.encuadre });
  };

  const verReal = async () => {
    setReal({ url: real && real.url, cargando: true });
    try {
      const r = await apiFetch('/api/presets-tarjeta/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      if (!r.ok) throw new Error('preview');
      const url = URL.createObjectURL(await r.blob());
      if (urlReal.current) URL.revokeObjectURL(urlReal.current);
      urlReal.current = url;
      setReal({ url, cargando: false });
    } catch {
      setReal(null);
      setEstado(`error:${t('dashboard.niveles_v.catPreviewError')}`);
    }
  };

  const esImagen = p.fondoTipo === 'imagen';
  return (
    <div className="mt-3 space-y-2">
      <MuestraDiseno p={p} className="w-full max-w-md" />
      <div className="flex flex-wrap items-center gap-2">
        {esImagen && (
          <label className={`${boton} cursor-pointer`}>
            {estado === 'subiendo' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {p.fondoImagen ? t('dashboard.niveles_v.catImgChange') : t('dashboard.niveles_v.catImgUpload')}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={elegir} className="hidden" disabled={estado === 'subiendo'} />
          </label>
        )}
        {esImagen && p.fondoImagen && (
          <>
            <button type="button" onClick={ajustar} className={boton}><Crop size={13} /> {t('dashboard.recorte.ajustar')}</button>
            <button type="button" onClick={() => onCambiar({ fondoImagen: null, encuadre: null })} className={`${boton} hover:border-danger/40 hover:text-danger`}><X size={13} /> {t('dashboard.recorte.quitar')}</button>
          </>
        )}
        <button type="button" onClick={verReal} disabled={real && real.cargando} className={boton}>
          {real && real.cargando ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} {t('dashboard.niveles_v.catPreviewReal')}
        </button>
      </div>
      {esImagen && !p.fondoImagen && <p className="text-xs text-muted">{t('dashboard.niveles_v.catImgHint')}</p>}
      {estado.startsWith('error:') && <p className="text-xs font-semibold text-danger">{estado.slice(6)}</p>}
      {real && real.url && (
        <div className="relative max-w-md">
          <img src={real.url} alt={t('dashboard.niveles_v.catPreviewReal')} className="w-full rounded-xl" />
          <button type="button" onClick={() => setReal(null)} className="absolute right-1.5 top-1.5 rounded-lg bg-black/60 p-1 text-white" aria-label={t('dashboard.recorte.cancelar')}><X size={13} /></button>
        </div>
      )}
      {ajustando && (
        <RecortarImagen archivo={ajustando.archivo} forma="tarjeta" inicial={ajustando.inicial} fondoBase={p.fondoColor}
          onCancelar={() => setAjustando(null)} onListo={listo} />
      )}
    </div>
  );
}
