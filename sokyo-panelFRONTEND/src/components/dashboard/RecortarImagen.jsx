// Ventana para ajustar una imagen antes de subirla (icono del autor, del pie,
// miniatura o imagen grande de un embed). Se mueve arrastrando, se amplía con la
// barra o la rueda, se gira y, si es un logo, «Que se vea entera» lo mete completo
// en el círculo de Discord en vez de cortarlo. Abajo, cómo quedará en Discord.
// La geometría está en lib/recorte.js. Los GIF se suben tal cual (recortados
// dejarían de moverse). Textos: dashboard.recorte.
// Forma «tarjeta» (fondo de la tarjeta de nivel): no recorta, devuelve el encuadre
// ({ encuadre: { escala, x, y, giro, ancho, alto } }) y el bot dibuja la imagen así;
// por eso ahí también se ajustan los GIF. `inicial` = el encuadre de antes (para
// retocarlo) y `fondoBase` = el color que se ve donde la imagen no llega.
// Se pinta en la raíz del panel (portal): dentro de una tarjeta con cristal o
// animación, una ventana `fixed` se coloca respecto a la tarjeta y sale cortada.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Crop, RotateCw, ZoomIn, ZoomOut, RotateCcw, Upload } from 'lucide-react';
import {
  FORMAS, ZOOM_MIN, ZOOM_MAX, tamanoGirado, proporcionDe, escalaBase,
  limitarDesplazamiento, dibujarImagen, anchoSalida, tipoSalida,
} from '../../lib/recorte';

const ANCHO_LIENZO = 360;      // píxeles CSS del editor (se encoge en el móvil)
const MARCO = 0.8;             // parte del ancho del editor que ocupa el marco
const FONDOS = [null, '#ffffff', '#000000'];
const NOMBRE_PROPORCION = { original: 'original', [16 / 9]: '16:9', 3: '3:1', 1: '1:1' };

// Modo con el que se abre: si la imagen es mucho más ancha o alta que el marco
// (un logo, un banner), se muestra entera; si no, rellenando.
function modoInicial(img, forma) {
  if (forma === 'ancho' || forma === 'tarjeta') return 'rellenar';
  const r = img.naturalWidth / img.naturalHeight;
  return r > 1.25 || r < 0.8 ? 'entera' : 'rellenar';
}

// Forma del marco como trazo (círculo o rectángulo) centrado en (cx, cy).
function trazarMarco(ctx, circular, cx, cy, w, h) {
  if (circular) ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
  else ctx.rect(cx - w / 2, cy - h / 2, w, h);
}

// Fondo de cuadros (transparencia) dentro del marco.
function cuadros(ctx, x, y, w, h, lado) {
  for (let fy = 0; fy * lado < h; fy++) {
    for (let fx = 0; fx * lado < w; fx++) {
      ctx.fillStyle = (fx + fy) % 2 ? '#3a3c42' : '#2b2d31';
      ctx.fillRect(x + fx * lado, y + fy * lado, lado, lado);
    }
  }
}

// Recorte final (o la miniatura de la vista previa) como data URL.
function exportar(img, estado, proporcion, ancho, fondo, tipo) {
  const alto = Math.max(1, Math.round(ancho / proporcion));
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (fondo) { ctx.fillStyle = fondo; ctx.fillRect(0, 0, ancho, alto); }
  ctx.imageSmoothingQuality = 'high';
  dibujarImagen(ctx, img, estado, ancho, ancho / 2, alto / 2);
  return lienzo.toDataURL(tipo, 0.92);
}

