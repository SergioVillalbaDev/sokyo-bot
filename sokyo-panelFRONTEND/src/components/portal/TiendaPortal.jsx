// Tienda de "Mi cuenta": catálogo (con ofertas relámpago y destacados del día),
// mochila (usar objetos y abrir cajas) y la forja para crear objetos. Antes era
// una página aparte (tienda.html) con su propio login; ahora vive aquí.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Search, Backpack, Hammer, Gift, Zap, Loader2, PackageOpen, Timer, Upload } from 'lucide-react';
import { Tarjeta, TituloVista, Vacio } from './glass';
import { rareza, ICONO_TIPO, precioEfectivo, fmtNum } from './portalUtils';

const RAREZAS = ['legendario', 'epico', 'raro', 'comun'];

// Destacados del día: los mismos para todo el mundo y cambian a medianoche.
function hash(s) { let h = 0; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0; return h; }
function destacadosDe(items, dia) {
  return new Set(items.map((i) => i._id).sort((a, b) => hash(a + dia) - hash(b + dia)).slice(0, Math.min(3, items.length)));
}

export default function TiendaPortal({ portalFetch, usuario, avisar, onOro, pestanaInicial = null }) {
  const { t, i18n } = useTranslation();
  const idioma = i18n.language === 'en' ? 'en' : 'es';
  const [pestana, setPestana] = useState(['catalogo', 'mochila', 'crear'].includes(pestanaInicial) ? pestanaInicial : 'catalogo');
  const [items, setItems] = useState(null);
  const [oro, setOro] = useState(null);
  const [mochila, setMochila] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState(null); // id del objeto que se está comprando/usando
  const [premio, setPremio] = useState(null);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());

  const cargarItems = useCallback(() => portalFetch('/api/portal/items')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('red'))))
    .then((d) => { setItems(Array.isArray(d) ? d : []); setError(''); })
    .catch(() => setError(t('portal.login.errConexion'))), [portalFetch, t]);
  const cargarCartera = useCallback(() => portalFetch('/api/portal/economia')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { setOro(d.balance); setMochila(d.inventory || []); onOro?.(d.balance); } })
    .catch(() => {}), [portalFetch, onOro]);

  useEffect(() => { cargarItems(); cargarCartera(); }, [cargarItems, cargarCartera]);

  // Reloj para las cuentas atrás de las ofertas (solo si hay alguna).
  const hayOfertas = (items || []).some((i) => precioEfectivo(i, ahora).oferta);
  useEffect(() => {
    if (!hayOfertas) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hayOfertas]);

  const dia = Math.floor(ahora / 86400000);
  const destacados = useMemo(() => destacadosDe(items || [], dia), [items, dia]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let l = items || [];
    if (filtro !== 'todos') l = l.filter((i) => (i.rareza || 'comun') === filtro);
    if (q) l = l.filter((i) => `${i.nombre} ${i.descripcion || ''}`.toLowerCase().includes(q));
    if (filtro === 'todos' && !q) l = [...l].sort((a, b) => (destacados.has(b._id) ? 1 : 0) - (destacados.has(a._id) ? 1 : 0));
    return l;
  }, [items, filtro, busqueda, destacados]);

  const comprar = async (item) => {
    setOcupado(item._id);
    try {
      const res = await portalFetch('/api/portal/shop/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item._id, cantidad: 1 }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { avisar(d.error || t('portal.shop.buyError'), 'error'); return; }
      setOro(d.balance); onOro?.(d.balance);
      avisar(t('portal.shop.bought', { name: item.nombre, gold: fmtNum(d.balance, idioma) }), 'oro');
      cargarItems(); cargarCartera();
    } finally { setOcupado(null); }
  };

  const usar = async (obj) => {
    setOcupado(obj._id);
    try {
      const res = await portalFetch('/api/portal/shop/use', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: obj._id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { avisar(d.error || t('portal.shop.useError'), 'error'); return; }
      const ef = d.efecto || {};
      if (ef.tipo === 'caja' && d.premio) setPremio({ caja: obj.nombre, ...d.premio });
      else if (ef.tipo === 'xpBoost') avisar(t('portal.shop.usedBoost', { name: obj.nombre, x: ef.multiplicador, min: ef.duracionMin }), 'oro');
      else avisar(t('portal.shop.used', { name: obj.nombre }), 'oro');
      cargarCartera();
    } finally { setOcupado(null); }
  };

  const pestanas = [
    { id: 'catalogo', icono: ShoppingBag, label: t('portal.shop.tabCatalog') },
    { id: 'mochila', icono: Backpack, label: t('portal.shop.tabBag', { count: mochila.reduce((a, e) => a + (e.cantidad || 0), 0) }) },
    { id: 'crear', icono: Hammer, label: t('portal.shop.tabCreate') },
  ];

  return (
    <div>
      <TituloVista icono={ShoppingBag} color="#f59e0b" titulo={t('portal.shop.title')} subtitulo={t('portal.shop.subtitle')}>
        <div className="gx-card gx-brillo flex items-center gap-3 px-4 py-2.5" style={{ borderRadius: 18 }}>
          <span className="text-xl">🪙</span>
          <div className="leading-tight">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{t('portal.shop.yourGold')}</div>
            <div className="text-lg font-extrabold text-fg">{oro == null ? '…' : fmtNum(oro, idioma)}</div>
          </div>
        </div>
      </TituloVista>

      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-white/[.03] p-1.5" role="tablist">
        {pestanas.map(({ id, icono: Icono, label }) => (
          <button
            key={id} role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${pestana === id ? 'bg-gradient-to-br from-violet-500/60 to-pink-500/50 text-white shadow-[0_0_22px_-6px_rgba(217,70,239,.8)]' : 'text-muted hover:bg-white/[.06] hover:text-fg'}`}
          >
            <Icono size={15} /> {label}
          </button>
        ))}
      </div>

      {pestana === 'catalogo' && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {['todos', ...RAREZAS].map((r) => (
                <button
                  key={r} onClick={() => setFiltro(r)} aria-pressed={filtro === r}
                  className={`gx-chip px-3 py-1.5 text-xs transition-all ${filtro === r ? 'text-white' : 'text-muted hover:text-fg'}`}
                  style={filtro === r ? { borderColor: r === 'todos' ? 'rgba(196,181,253,.6)' : rareza(r).color, boxShadow: `0 0 16px -4px ${r === 'todos' ? '#a855f7' : rareza(r).color}` } : undefined}
                >
                  {t(`portal.shop.rarity.${r}`)}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={t('portal.shop.searchPlaceholder')} className="gx-input pl-10" aria-label={t('portal.shop.searchPlaceholder')} />
            </div>
          </div>

          {error && !items && <Vacio icono={ShoppingBag} titulo={t('portal.home.errorTitle')} texto={error}><button onClick={cargarItems} className="gx-btn mt-3">{t('portal.login.retry')}</button></Vacio>}
          {!error && !items && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="gx-card h-80 animate-pulse" />)}</div>}
          {items && items.length === 0 && <Vacio icono={PackageOpen} titulo={t('portal.shop.emptyTitle')} texto={t('portal.shop.emptyDesc')} />}
          {items && items.length > 0 && lista.length === 0 && <Vacio icono={Search} titulo={t('portal.shop.noResultsTitle')} texto={t('portal.shop.noResultsDesc')} />}

          {lista.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {lista.map((item, idx) => {
                const p = precioEfectivo(item, ahora);
                const conStock = typeof item.stock === 'number';
                const agotado = conStock && item.stock <= 0;
                const caro = oro != null && oro < p.precio;
                return (
                  <Carta key={item._id} item={item} idx={idx} destacado={destacados.has(item._id)} etiqueta={agotado ? t('portal.shop.soldOut') : conStock ? `×${fmtNum(item.stock, idioma)}` : '∞'}>
                    <div className="flex items-end justify-between gap-2">
                      <div className="leading-tight">
                        {p.oferta && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="rounded-md bg-rose-500 px-1.5 py-0.5 font-bold text-white shadow-[0_0_12px_-2px_#f43f5e]">-{p.porcentaje}%</span>
                            <span className="text-muted line-through">{fmtNum(item.precio, idioma)}</span>
                          </div>
                        )}
                        <div className="mt-0.5 text-lg font-extrabold text-fg">🪙 {fmtNum(p.precio, idioma)}</div>
                        {p.oferta && <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-300"><Timer size={11} /> <CuentaAtras hasta={p.expiraEn} ahora={ahora} /></div>}
                      </div>
                      <button
                        onClick={() => comprar(item)} disabled={agotado || ocupado === item._id || caro}
                        title={caro ? t('portal.shop.notEnough') : undefined}
                        className="gx-btn gx-btn-primario shrink-0 px-4 py-2"
                      >
                        {ocupado === item._id ? <Loader2 size={15} className="animate-spin" /> : null}
                        {agotado ? t('portal.shop.soldOut') : t('portal.shop.buy')}
                      </button>
                    </div>
                    {caro && !agotado && <p className="mt-1.5 text-[11px] text-muted">{t('portal.shop.notEnough')}</p>}
                  </Carta>
                );
              })}
            </div>
          )}
        </>
      )}

      {pestana === 'mochila' && (
        mochila.length === 0
          ? <Vacio icono={Backpack} titulo={t('portal.shop.bagEmptyTitle')} texto={t('portal.shop.bagEmptyDesc')}><button onClick={() => setPestana('catalogo')} className="gx-btn gx-btn-primario mt-3">{t('portal.shop.goCatalog')}</button></Vacio>
          : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {mochila.map((obj, idx) => {
                const usable = obj.efecto && obj.efecto.tipo && obj.efecto.tipo !== 'ninguno';
                const esCaja = obj.efecto?.tipo === 'caja';
                return (
                  <Carta key={obj._id} item={obj} idx={idx} etiqueta={`×${fmtNum(obj.cantidad, idioma)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-fg">×{fmtNum(obj.cantidad, idioma)}</span>
                      {usable ? (
                        <button onClick={() => usar(obj)} disabled={ocupado === obj._id} className="gx-btn gx-btn-neon px-4 py-2">
                          {ocupado === obj._id ? <Loader2 size={15} className="animate-spin" /> : esCaja ? <Gift size={15} /> : <Zap size={15} />}
                          {esCaja ? t('portal.shop.open') : t('portal.shop.use')}
                        </button>
                      ) : <span className="text-xs text-muted">{t('portal.shop.owned')}</span>}
                    </div>
                    {obj.efecto?.tipo === 'rol' && <p className="mt-1.5 text-[11px] text-muted">{t('portal.shop.roleHint')}</p>}
                  </Carta>
                );
              })}
            </div>
          )
      )}

      {pestana === 'crear' && <Forja portalFetch={portalFetch} usuario={usuario} items={items || []} avisar={avisar} onCreado={cargarItems} />}

      {premio && <Revelacion premio={premio} onCerrar={() => setPremio(null)} />}
    </div>
  );
}

