// Diversión · Compañeros (1.20.0) — compañeros tipo tamagotchi. Cada miembro los
// consigue en los cofres y los cuida con /compi (comer, jugar, mimos, hablar,
// expediciones, misiones del día y racha). Aquí se ve el catálogo, quién los cuida
// mejor y se crean los compañeros propios del servidor con su foto (solo salen en
// los cofres de aquí). Bot: utils/compis.js, utils/compisNucleo.js; API: modulos/compis.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Sparkles, Upload, Trash2, Pencil, Plus, Crown, Users, Images, Gem, Flower2, Search } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, Aviso } from './crecimientoShared';
import { useModulo } from '../../../hooks/useModulo';
import { RAREZAS, COMPANEROS, INTERACCIONES, PODERES } from '../../../lib/casino';
import { svgMascota } from '../../../lib/mascota';
import { API_URL } from '../../../lib/api';

const ORDEN_R = ['comun', 'rara', 'epica', 'legendaria', 'mitica', 'divina'];
const RAREZAS_PROPIAS = ['comun', 'rara', 'epica', 'legendaria', 'mitica'];
const VOCES = ['tierno', 'sabio', 'bromista', 'timido', 'glotón', 'dormilon', 'orgulloso', 'sonador', 'energico', 'robot', 'alien', 'ninja', 'guerrero', 'maga', 'idol', 'vampiro', 'heroe', 'misterioso', 'genio', 'princesa'];
const PASOS = [['🎁', 'p1'], ['🍖', 'p2'], ['🧭', 'p3'], ['🔥', 'p4']];
// Las fotos subidas vienen como «/uploads/…»: se les pone delante la dirección de la API.
const foto = (p) => (p && p.startsWith('/uploads/') ? `${API_URL}${p}` : p);
const VACIO = { nombre: '', rareza: 'rara', voz: 'tierno', desc: '', frases: '', activo: true, imagen: null, vista: null };