export default function RecortarImagen({ archivo, forma = 'circulo', onCancelar, onListo, inicial = null, fondoBase = null }) {
  const { t } = useTranslation();
  const conf = FORMAS[forma] || FORMAS.circulo;
  const esGif = archivo.type === 'image/gif';
  // Un GIF solo se puede ajustar si no se recorta (forma con encuadre).
  const ajustable = !esGif || !!conf.encuadre;
  const fondoInicial = conf.encuadre ? (fondoBase || '#1e2030') : null;

  const [img, setImg] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [giro, setGiro] = useState(0);
  const [eleccion, setEleccion] = useState(conf.proporciones[0]);
  const [modo, setModo] = useState('rellenar');
  const [zoom, setZoom] = useState(1);
  const [desp, setDesp] = useState({ x: 0, y: 0 });
  const [fondo, setFondo] = useState(fondoInicial);
  const lienzo = useRef(null);
  const arrastre = useRef(null);
  const cerrar = useRef(null);

  // Abrir la imagen elegida.
  useEffect(() => {
    let vivo = true;
    const url = URL.createObjectURL(archivo);
    const im = new Image();
    im.onload = () => {
      if (!vivo) return;
      setImg(im);
      setModo(modoInicial(im, forma));
      // Retocar un encuadre guardado: se vuelve a poner como estaba.
      if (inicial && inicial.escala > 0 && conf.proporciones.length === 1 && typeof conf.proporciones[0] === 'number') {
        const giroAntes = [0, 90, 180, 270].includes(inicial.giro) ? inicial.giro : 0;
        const base = escalaBase(tamanoGirado(im.naturalWidth, im.naturalHeight, giroAntes), conf.proporciones[0], 'rellenar', false);
        setModo('rellenar');
        setGiro(giroAntes);
        setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, inicial.escala / base)));
        setDesp({ x: Number(inicial.x) || 0, y: Number(inicial.y) || 0 });
      }
    };
    im.onerror = () => { if (vivo) setFallo(true); };
    im.src = url;
    return () => { vivo = false; URL.revokeObjectURL(url); };
    // `inicial` solo cuenta al abrir la imagen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo, forma]);

  // Escape cierra; el foco va a la ventana al abrirla.
  useEffect(() => {
    cerrar.current?.focus();
    const alTeclear = (e) => { if (e.key === 'Escape') onCancelar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCancelar]);

  const tam = img ? tamanoGirado(img.naturalWidth, img.naturalHeight, giro) : { w: 1, h: 1 };
  const proporcion = proporcionDe(eleccion, tam);
  const escala = escalaBase(tam, proporcion, modo, conf.circular) * zoom;
  const despOk = limitarDesplazamiento(desp, tam, escala, proporcion);
  const estado = useMemo(() => ({ giro, escala, desp: despOk }), [giro, escala, despOk.x, despOk.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // Editor: la imagen entera (lo de fuera del marco, oscurecido) y el marco encima.
  const altoMarcoCss = (ANCHO_LIENZO * MARCO) / proporcion;
  const altoLienzoCss = altoMarcoCss + ANCHO_LIENZO * (1 - MARCO);
  useEffect(() => {
    const c = lienzo.current;
    if (!c || !img) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(ANCHO_LIENZO * dpr);
    c.height = Math.round(altoLienzoCss * dpr);
    const ctx = c.getContext('2d');
    const px = ANCHO_LIENZO * MARCO * dpr;
    const fw = px;
    const fh = px / proporcion;
    const cx = c.width / 2;
    const cy = c.height / 2;

    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.beginPath();
    trazarMarco(ctx, conf.circular, cx, cy, fw, fh);
    ctx.clip();
    if (fondo) { ctx.fillStyle = fondo; ctx.fillRect(cx - fw / 2, cy - fh / 2, fw, fh); }
    else cuadros(ctx, cx - fw / 2, cy - fh / 2, fw, fh, 10 * dpr);
    ctx.restore();

    ctx.imageSmoothingQuality = 'high';
    dibujarImagen(ctx, img, estado, px, cx, cy);

    // Velo fuera del marco y borde.
    ctx.beginPath();
    ctx.rect(0, 0, c.width, c.height);
    trazarMarco(ctx, conf.circular, cx, cy, fw, fh);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fill('evenodd');
    ctx.beginPath();
    trazarMarco(ctx, conf.circular, cx, cy, fw, fh);
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
  }, [img, estado, proporcion, fondo, conf.circular, altoLienzoCss]);

  // Rueda del ratón = ampliar (sin mover la página).
  useEffect(() => {
    const c = lienzo.current;
    if (!c) return undefined;
    const alGirarRueda = (e) => {
      e.preventDefault();
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))));
    };
    c.addEventListener('wheel', alGirarRueda, { passive: false });
    return () => c.removeEventListener('wheel', alGirarRueda);
  }, [img]);

  // Vista previa pequeña (lo que verá Discord).
  const vistaPrevia = useMemo(() => {
    if (!img) return '';
    return exportar(img, estado, proporcion, conf.circular || forma === 'cuadrado' ? 128 : 480, fondo, 'image/png');
  }, [img, estado, proporcion, fondo, conf.circular, forma]);

  const empezarArrastre = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { x: e.clientX, y: e.clientY, base: despOk };
  };
  const moverArrastre = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const anchoMarco = e.currentTarget.clientWidth * MARCO;
    setDesp({ x: a.base.x + (e.clientX - a.x) / anchoMarco, y: a.base.y + (e.clientY - a.y) / anchoMarco });
  };
  const soltarArrastre = () => { arrastre.current = null; };
  const conTeclado = (e) => {
    const paso = 0.02;
    const mover = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
    if (mover) { e.preventDefault(); setDesp({ x: despOk.x + mover[0], y: despOk.y + mover[1] }); }
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(ZOOM_MAX, z * 1.08));
    if (e.key === '-') setZoom((z) => Math.max(ZOOM_MIN, z / 1.08));
  };

  const cambiarModo = (m) => { setModo(m); setZoom(1); setDesp({ x: 0, y: 0 }); };
  const girar = () => { setGiro((g) => (g + 90) % 360); setDesp({ x: 0, y: 0 }); };
  const restablecer = () => { setGiro(0); setZoom(1); setDesp({ x: 0, y: 0 }); setFondo(fondoInicial); if (img) setModo(modoInicial(img, forma)); };
  const aplicar = () => {
    if (!img) return;
    if (conf.encuadre) {
      onListo({ encuadre: { escala, x: despOk.x, y: despOk.y, giro, ancho: img.naturalWidth, alto: img.naturalHeight } });
      return;
    }
    onListo(exportar(img, estado, proporcion, anchoSalida(escala, conf.salidaMax), fondo, tipoSalida(archivo.type, fondo)));
  };

  const chip = (activo) => `rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${activo ? 'border-brand bg-brand/15 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`;

  return createPortal(
    <div className="sk-velo flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="recorte-titulo"
        className="sk-glass sk-brillo sk-aparece flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <Crop size={19} className="shrink-0 text-brand" />
          <h2 id="recorte-titulo" className="min-w-0 flex-1 truncate font-bold text-fg">
            {t('dashboard.recorte.titulo')} · <span className="text-muted">{t(`dashboard.recorte.formas.${forma}`)}</span>
          </h2>
          <button ref={cerrar} type="button" onClick={onCancelar} className="sk-boton-icono shrink-0" aria-label={t('dashboard.recorte.cancelar')} title={t('dashboard.recorte.cancelar')}>
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          {fallo ? (
            <p className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{t('dashboard.recorte.errorCargar')}</p>
          ) : !img ? (
            <p className="py-10 text-center text-sm text-muted">{t('dashboard.recorte.cargando')}</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* Editor */}
              <div className="min-w-0">
                <canvas ref={lienzo} tabIndex={0} aria-label={t('dashboard.recorte.arrastra')}
                  onPointerDown={ajustable ? empezarArrastre : undefined} onPointerMove={ajustable ? moverArrastre : undefined}
                  onPointerUp={soltarArrastre} onPointerCancel={soltarArrastre} onKeyDown={ajustable ? conTeclado : undefined}
                  className={`sk-foco mx-auto block w-full max-w-[360px] touch-none rounded-2xl border border-line ${ajustable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  style={{ aspectRatio: `${ANCHO_LIENZO} / ${altoLienzoCss}` }} />
                {!ajustable
                  ? <p className="mt-3 rounded-2xl border border-line bg-elevated px-3 py-2 text-xs text-muted">{t('dashboard.recorte.gif')}</p>
                  : <p className="mt-2 text-center text-xs text-muted">{t('dashboard.recorte.arrastra')}</p>}
                {esGif && ajustable && <p className="mt-2 rounded-2xl border border-line bg-elevated px-3 py-2 text-xs text-muted">{t('dashboard.recorte.gifTarjeta')}</p>}
              </div>

              {/* Controles y vista previa */}
              <div className="min-w-0 space-y-4">
                {ajustable && (
                  <>
                    <p className="text-sm text-muted">{t(`dashboard.recorte.ayuda.${forma}`)}</p>
                    {forma !== 'ancho' && (
                      <div className="flex flex-wrap gap-2" role="group" aria-label={t('dashboard.recorte.modo')}>
                        <button type="button" className={chip(modo === 'rellenar')} aria-pressed={modo === 'rellenar'} onClick={() => cambiarModo('rellenar')}>{t('dashboard.recorte.rellenar')}</button>
                        <button type="button" className={chip(modo === 'entera')} aria-pressed={modo === 'entera'} onClick={() => cambiarModo('entera')}>{t('dashboard.recorte.entera')}</button>
                      </div>
                    )}
                    {conf.proporciones.length > 1 && (
                      <div>
                        <span className="mb-1.5 block text-xs font-semibold text-fg">{t('dashboard.recorte.proporcion')}</span>
                        <div className="flex flex-wrap gap-2">
                          {conf.proporciones.map((p) => (
                            <button key={String(p)} type="button" className={chip(eleccion === p)} aria-pressed={eleccion === p}
                              onClick={() => { setEleccion(p); setZoom(1); setDesp({ x: 0, y: 0 }); }}>
                              {p === 'original' ? t('dashboard.recorte.original') : NOMBRE_PROPORCION[p]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-fg">{t('dashboard.recorte.zoom')}</span>
                      <span className="flex items-center gap-2">
                        <ZoomOut size={16} className="shrink-0 text-muted" />
                        <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.01} value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-[var(--accent-color)]" />
                        <ZoomIn size={16} className="shrink-0 text-muted" />
                      </span>
                    </label>
                    {!conf.encuadre && <div>
                      <span className="mb-1.5 block text-xs font-semibold text-fg">{t('dashboard.recorte.fondo')}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {FONDOS.map((f) => (
                          <button key={f || 'transparente'} type="button" className={chip(fondo === f)} aria-pressed={fondo === f} onClick={() => setFondo(f)}>
                            {t(`dashboard.recorte.fondos.${f === null ? 'transparente' : f === '#ffffff' ? 'blanco' : 'negro'}`)}
                          </button>
                        ))}
                        <label className={chip(fondo && !FONDOS.includes(fondo)) + ' flex cursor-pointer items-center gap-1.5'}>
                          <input type="color" value={fondo && !FONDOS.includes(fondo) ? fondo : '#5865f2'} onChange={(e) => setFondo(e.target.value)} className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0" />
                          {t('dashboard.recorte.fondos.color')}
                        </label>
                      </div>
                    </div>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={girar} className={chip(false) + ' flex items-center gap-1.5'}><RotateCw size={14} /> {t('dashboard.recorte.girar')}</button>
                      <button type="button" onClick={restablecer} className={chip(false) + ' flex items-center gap-1.5'}><RotateCcw size={14} /> {t('dashboard.recorte.restablecer')}</button>
                    </div>
                  </>
                )}

                <VistaDiscord forma={forma} src={vistaPrevia} t={t} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
          <button type="button" onClick={onCancelar} className="sk-foco rounded-xl border border-line bg-bg px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand">
            {t('dashboard.recorte.cancelar')}
          </button>
          {!fallo && !conf.encuadre && (
            <button type="button" onClick={() => onListo(null)} disabled={!img && !fallo}
              className="sk-foco flex items-center justify-center gap-1.5 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50">
              <Upload size={15} /> {esGif ? t('dashboard.recorte.subirGif') : t('dashboard.recorte.usarOriginal')}
            </button>
          )}
          {ajustable && !fallo && (
            <button type="button" onClick={aplicar} disabled={!img}
              className="sk-foco flex items-center justify-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.02] disabled:opacity-50">
              <Crop size={15} /> {conf.encuadre ? t('dashboard.recorte.usar') : t('dashboard.recorte.aplicar')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.querySelector('.sk-dash') || document.body,
  );
}

// Cómo quedará en un mensaje de Discord (colores y tamaños de Discord).
function VistaDiscord({ forma, src, t }) {
  if (!src) return null;
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-fg">{t('dashboard.recorte.vistaPrevia')}</span>
      <div className="rounded-2xl bg-[#313338] p-3">
        <div className="rounded border-l-4 border-[#5865f2] bg-[#2b2d31] p-3 text-[#dbdee1]">
          {forma === 'circulo' ? (
            <>
              <div className="flex items-center gap-2">
                <img src={src} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span className="text-sm font-semibold text-white">{t('dashboard.recorte.nombreEjemplo')}</span>
              </div>
              <p className="mt-2 text-sm">{t('dashboard.recorte.textoEjemplo')}</p>
              <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
                <img src={src} alt="" className="h-16 w-16 rounded-full object-cover" />
                <span className="text-xs text-[#949ba4]">{t('dashboard.recorte.ampliado')}</span>
              </div>
            </>
          ) : forma === 'tarjeta' ? (
            <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '900 / 270' }}>
              <img src={src} alt="" className="absolute inset-0 h-full w-full" />
              <div className="absolute inset-0 bg-[rgba(18,20,32,0.38)]" />
              <span className="absolute left-[5.5%] top-[20%] h-[59%] rounded-full border-2 border-white/80 bg-white/25" style={{ aspectRatio: '1' }} />
              <span className="absolute left-[28%] top-[24%] h-[9%] w-[30%] rounded bg-white/85" />
              <span className="absolute right-[5.5%] top-[24%] h-[9%] w-[14%] rounded bg-white/60" />
              <span className="absolute left-[28%] right-[5.5%] top-[56%] h-[14%] rounded-full bg-black/45" />
              <span className="absolute left-[28%] top-[56%] h-[14%] w-[40%] rounded-full bg-[#5865f2]" />
            </div>
          ) : forma === 'cuadrado' ? (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{t('dashboard.recorte.nombreEjemplo')}</p>
                <p className="mt-1 text-sm">{t('dashboard.recorte.textoEjemplo')}</p>
              </div>
              <img src={src} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">{t('dashboard.recorte.nombreEjemplo')}</p>
              <img src={src} alt="" className="mt-2 w-full max-w-[400px] rounded" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