function CuentaAtras({ hasta, ahora }) {
  const ms = new Date(hasta).getTime() - ahora;
  if (ms <= 0) return <span>00:00</span>;
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return <span>{h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>;
}

// Carta de objeto con el brillo del color de su rareza.
function Carta({ item, idx, destacado = false, etiqueta, children }) {
  const { t } = useTranslation();
  const r = rareza(item.rareza);
  return (
    <Tarjeta className="gx-carta gx-pulsable flex flex-col overflow-hidden" style={{ '--rar': r.color }}>
      {destacado && <span className="absolute left-3 top-3 z-10 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-[0_0_14px_-2px_#d946ef]">{t('portal.shop.featured')}</span>}
      <div className="flex items-center justify-end gap-2 px-4 pt-3.5">
        <span className="gx-chip gx-rareza">{t(`portal.shop.rarity.${item.rareza || 'comun'}`)}</span>
      </div>
      <div className="gx-escena relative mx-3.5 mt-2.5 grid h-40 place-items-center overflow-hidden rounded-2xl border border-white/5">
        {item.imageUrl
          ? <img src={item.imageUrl} alt="" className="gx-flota max-h-28 max-w-[70%] object-contain" style={{ animationDelay: `${(idx % 6) * 0.4}s` }} />
          : <span className="gx-emoji gx-flota text-6xl" style={{ animationDelay: `${(idx % 6) * 0.4}s` }}>{ICONO_TIPO[item.tipo] || '📦'}</span>}
        {etiqueta && <span className="absolute bottom-2 right-2 rounded-lg border border-white/15 bg-black/60 px-2 py-0.5 text-[11px] font-bold text-fg">{etiqueta}</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold leading-tight text-fg">{item.nombre}</h3>
        {item.descripcion && <p className="mt-1 line-clamp-2 text-xs text-muted">{item.descripcion}</p>}
        <div className="mt-auto pt-3">{children}</div>
      </div>
    </Tarjeta>
  );
}

// Animación al abrir una caja: aparece el premio con su color.
function Revelacion({ premio, onCerrar }) {
  const { t } = useTranslation();
  const r = rareza(premio.rareza);
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  return (
    <div className="gx-velo grid place-items-center p-4" onClick={onCerrar} role="dialog" aria-modal="true" aria-label={premio.nombre}>
      <div className="gx-card gx-pop gx-carta max-w-sm px-10 py-8 text-center" style={{ '--rar': r.color, boxShadow: `0 0 80px -10px ${r.color}` }}>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t('portal.shop.openedBox', { name: premio.caja })}</p>
        <div className="gx-escena my-4 grid h-40 place-items-center rounded-2xl">
          {premio.imageUrl ? <img src={premio.imageUrl} alt="" className="gx-flota max-h-32 object-contain" /> : <span className="gx-emoji gx-flota text-7xl">{ICONO_TIPO[premio.tipo] || '🎁'}</span>}
        </div>
        <span className="gx-chip gx-rareza">{t(`portal.shop.rarity.${premio.rareza || 'comun'}`)}</span>
        <h3 className="mt-2 text-2xl font-extrabold text-fg">{premio.nombre}</h3>
        <p className="mt-4 text-[11px] text-muted">{t('portal.shop.tapToClose')}</p>
      </div>
    </div>
  );
}

// Forja: crear objetos, cajas de botín y ofertas relámpago de lo tuyo.
function Forja({ portalFetch, usuario, items, avisar, onCreado }) {
  const { t } = useTranslation();
  const [imgObjeto, setImgObjeto] = useState('');
  const [imgCaja, setImgCaja] = useState('');
  const [enCaja, setEnCaja] = useState({}); // id -> peso
  const mios = items.filter((i) => i.creadorId === usuario?.id);
  const candidatos = items.filter((i) => i.efecto?.tipo !== 'caja');

  const subir = async (e, poner) => {
    const archivo = e.target.files?.[0]; e.target.value = '';
    if (!archivo) return;
    const datos = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = mal; r.readAsDataURL(archivo); }).catch(() => null);
    if (!datos) return avisar(t('portal.card.imgReadError'), 'error');
    const res = await portalFetch('/api/portal/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datos }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.url) { poner(d.url); avisar(t('portal.shop.imageUploaded'), 'ok'); } else avisar(d.error || t('portal.card.imgUploadError'), 'error');
  };

  const enviar = async (url, cuerpo, form, ok) => {
    const res = await portalFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return avisar(d.error || t('portal.shop.createError'), 'error');
    avisar(ok(d), 'ok');
    form?.reset();
    onCreado();
  };

  const crearObjeto = (e) => {
    e.preventDefault();
    const cuerpo = Object.fromEntries(new FormData(e.target));
    cuerpo.imageUrl = imgObjeto;
    enviar('/api/portal/items', cuerpo, e.target, (d) => { setImgObjeto(''); return t('portal.shop.itemCreated', { name: d.item?.nombre || cuerpo.nombre }); });
  };
  const crearCaja = (e) => {
    e.preventDefault();
    const contenido = Object.entries(enCaja).map(([item, peso]) => ({ item, peso }));
    if (!contenido.length) return avisar(t('portal.shop.boxNeedsItems'), 'error');
    const cuerpo = { ...Object.fromEntries(new FormData(e.target)), imageUrl: imgCaja, contenido };
    enviar('/api/portal/cajas', cuerpo, e.target, (d) => { setImgCaja(''); setEnCaja({}); return t('portal.shop.boxCreated', { name: d.item?.nombre || cuerpo.nombre }); });
  };
  const lanzarOferta = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!f.item) return;
    enviar(`/api/portal/items/${f.item}/oferta`, { porcentaje: f.porcentaje, duracionMin: f.duracionMin }, null, (d) => t('portal.shop.offerLaunched', { pct: d.porcentaje }));
  };

  const campo = 'flex flex-col gap-1.5 text-xs font-semibold text-muted';
  const rarezas = RAREZAS.slice().reverse();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <p className="rounded-2xl border border-line bg-white/[.04] px-4 py-3 text-sm text-muted">{t('portal.shop.forgeIntro')}</p>

      <Tarjeta as="form" brillo onSubmit={crearObjeto} className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-fg"><Hammer size={18} className="text-amber-300" /> {t('portal.shop.forgeItem')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={campo}>{t('portal.shop.fId')}<input name="itemId" required maxLength={60} placeholder="espada_estelar" className="gx-input" /></label>
          <label className={campo}>{t('portal.shop.fName')}<input name="nombre" required maxLength={80} placeholder={t('portal.shop.fNamePh')} className="gx-input" /></label>
          <label className={campo}>{t('portal.shop.fPrice')}<input name="precio" type="number" min="0" required placeholder="500" className="gx-input" /></label>
          <label className={campo}>{t('portal.shop.fRarity')}
            <select name="rareza" className="gx-input">{rarezas.map((r) => <option key={r} value={r}>{t(`portal.shop.rarity.${r}`)}</option>)}</select>
          </label>
          <label className={campo}>{t('portal.shop.fType')}
            <select name="tipo" className="gx-input">
              <option value="consumible">{t('portal.shop.type.consumible')}</option>
              <option value="equipo">{t('portal.shop.type.equipo')}</option>
              <option value="material">{t('portal.shop.type.material')}</option>
            </select>
          </label>
          <label className={campo}>{t('portal.shop.fStock')}<input name="stock" type="number" min="0" placeholder="∞" className="gx-input" /></label>
          <label className={campo}>{t('portal.shop.fEffect')}
            <select name="efectoTipo" className="gx-input">
              <option value="ninguno">{t('portal.shop.effect.ninguno')}</option>
              <option value="xpBoost">{t('portal.shop.effect.xpBoost')}</option>
              <option value="rol">{t('portal.shop.effect.rol')}</option>
            </select>
          </label>
          <label className={campo}>{t('portal.shop.fDuration')}<input name="efectoDuracionMin" type="number" min="1" placeholder="60" className="gx-input" /></label>
          <label className={campo}>{t('portal.shop.fMultiplier')}<input name="efectoMultiplicador" type="number" min="1" placeholder="2" className="gx-input" /></label>
          <label className={campo}>{t('portal.shop.fRole')}<input name="efectoRolId" placeholder={t('portal.shop.fRolePh')} className="gx-input" /></label>
          <label className={`${campo} sm:col-span-2`}>{t('portal.shop.fDesc')}<textarea name="descripcion" rows={2} maxLength={300} className="gx-input" /></label>
        </div>
        <SubirImagen valor={imgObjeto} onCambiar={setImgObjeto} onSubir={(e) => subir(e, setImgObjeto)} />
        <button className="gx-btn gx-btn-primario w-full py-3"><Hammer size={16} /> {t('portal.shop.forgeBtn')}</button>
      </Tarjeta>

      <Tarjeta as="form" onSubmit={crearCaja} className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-fg"><Gift size={18} className="text-pink-300" /> {t('portal.shop.forgeBox')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={campo}>{t('portal.shop.fId')}<input name="itemId" required maxLength={60} placeholder="caja_estelar" className="gx-input" /></label>
          <label className={campo}>{t('portal.shop.fName')}<input name="nombre" required maxLength={80} placeholder={t('portal.shop.fBoxNamePh')} className="gx-input" /></label>
          <label className={campo}>{t('portal.shop.fPrice')}<input name="precio" type="number" min="0" required placeholder="500" className="gx-input" /></label>
          <label className={campo}>{t('portal.shop.fRarity')}
            <select name="rareza" className="gx-input">{rarezas.map((r) => <option key={r} value={r}>{t(`portal.shop.rarity.${r}`)}</option>)}</select>
          </label>
          <label className={`${campo} sm:col-span-2`}>{t('portal.shop.fDesc')}<textarea name="descripcion" rows={2} maxLength={300} className="gx-input" /></label>
        </div>
        <SubirImagen valor={imgCaja} onCambiar={setImgCaja} onSubir={(e) => subir(e, setImgCaja)} />
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">{t('portal.shop.boxContents')}</p>
          {candidatos.length === 0 ? <p className="text-sm text-muted">{t('portal.shop.boxNoItems')}</p> : (
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-line">
              {candidatos.map((i) => {
                const marcado = enCaja[i._id] != null;
                return (
                  <label key={i._id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <input type="checkbox" checked={marcado} onChange={(e) => setEnCaja((c) => { const n = { ...c }; if (e.target.checked) n[i._id] = 1; else delete n[i._id]; return n; })} className="h-4 w-4 accent-fuchsia-500" />
                    <span className="gx-chip gx-rareza" style={{ '--rar': rareza(i.rareza).color }}>{t(`portal.shop.rarity.${i.rareza || 'comun'}`)}</span>
                    <span className="flex-1 truncate text-sm text-fg">{i.nombre}</span>
                    <span className="text-[11px] text-muted">{t('portal.shop.weight')}</span>
                    <input type="number" min="1" value={enCaja[i._id] ?? 1} disabled={!marcado} onChange={(e) => setEnCaja((c) => ({ ...c, [i._id]: Math.max(1, parseInt(e.target.value, 10) || 1) }))} className="gx-input w-16 px-2 py-1 text-center" aria-label={t('portal.shop.weight')} />
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <button className="gx-btn gx-btn-primario w-full py-3"><Gift size={16} /> {t('portal.shop.boxBtn')}</button>
      </Tarjeta>

      <Tarjeta as="form" onSubmit={lanzarOferta} className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-fg"><Zap size={18} className="text-rose-300" /> {t('portal.shop.offerTitle')}</h2>
        <p className="text-sm text-muted">{t('portal.shop.offerDesc')}</p>
        {mios.length === 0 ? <p className="text-sm text-muted">{t('portal.shop.offerNone')}</p> : (
          <>
            <label className={campo}>{t('portal.shop.offerItem')}
              <select name="item" className="gx-input">{mios.map((i) => <option key={i._id} value={i._id}>{i.nombre} (🪙 {i.precio})</option>)}</select>
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className={campo}>{t('portal.shop.offerPct')}<input name="porcentaje" type="number" min="1" max="100" required placeholder="30" className="gx-input" /></label>
              <label className={campo}>{t('portal.shop.offerMin')}<input name="duracionMin" type="number" min="1" required placeholder="60" className="gx-input" /></label>
            </div>
            <button className="gx-btn gx-btn-primario w-full py-3"><Zap size={16} /> {t('portal.shop.offerBtn')}</button>
          </>
        )}
      </Tarjeta>
    </div>
  );
}

function SubirImagen({ valor, onCambiar, onSubir }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
      {t('portal.shop.fImage')}
      <div className="flex gap-2">
        <input value={valor} onChange={(e) => onCambiar(e.target.value)} placeholder="https://…" className="gx-input flex-1" />
        <label className="gx-btn shrink-0 cursor-pointer"><Upload size={14} /> {t('portal.card.upload')}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onSubir} className="hidden" /></label>
      </div>
    </div>
  );
}