// Lee una foto y la deja en 512 px como mucho (pesa menos y se ve igual en la tarjeta).
function leerFoto(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = reject;
    lector.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, 512 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

function Ficha({ src, foto, rareza, titulo, sub, apagado }) {
  const R = RAREZAS[rareza] || RAREZAS.comun;
  return (
    <div className={`group flex w-[92px] flex-col items-center rounded-2xl border bg-bg p-2 text-center transition-transform hover:-translate-y-1 ${apagado ? 'opacity-50' : ''}`} style={{ borderColor: `${R.color}66` }} title={titulo}>
      <span className="grid h-14 w-14 place-items-center">
        <img src={src} alt="" className={`h-12 w-12 transition-transform group-hover:scale-110 ${foto ? 'rounded-full object-cover ring-2' : ''}`} style={foto ? { '--tw-ring-color': R.color } : undefined} />
      </span>
      <span className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight text-fg">{String(titulo).split(',')[0]}</span>
      {sub && <span className="mt-0.5 text-[10px] font-semibold" style={{ color: R.color }}>{sub}</span>}
    </div>
  );
}

// Pack anime (1.22.0): interruptor, la divina secreta, galería con buscador y series que quitar.
const KURUMI = 'a:70069';
function PackAnime({ dash, info, onCambio }) {
  const { t } = useTranslation();
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState('');
  const [rareza, setRareza] = useState('todas');
  const [ver, setVer] = useState(48);
  const [series, setSeries] = useState(false);
  const [buscaSerie, setBuscaSerie] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    let vivo = true;
    dash.cargarModulo('compis/anime').then((r) => { if (vivo) setLista(r.personajes || []); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fuera = useMemo(() => new Set(info.fuera || []), [info.fuera]);
  const porSerie = useMemo(() => {
    const m = new Map();
    for (const c of lista || []) m.set(c.serie, (m.get(c.serie) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [lista]);
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (lista || []).filter((c) => (rareza === 'todas' || c.rareza === rareza) && (!q || c.nombre.toLowerCase().includes(q) || c.serie.toLowerCase().includes(q) || (c.poder?.nombre || '').toLowerCase().includes(q)))
      .sort((a, b) => RAREZAS[b.rareza].orden - RAREZAS[a.rareza].orden);
  }, [lista, busca, rareza]);
  const guardar = async (cambio) => {
    setGuardando(true);
    await dash.accionModulo('compis/anime', 'PUT', cambio);
    setGuardando(false);
    onCambio();
  };
  const alternarSerie = (serie) => {
    const nueva = new Set(fuera);
    if (nueva.has(serie)) nueva.delete(serie); else nueva.add(serie);
    guardar({ fuera: [...nueva] });
  };
  const kurumi = (lista || []).find((c) => c.id === KURUMI);
  const enJuego = (lista || []).filter((c) => !fuera.has(c.serie)).length;

  return (
    <div className={`${tarjeta} relative overflow-hidden`}>
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="relative flex flex-wrap items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-300"><Flower2 size={22} /></span>
        <div className="min-w-[200px] flex-1">
          <p className="text-lg font-extrabold text-fg">{t('dashboard.compis_v.anime.titulo', { n: info.total })}</p>
          <p className="text-sm text-muted">{t('dashboard.compis_v.anime.sub')}</p>
        </div>
        <label className="flex w-full shrink-0 items-center gap-2 rounded-2xl border border-line bg-bg px-3 py-2 sm:w-auto">
          <Toggle checked={!!info.activo} onChange={(v) => guardar({ activo: v })} disabled={guardando} />
          <span className="text-sm font-bold text-fg">{info.activo ? t('dashboard.compis_v.anime.on') : t('dashboard.compis_v.anime.off')}</span>
        </label>
      </div>
      {info.activo && !info.cofres && <div className="relative mt-3"><Aviso tipo="alerta">{t('dashboard.compis_v.anime.sinCofres')}</Aviso></div>}

      {kurumi && (
        <div className="relative mt-4 flex items-center gap-4 rounded-2xl border border-transparent bg-gradient-to-r from-fuchsia-500/20 via-rose-500/15 to-amber-400/20 p-3">
          <img src={kurumi.imagen} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-2xl object-cover object-top ring-2 ring-amber-300" />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide"><span aria-hidden>🌈 </span><span className="sk-divina-texto">{t('dashboard.compis_v.anime.divina')}</span></p>
            <p className="truncate text-base font-extrabold text-fg">🕰️ {kurumi.nombre} <span className="text-sm font-semibold text-muted">· {kurumi.serie}</span></p>
            <p className="text-xs text-muted">{t('dashboard.compis_v.anime.divinaSub')}</p>
          </div>
        </div>
      )}

      {lista === null ? <p className="relative mt-4 text-sm text-muted">{t('dashboard.loading')}</p> : (
        <>
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className={`${campo} pl-9`} value={busca} onChange={(e) => { setBusca(e.target.value); setVer(48); }} placeholder={t('dashboard.compis_v.anime.buscar')} />
            </div>
            <select className={`${campo.replace('w-full ', '')} w-auto`} value={rareza} onChange={(e) => { setRareza(e.target.value); setVer(48); }} aria-label={t('dashboard.compis_v.rareza')}>
              <option value="todas">{t('dashboard.compis_v.anime.todas')}</option>
              {ORDEN_R.map((r) => <option key={r} value={r}>{t(`dashboard.casino_v.rareza.${r}`)}</option>)}
            </select>
            <button type="button" onClick={() => setSeries((v) => !v)} aria-pressed={series} className={`rounded-xl border px-3 py-2 text-sm font-bold ${series ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted hover:text-fg'}`}>
              {t('dashboard.compis_v.anime.series', { n: porSerie.length, fuera: fuera.size })}
            </button>
          </div>
          <p className="relative mt-2 text-xs text-muted">{t('dashboard.compis_v.anime.enJuego', { n: enJuego, total: lista.length })}</p>

          {series && (
            <div className="relative mt-3 rounded-2xl border border-line bg-bg p-3">
              <p className="text-xs text-muted">{t('dashboard.compis_v.anime.seriesAyuda')}</p>
              <input className={`${campo} mt-2`} value={buscaSerie} onChange={(e) => setBuscaSerie(e.target.value)} placeholder={t('dashboard.compis_v.anime.buscarSerie')} />
              <div className="mt-2 flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
                {porSerie.filter(([sr]) => !buscaSerie.trim() || sr.toLowerCase().includes(buscaSerie.trim().toLowerCase())).map(([sr, n]) => (
                  <button key={sr} type="button" disabled={guardando} onClick={() => alternarSerie(sr)} aria-pressed={!fuera.has(sr)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${fuera.has(sr) ? 'border-line text-muted line-through opacity-60' : 'border-fuchsia-400/50 bg-fuchsia-500/10 text-fg'}`}>
                    {sr} · {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="relative mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {filtrados.slice(0, ver).map((c) => {
              const R = RAREZAS[c.rareza];
              return (
                <div key={c.id} title={`${c.nombre} · ${c.serie}${c.poder ? `\n${c.poder.emoji} ${c.poder.nombre}\n${c.poder.efecto}` : ''}`} className={`overflow-hidden rounded-2xl border bg-bg transition-transform hover:-translate-y-1 ${fuera.has(c.serie) ? 'opacity-35' : ''}`} style={{ borderColor: `${R.color}88` }}>
                  <div className="relative aspect-[3/4] bg-elevated">
                    <img src={c.imagen} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                    <span className="absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-black text-white" style={{ background: c.rareza === 'divina' ? 'linear-gradient(90deg,#f472b6,#fbbf24,#60a5fa)' : R.color }}>{t(`dashboard.casino_v.rareza.${c.rareza}`)}</span>
                  </div>
                  <p className="truncate px-1.5 pt-1 text-[11px] font-bold text-fg">{c.nombre}</p>
                  <p className="truncate px-1.5 text-[10px] text-muted">{c.serie}</p>
                  {c.poder && <p className="truncate px-1.5 pb-1.5 text-[10px] font-semibold text-fuchsia-300">{c.poder.emoji} {c.poder.nombre}</p>}
                </div>
              );
            })}
          </div>
          {filtrados.length === 0 && <p className="relative mt-3 text-sm italic text-muted">{t('dashboard.compis_v.anime.nada')}</p>}
          {filtrados.length > ver && (
            <div className="relative mt-3 text-center">
              <button type="button" onClick={() => setVer((v) => v + 96)} className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-fg hover:border-brand">{t('dashboard.compis_v.anime.mas', { n: filtrados.length - ver })}</button>
            </div>
          )}
          <p className="relative mt-4 text-[11px] text-muted">{t('dashboard.compis_v.anime.fuente')}</p>
        </>
      )}
    </div>
  );
}

export default function CompisView({ dash }) {
  const { t, i18n } = useTranslation();
  const { accionModulo } = dash;
  const { datos, recargar } = useModulo(dash, 'compis');
  const [form, setForm] = useState(null);      // null = cerrado; { …VACIO, cid? }
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const archivo = useRef(null);
  const varias = useRef(null);
  const [rarezaMasiva, setRarezaMasiva] = useState('rara');
  const [subiendo, setSubiendo] = useState(null); // { n, total }

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  const lista = datos.lista || [];
  const n = (v) => Math.round(Number(v || 0)).toLocaleString(i18n.language);
  const nombreDe = (id) => t(`dashboard.casino_v.comp.${id}`);
  const catalogo = Object.entries(COMPANEROS).filter(([, c]) => filtro === 'todos' || (filtro === 'personajes' ? c.tipo === 'personaje' : c.tipo !== 'personaje'));
  const setF = (k) => (v) => setForm((f) => ({ ...f, [k]: v && v.target ? v.target.value : v }));

  const elegirFoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    try { const url = await leerFoto(f); setForm((x) => ({ ...x, imagen: url, vista: url })); }
    catch { setError(t('dashboard.compis_v.errFoto')); }
  };
  const guardar = async () => {
    setEstado('guardando'); setError('');
    const cuerpo = {
      nombre: form.nombre, rareza: form.rareza, voz: form.voz, desc: form.desc, activo: form.activo,
      frases: String(form.frases || '').split('\n').map((x) => x.trim()).filter(Boolean),
      ...(form.imagen ? { imagen: form.imagen } : {}),
    };
    const r = await accionModulo(form.cid ? `compis/${form.cid}` : 'compis', form.cid ? 'PUT' : 'POST', cuerpo);
    setEstado('');
    if (r.error) { setError(r.error); return; }
    setForm(null);
    recargar();
  };
  const borrar = async (c) => {
    if (!window.confirm(t('dashboard.compis_v.confirmBorrar', { n: c.nombre }))) return;
    const r = await accionModulo(`compis/${c.cid}`, 'DELETE');
    if (r.error) { setError(r.error); return; }
    if (r.retirado) setError(t('dashboard.compis_v.retirado', { n: c.nombre }));
    recargar();
  };
  // Subir muchas fotos de golpe: cada una es un compañero con el nombre del archivo.
  const subirVarias = async (e) => {
    const archivos = [...(e.target.files || [])];
    e.target.value = '';
    if (!archivos.length) return;
    setError('');
    const hueco = Math.max(0, (datos.max || 100) - lista.length);
    const lote = archivos.slice(0, hueco);
    let hechos = 0;
    for (let i = 0; i < lote.length; i++) {
      setSubiendo({ n: i + 1, total: lote.length });
      const nombre = lote[i].name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32) || `#${i + 1}`;
      try {
        const imagen = await leerFoto(lote[i]);
        const r = await accionModulo('compis', 'POST', { nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1), rareza: rarezaMasiva, imagen, activo: true });
        if (r.error) { setError(r.error); break; }
        hechos++;
      } catch { setError(t('dashboard.compis_v.errFoto')); }
    }
    setSubiendo(null);
    if (archivos.length > lote.length) setError(t('dashboard.compis_v.masivoTope', { n: archivos.length - lote.length }));
    if (hechos) recargar();
  };
  const activar = async (c, v) => { await accionModulo(`compis/${c.cid}`, 'PUT', { activo: v }); recargar(); };

  return (
    <div className="space-y-5">
      {/* Portada */}
      <div className={`${tarjeta} relative overflow-hidden`}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex -space-x-3">
            {['kaede', 'mika', 'vlad', 'marina', 'pixel'].map((id, i) => (
              <span key={id} className="grid h-14 w-14 place-items-center rounded-full border-2 border-card bg-elevated shadow-soft" style={{ zIndex: 5 - i }}>
                <img src={svgMascota(COMPANEROS[id].svg)} alt="" className="h-10 w-10" />
              </span>
            ))}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-fg">{t('dashboard.compis_v.titulo', { n: Object.keys(COMPANEROS).length + lista.length })}</p>
            <p className="text-sm text-muted">{t('dashboard.compis_v.intro')}</p>
          </div>
        </div>
        <ol className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map(([emoji, p], i) => (
            <li key={p} className="rounded-2xl border border-line bg-bg p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-pink-500/15 text-sm font-black text-pink-300">{i + 1}</span>
                <span className="text-xl" aria-hidden>{emoji}</span>
              </div>
              <p className="mt-2 text-sm font-bold text-fg">{t(`dashboard.compis_v.paso.${p}.t`)}</p>
              <p className="mt-0.5 text-xs text-muted">{t(`dashboard.compis_v.paso.${p}.d`)}</p>
            </li>
          ))}
        </ol>
        <p className="relative mt-4 text-xs text-muted">{t('dashboard.compis_v.sano')}</p>
      </div>

      {datos.anime && <PackAnime dash={dash} info={datos.anime} onCambio={recargar} />}

      {/* Los de tu servidor */}
      <div className={tarjeta}>
        <CabeceraTarjeta icono={Crown} titulo={t('dashboard.compis_v.propiosTitulo')}
          extra={!form && lista.length < (datos.max || 20) && (
            <button type="button" onClick={() => { setError(''); setForm({ ...VACIO }); }} className="sk-foco flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-sm font-bold text-on-brand">
              <Plus size={16} /> {t('dashboard.compis_v.crear')}
            </button>
          )} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.compis_v.propiosSub', { n: lista.length, max: datos.max || 20 })}</p>
        {error && <div className="mt-3"><Aviso tipo="alerta">{error}</Aviso></div>}

        {/* Subida masiva (estilo Mudae) */}
        {!form && lista.length < (datos.max || 100) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line bg-bg p-3">
            <Images size={18} className="text-muted" />
            <span className="min-w-0 flex-1 text-xs text-muted">{t('dashboard.compis_v.masivo')}</span>
            <select className={`${campo.replace('w-full ', '')} w-auto`} value={rarezaMasiva} onChange={(e) => setRarezaMasiva(e.target.value)} aria-label={t('dashboard.compis_v.rareza')} disabled={!!subiendo}>
              {RAREZAS_PROPIAS.map((r) => <option key={r} value={r}>{t(`dashboard.casino_v.rareza.${r}`)}</option>)}
            </select>
            <button type="button" disabled={!!subiendo} onClick={() => varias.current?.click()} className="sk-foco flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-bold text-fg hover:border-brand disabled:opacity-50">
              <Upload size={15} /> {subiendo ? t('dashboard.compis_v.subiendo', subiendo) : t('dashboard.compis_v.masivoBoton')}
            </button>
            <input ref={varias} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={subirVarias} />
          </div>
        )}

        {form && (
          <div className="mt-4 grid gap-4 rounded-2xl border border-brand/40 bg-brand/5 p-4 md:grid-cols-[180px_1fr]">
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={() => archivo.current?.click()} className="sk-foco grid h-36 w-36 place-items-center overflow-hidden rounded-full border-4 border-dashed bg-bg text-muted hover:text-fg" style={{ borderColor: RAREZAS[form.rareza].color }}>
                {form.vista ? <img src={form.vista} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-xs font-semibold"><Upload size={22} />{t('dashboard.compis_v.subirFoto')}</span>}
              </button>
              <input ref={archivo} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={elegirFoto} />
              <p className="text-center text-[11px] text-muted">{t('dashboard.compis_v.fotoAyuda')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta={t('dashboard.compis_v.nombre')}><input className={campo} value={form.nombre} maxLength={32} onChange={setF('nombre')} placeholder={t('dashboard.compis_v.nombreEj')} /></Campo>
              <Campo etiqueta={t('dashboard.compis_v.rareza')} ayuda={t('dashboard.compis_v.rarezaAyuda')}>
                <select className={campo} value={form.rareza} onChange={setF('rareza')}>
                  {RAREZAS_PROPIAS.map((r) => <option key={r} value={r}>{t(`dashboard.casino_v.rareza.${r}`)}</option>)}
                </select>
              </Campo>
              <Campo etiqueta={t('dashboard.compis_v.voz')} ayuda={t('dashboard.compis_v.vozAyuda')}>
                <select className={campo} value={form.voz} onChange={setF('voz')}>
                  {VOCES.map((v) => <option key={v} value={v}>{t(`dashboard.compis_v.voces.${v}`)}</option>)}
                </select>
              </Campo>
              <Campo etiqueta={t('dashboard.compis_v.desc')}><input className={campo} value={form.desc} maxLength={140} onChange={setF('desc')} placeholder={t('dashboard.compis_v.descEj')} /></Campo>
              <Campo className="sm:col-span-2" etiqueta={t('dashboard.compis_v.frases')} ayuda={t('dashboard.compis_v.frasesAyuda')}>
                <textarea className={`${campo} min-h-[90px]`} value={form.frases} onChange={setF('frases')} placeholder={t('dashboard.compis_v.frasesEj')} />
              </Campo>
              <label className="flex items-center gap-3 sm:col-span-2">
                <Toggle checked={form.activo} onChange={setF('activo')} />
                <span className="text-sm text-fg">{t('dashboard.compis_v.enCofres')}</span>
              </label>
              <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={() => setForm(null)} className="sk-foco rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-fg">{t('dashboard.setup.cancel')}</button>
                <button type="button" disabled={estado === 'guardando' || !form.nombre.trim() || (!form.cid && !form.imagen)} onClick={guardar}
                  className="sk-foco rounded-xl bg-gradient-brand px-5 py-2 text-sm font-extrabold text-on-brand disabled:opacity-40">
                  {estado === 'guardando' ? t('dashboard.compis_v.guardando') : form.cid ? t('dashboard.compis_v.guardar') : t('dashboard.compis_v.crearlo')}
                </button>
              </div>
            </div>
          </div>
        )}

        {lista.length === 0 && !form ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center">
            <p className="text-3xl" aria-hidden>📸</p>
            <p className="mt-2 text-sm font-bold text-fg">{t('dashboard.compis_v.vacio')}</p>
            <p className="mt-1 text-xs text-muted">{t('dashboard.compis_v.vacioSub')}</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {lista.map((c) => (
              <li key={c.cid} className="flex items-center gap-3 rounded-2xl border bg-bg p-3" style={{ borderColor: `${RAREZAS[c.rareza].color}66` }}>
                <img src={foto(c.imagen)} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2" style={{ '--tw-ring-color': RAREZAS[c.rareza].color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-fg">{c.nombre}</p>
                  <p className="text-xs font-semibold" style={{ color: RAREZAS[c.rareza].color }}>{t(`dashboard.casino_v.rareza.${c.rareza}`)} · <span className="text-muted">{t('dashboard.compis_v.duenos', { count: c.duenos, n: n(c.duenos) })}</span></p>
                  <label className="mt-1 flex items-center gap-2 text-xs text-muted"><Toggle checked={c.activo} onChange={(v) => activar(c, v)} /> {t('dashboard.compis_v.enCofresCorto')}</label>
                </div>
                <button type="button" onClick={() => { setError(''); setForm({ ...VACIO, ...c, frases: (c.frases || []).join('\n'), imagen: null, vista: foto(c.imagen) }); }} className="sk-boton-icono" aria-label={t('dashboard.compis_v.editar')}><Pencil size={15} /></button>
                <button type="button" onClick={() => borrar(c)} className="sk-boton-icono" aria-label={t('dashboard.compis_v.borrar')}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Qué da cada rareza */}
      <div className={tarjeta}>
        <CabeceraTarjeta icono={Gem} titulo={t('dashboard.compis_v.ventajasTitulo')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.compis_v.ventajasSub')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORDEN_R.map((r) => {
            const R = RAREZAS[r];
            const pct = (v) => `${Math.round(v * 1000) / 10}${i18n.language.startsWith('es') ? ' %' : '%'}`;
            const pasivas = [
              R.xp && `✨ +${pct(R.xp)} XP`, R.diario && `🪙 +${pct(R.diario)} ${t('dashboard.casino_v.inDaily')}`, R.vuelta && `🎰 ${pct(R.vuelta)} ${t('dashboard.casino_v.cashback')}`,
              R.bromas && `🃏 −${pct(R.bromas)} ${t('dashboard.compis_v.enBromas')}`, R.liga && `🏆 +${pct(R.liga)} ${t('dashboard.compis_v.enLiga')}`, R.expedicion && `🧭 +${pct(R.expedicion)} ${t('dashboard.compis_v.enExpediciones')}`,
            ].filter(Boolean);
            const ints = Object.entries(INTERACCIONES).filter(([, x]) => x.rareza <= R.orden);
            const poder = PODERES[Math.min(PODERES.length - 1, R.orden)];
            return (
              <div key={r} className="rounded-2xl border bg-bg p-3" style={{ borderColor: `${R.color}66` }}>
                <p className="text-sm font-black" style={{ color: R.color }}>{r === 'divina' ? <span className="sk-divina-texto">{t('dashboard.casino_v.rareza.divina')}</span> : t(`dashboard.casino_v.rareza.${r}`)}</p>
                <ul className="mt-2 space-y-0.5 text-xs text-fg">{pasivas.map((x) => <li key={x}>{x}</li>)}</ul>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted">{t('dashboard.compis_v.sabeHacer', { n: 4 + ints.length })}</p>
                <p className="mt-0.5 text-lg leading-tight" title={ints.map(([id]) => t(`dashboard.compis_v.int.${id}`)).join(', ')}>🍖🎾🤗💬{ints.map(([, x]) => x.emoji).join('')}</p>
                <p className="mt-2 rounded-xl bg-elevated px-2 py-1.5 text-xs text-fg"><b>{poder.emoji} {t(`dashboard.compis_v.poder.${poder.id}.t`)}</b> · {t(`dashboard.compis_v.poder.${poder.id}.d`)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Catálogo */}
      <div className={tarjeta}>
        <CabeceraTarjeta icono={Sparkles} titulo={t('dashboard.compis_v.catalogo', { n: Object.keys(COMPANEROS).length })} />
        <div className="mt-3 flex flex-wrap gap-2">
          {['todos', 'personajes', 'animales'].map((f) => (
            <button key={f} type="button" onClick={() => setFiltro(f)} aria-pressed={filtro === f}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filtro === f ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted hover:text-fg'}`}>
              {t(`dashboard.compis_v.filtro.${f}`)}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-4">
          {ORDEN_R.map((r) => {
            const deEsta = catalogo.filter(([, c]) => c.rareza === r);
            if (!deEsta.length) return null;
            return (
              <div key={r}>
                <p className="text-xs font-black uppercase tracking-wide" style={{ color: RAREZAS[r].color }}>
                  {r === 'divina' ? <span className="sk-divina-texto">{t('dashboard.casino_v.rareza.divina')}</span> : t(`dashboard.casino_v.rareza.${r}`)} · {deEsta.length}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {deEsta.map(([id, c]) => <Ficha key={id} src={svgMascota(c.svg)} rareza={c.rareza} titulo={nombreDe(id)} sub={c.tipo === 'personaje' ? t('dashboard.compis_v.personaje') : null} />)}
                  {r !== 'divina' && lista.filter((c) => c.rareza === r && filtro !== 'animales').map((c) => <Ficha key={c.cid} foto src={foto(c.imagen)} rareza={r} titulo={c.nombre} sub={t('dashboard.compis_v.deAqui')} apagado={!c.activo} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quién los cuida mejor */}
      <div className={tarjeta}>
        <CabeceraTarjeta icono={Heart} titulo={t('dashboard.compis_v.cuidadores')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.compis_v.cuidadoresSub', { n: n(datos.personas) })}</p>
        {(datos.top || []).length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm italic text-muted"><Users size={16} /> {t('dashboard.compis_v.nadie')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {datos.top.map((p, i) => {
              const propio = lista.find((c) => c.id === p.companero);
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2">
                  <span className="w-5 text-center text-sm font-black text-muted">{i + 1}</span>
                  <Avatar src={p.avatar} name={p.nombre} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg"><b>{p.nombre}</b> <span className="text-muted">·</span> {p.apodo || (propio ? propio.nombre : nombreDe(p.companero))}</span>
                  <img src={propio ? foto(propio.imagen) : svgMascota(COMPANEROS[p.companero]?.svg)} alt="" className={`h-7 w-7 ${propio ? 'rounded-full object-cover' : ''}`} />
                  <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-300">{t('dashboard.compis_v.nivel', { n: p.nivel })}</span>
                  {p.racha > 0 && <span className="shrink-0 text-xs font-bold text-orange-300">🔥 {p.racha}</span>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">{t('dashboard.compis_v.comandos')}</p>
      </div>
    </div>
  );
}
