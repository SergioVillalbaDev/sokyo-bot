// Mi tarjeta de nivel: colores, fondo y diseños, con la vista previa REAL
// (la misma imagen PNG/GIF que genera el bot). Recibe portalFetch desde Portal.jsx.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Upload, X, Check, Loader2, Lock, Crown } from 'lucide-react';
import { PRESETS_TARJETA } from '../../presetsTarjeta';
import { Tarjeta, TituloVista } from './glass';
import { API_URL } from '../../lib/api';
import { estiloFondoTarjeta } from '../../lib/encuadreTarjeta';

const INICIAL = { colorAcento: '#5865F2', fondoTipo: 'color', fondoColor: '#1e2030', colorSecundario: '#9b59b6', fondoImagen: '', preset: null, animado: false };
// La tarjeta se genera a 900×270 px: con menos, el fondo saldría borroso.
const ANCHO_MIN = 900, ALTO_MIN = 270;

export default function TarjetaPortal({ portalFetch, usuario, avisar }) {
  const { t } = useTranslation();
  const [tarjeta, setTarjeta] = useState(INICIAL);
  const [catalogo, setCatalogo] = useState({ ocultos: [], personalizados: [] });
  const [cargada, setCargada] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [preview, setPreview] = useState('');
  const [generando, setGenerando] = useState(false);
  const previewRef = useRef('');
  const premium = !!usuario?.esPremium;

  useEffect(() => {
    let vivo = true;
    Promise.all([
      portalFetch('/api/portal/tarjeta').then((r) => r.json()).catch(() => ({})),
      portalFetch('/api/portal/presets').then((r) => r.json()).catch(() => ({})),
    ]).then(([tj, cat]) => {
      if (!vivo) return;
      if (tj && tj.colorAcento) setTarjeta({ ...INICIAL, ...tj, fondoImagen: tj.fondoImagen || '', preset: tj.preset || null, animado: !!tj.animado });
      setCatalogo({ ocultos: cat?.ocultos || [], personalizados: cat?.personalizados || [] });
      setCargada(true);
    });
    return () => {
      vivo = false;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vista previa con un pequeño retardo para no pedir una imagen por cada tecla.
  useEffect(() => {
    if (!cargada) return undefined;
    const id = setTimeout(() => {
      setGenerando(true);
      portalFetch('/api/portal/tarjeta/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tarjeta) })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('preview'))))
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          if (previewRef.current) URL.revokeObjectURL(previewRef.current);
          previewRef.current = url;
          setPreview(url);
        })
        .catch(() => {})
        .finally(() => setGenerando(false));
    }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjeta, cargada]);

  const cambiar = (campo, valor) => { setCambios(true); setTarjeta((x) => ({ ...x, [campo]: valor })); };
  // Tocar un color a mano deja de coincidir con un diseño: se deselecciona.
  const manual = (campo, valor) => { setCambios(true); setTarjeta((x) => ({ ...x, [campo]: valor, preset: null, animado: false })); };
  const aplicar = (p) => {
    if (p.premium !== false && !premium) return;
    setCambios(true);
    // Un diseño con imagen o GIF: el bot la toma del catálogo (como esté ahora, ajustada).
    setTarjeta((x) => ({ ...x, colorAcento: p.colorAcento, fondoColor: p.fondoColor, colorSecundario: p.colorSecundario, fondoTipo: p.fondoTipo, preset: p.id, animado: !!p.animado, ...(p.fondoTipo === 'imagen' && p.fondoImagen ? { fondoImagen: p.fondoImagen } : {}) }));
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await portalFetch('/api/portal/tarjeta', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tarjeta) });
      if (res.ok) { setCambios(false); avisar(t('portal.card.savedToast'), 'ok'); } else avisar(t('portal.card.saveError'), 'error');
    } catch { avisar(t('portal.card.saveError'), 'error'); } finally { setGuardando(false); }
  };

  const subir = (e) => {
    const archivo = e.target.files?.[0]; e.target.value = '';
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = async () => {
        if (img.naturalWidth < ANCHO_MIN || img.naturalHeight < ALTO_MIN) {
          avisar(t('portal.card.imgTooSmall', { w: img.naturalWidth, h: img.naturalHeight, minW: ANCHO_MIN, minH: ALTO_MIN }), 'error');
          return;
        }
        const res = await portalFetch('/api/portal/tarjeta/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datos: lector.result }) });
        const d = await res.json().catch(() => ({}));
        if (d.url) cambiar('fondoImagen', d.url); else avisar(d.error || t('portal.card.imgUploadError'), 'error');
      };
      img.onerror = () => avisar(t('portal.card.imgReadError'), 'error');
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  };

  const presets = [
    ...PRESETS_TARJETA.filter((p) => !catalogo.ocultos.includes(p.id)).map((p) => ({ ...p, premium: true })),
    ...catalogo.personalizados.map((p) => ({
      id: p.id, nombre: p.nombre, colorAcento: p.colorAcento, fondoColor: p.fondoColor, colorSecundario: p.colorSecundario,
      fondoTipo: p.fondoTipo || 'degradado', animado: !!p.animado, premium: !!p.premium,
      fondoImagen: p.fondoTipo === 'imagen' ? p.fondoImagen || null : null, encuadre: p.encuadre || null,
      swatch: p.fondoTipo === 'color' ? p.fondoColor : `linear-gradient(135deg, ${p.fondoColor}, ${p.colorSecundario})`,
    })),
  ];
  const etiqueta = 'text-sm font-semibold text-fg';
  const color = 'h-10 w-16 cursor-pointer rounded-xl border border-line bg-transparent p-0.5';

  return (
    <div>
      <TituloVista icono={Palette} color="#a855f7" titulo={t('portal.card.title')} subtitulo={t('portal.card.subtitle')} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {/* Vista previa REAL */}
          <Tarjeta brillo halo className="overflow-hidden p-2 lg:sticky lg:top-4">
            <div className="relative overflow-hidden rounded-[16px] bg-black/40" style={{ aspectRatio: '900 / 270' }}>
              {preview
                ? <img src={preview} alt={t('portal.card.previewAlt')} className="block h-full w-full object-cover" />
                : <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">{t('portal.card.previewGenerating')}</div>}
              {generando && (
                <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-xs text-white">
                  <Loader2 size={12} className="animate-spin" /> {t('portal.card.previewUpdating')}
                </div>
              )}
            </div>
            <p className="px-2 pb-1 pt-2.5 text-xs text-muted">{t('portal.card.previewHint')}</p>
          </Tarjeta>
        </div>

        <Tarjeta className="flex flex-col gap-4 p-5 lg:col-span-2">
          <label className="flex items-center justify-between gap-3">
            <span className={etiqueta}>{t('portal.card.accentColor')}</span>
            <input type="color" value={tarjeta.colorAcento} onChange={(e) => manual('colorAcento', e.target.value)} className={color} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className={etiqueta}>{t('portal.card.bgType')}</span>
            <select value={tarjeta.fondoTipo} onChange={(e) => manual('fondoTipo', e.target.value)} className="gx-input w-44 py-2">
              <option value="color">{t('portal.card.bgTypeSolid')}</option>
              <option value="degradado">{t('portal.card.bgTypeGradient')}</option>
              <option value="imagen" disabled={!premium}>{t('portal.card.bgTypeImage')}</option>
            </select>
          </label>
          {(tarjeta.fondoTipo === 'color' || tarjeta.fondoTipo === 'degradado') && (
            <label className="flex items-center justify-between gap-3">
              <span className={etiqueta}>{t('portal.card.bgColor')}</span>
              <input type="color" value={tarjeta.fondoColor} onChange={(e) => manual('fondoColor', e.target.value)} className={color} />
            </label>
          )}
          {tarjeta.fondoTipo === 'degradado' && (
            <label className="flex items-center justify-between gap-3">
              <span className={etiqueta}>{t('portal.card.secondaryColor')}</span>
              <input type="color" value={tarjeta.colorSecundario} onChange={(e) => manual('colorSecundario', e.target.value)} className={color} />
            </label>
          )}
          {/* Con un diseño elegido, la imagen es la suya: aquí solo la propia. */}
          {tarjeta.fondoTipo === 'imagen' && !tarjeta.preset && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <span className={etiqueta}>{t('portal.card.bgImageLabel')} <span className="text-amber-300">{t('portal.card.bgImagePremium')}</span></span>
              <div className="flex gap-2">
                <input value={tarjeta.fondoImagen} onChange={(e) => cambiar('fondoImagen', e.target.value)} placeholder={t('portal.card.bgImagePlaceholder')} className="gx-input flex-1 py-2" />
                <label className="gx-btn gx-btn-primario cursor-pointer px-3.5 py-2">
                  <Upload size={14} /> {t('portal.card.upload')}
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={subir} className="hidden" />
                </label>
              </div>
              <span className="text-xs text-muted">{t('portal.card.bgImageHint')}</span>
              {tarjeta.fondoImagen && (
                <button onClick={() => cambiar('fondoImagen', '')} className="gx-btn w-fit px-3 py-1.5 text-xs"><X size={12} /> {t('portal.card.removeImage')}</button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5 border-t border-line pt-4">
            <span className={etiqueta}>{t('portal.card.presetsTitle')}</span>
            {!premium && <span className="flex items-center gap-1.5 text-xs text-muted"><Crown size={12} className="text-amber-300" /> {t('portal.card.presetsLockedHint')}</span>}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
              {presets.map((p) => {
                const bloqueado = p.premium !== false && !premium;
                const activo = tarjeta.preset === p.id;
                return (
                  <button
                    key={p.id} onClick={() => aplicar(p)} disabled={bloqueado} aria-pressed={activo}
                    className={`overflow-hidden rounded-2xl border-2 text-left transition-all ${activo ? 'border-fuchsia-400 shadow-[0_0_22px_-6px_rgba(217,70,239,.9)]' : 'border-white/10'} ${bloqueado ? 'cursor-not-allowed' : 'hover:border-white/30'}`}
                  >
                    <div className="relative overflow-hidden" style={{ aspectRatio: '900 / 270', background: p.fondoImagen ? p.fondoColor : (p.swatch || `linear-gradient(135deg, ${p.fondoColor}, ${p.colorSecundario})`) }}>
                      {p.fondoImagen && <img src={p.fondoImagen.startsWith('/uploads/') ? `${API_URL}${p.fondoImagen}` : p.fondoImagen} alt="" loading="lazy" style={estiloFondoTarjeta(p.encuadre)} />}
                      <span className="absolute bottom-1.5 left-2 h-4 w-4 rounded-full border-2" style={{ borderColor: p.colorAcento }} />
                      {(p.animado || /\.gif$/i.test(p.fondoImagen || '')) && <span className="absolute right-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">✨ GIF</span>}
                      {bloqueado && <span className="absolute inset-0 grid place-items-center bg-black/50 text-white"><Lock size={16} /></span>}
                    </div>
                    <div className="bg-white/[.04] px-2 py-1.5 text-xs font-semibold text-fg">{p.nombre}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={guardar} disabled={guardando || !cambios} className="gx-btn gx-btn-primario mt-1 w-full py-3">
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {cambios ? t('portal.card.save') : t('portal.card.saved')}
          </button>
        </Tarjeta>
      </div>
    </div>
  );
}
