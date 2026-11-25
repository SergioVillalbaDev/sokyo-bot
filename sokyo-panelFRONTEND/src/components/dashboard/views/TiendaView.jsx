// Diversión · Tienda del servidor (2.0.0) — roles cosméticos (colores, títulos, canales VIP…)
// que los miembros compran con el oro de este servidor, con /tienda o desde «Mi cuenta».
// Nunca roles con permisos de staff: el bot lo comprueba al guardar y al comprar.
// Lógica en utils/tiendaServidor.js; rutas en api/routes/modulos.js (tienda).
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Plus, Trash2, ArrowUp, ArrowDown, Receipt } from 'lucide-react';
import { Avatar } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio } from './modulosShared';
import { useModulo, useRelativo } from '../../../hooks/useModulo';
import VistaDiscord from '../VistaDiscord';

const EMOJIS = ['🎁', '🌈', '👑', '⭐', '💎', '🔥', '🎨', '🦄', '🐉', '🎀', '🍀', '🎮', '🎵', '💜', '💙', '💚'];
const DURACIONES = [0, 24, 72, 168, 720];
const nuevoId = () => Math.random().toString(36).slice(2, 8);

export default function TiendaView({ dash }) {
  const { t, i18n } = useTranslation();
  const { roles, esPremium, setActiveTab } = dash;
  const tope = esPremium ? 25 : 3; // utils/limites.js: tiendaProductos (Free 3 · Pro 25)
  const relativo = useRelativo();
  const { datos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'tienda');

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const productos = form.productos || [];
  const n = (v) => Number(v || 0).toLocaleString(i18n.language);
  const cambiar = (i, k, v) => set('productos')(productos.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const mover = (i, d) => { const l = [...productos]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); set('productos')(l); };
  const anadir = () => set('productos')([...productos, { id: nuevoId(), nombre: '', descripcion: '', emoji: '🎁', rolId: '', horas: 0, precio: 1000, stock: null, activo: true }]);
  const quitar = (i) => set('productos')(productos.filter((_, j) => j !== i));
  const aviso = (id) => (datos.avisos || []).find((a) => a.id === id)?.error;
  const duracion = (h) => (!h ? t('dashboard.tienda_v.forever') : h % 24 === 0 ? t('dashboard.tienda_v.days', { count: h / 24 }) : t('dashboard.tienda_v.hours', { count: h }));
  const rolesVendibles = (roles || []).filter((r) => !r.managed);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.tienda_v.intro')}</p>

      <div data-help="tienda-config" className={tarjeta}>
        <CabeceraTarjeta icono={ShoppingBag} titulo={t('dashboard.tienda_v.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-bg p-3"><div className="text-xs text-muted">{t('dashboard.tienda_v.statProducts')}</div><div className="text-xl font-bold text-fg">{productos.length}/{tope}</div></div>
          <div className="rounded-2xl border border-line bg-bg p-3"><div className="text-xs text-muted">{t('dashboard.tienda_v.statSales')}</div><div className="text-xl font-bold text-fg">{n(datos.mes?.compras)}</div></div>
          <div className="rounded-2xl border border-line bg-bg p-3"><div className="text-xs text-muted">{t('dashboard.tienda_v.statGold')}</div><div className="text-xl font-bold text-fg">🪙 {n(datos.mes?.oro)}</div></div>
        </div>
        <Aviso tipo="info">{t('dashboard.tienda_v.safe')}</Aviso>
      </div>

      <div data-help="tienda-productos" className={tarjeta}>
        <CabeceraTarjeta icono={ShoppingBag} titulo={t('dashboard.tienda_v.products')} extra={
          <button type="button" onClick={anadir} disabled={productos.length >= tope} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} /> {t('dashboard.tienda_v.add')}</button>
        } />
        {!esPremium && productos.length >= tope && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-fg">
            <span>⭐ {t('dashboard.tienda_v.proHint')}</span>
            <button type="button" onClick={() => setActiveTab?.('cuenta-plan')} className="rounded-xl bg-gradient-brand px-4 py-2 text-sm font-bold text-on-brand">{t('dashboard.plan.upgrade')}</button>
          </div>
        )}
        {productos.length === 0 ? (
          <Vacio icono={ShoppingBag} titulo={t('dashboard.tienda_v.emptyTitle')} sub={t('dashboard.tienda_v.emptySub')} />
        ) : (
          <ul className="mt-4 space-y-3">
            {productos.map((p, i) => (
              <li key={p.id} className="rounded-2xl border border-line bg-bg p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <select aria-label={t('dashboard.tienda_v.emoji')} value={p.emoji} onChange={(e) => cambiar(i, 'emoji', e.target.value)} className="h-11 w-16 shrink-0 rounded-xl border border-line bg-bg px-1 text-center text-lg text-fg outline-none focus:border-brand">
                    {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    <Campo etiqueta={t('dashboard.tienda_v.name')}>
                      <input value={p.nombre} maxLength={60} onChange={(e) => cambiar(i, 'nombre', e.target.value)} placeholder={t('dashboard.tienda_v.namePh')} className={campo} />
                    </Campo>
                    <Campo etiqueta={t('dashboard.tienda_v.role')} ayuda={t('dashboard.tienda_v.roleHint')}>
                      <SelectRol roles={rolesVendibles} value={p.rolId} onChange={(v) => cambiar(i, 'rolId', v)} vacio={t('dashboard.tienda_v.pickRole')} />
                    </Campo>
                    <Campo etiqueta={t('dashboard.tienda_v.price')}>
                      <Numero value={p.precio} onChange={(v) => cambiar(i, 'precio', v)} min={1} max={10000000} />
                    </Campo>
                    <Campo etiqueta={t('dashboard.tienda_v.duration')}>
                      <select value={DURACIONES.includes(p.horas) ? p.horas : 0} onChange={(e) => cambiar(i, 'horas', Number(e.target.value))} className={campo}>
                        {DURACIONES.map((h) => <option key={h} value={h}>{duracion(h)}</option>)}
                      </select>
                    </Campo>
                    <Campo etiqueta={t('dashboard.tienda_v.desc')} className="sm:col-span-2">
                      <input value={p.descripcion || ''} maxLength={150} onChange={(e) => cambiar(i, 'descripcion', e.target.value)} placeholder={t('dashboard.tienda_v.descPh')} className={campo} />
                    </Campo>
                    <Campo etiqueta={t('dashboard.tienda_v.stock')} ayuda={p.quedan != null ? t('dashboard.tienda_v.left', { count: p.quedan }) : t('dashboard.tienda_v.stockHint')}>
                      <input type="number" min={0} max={100000} value={p.stock ?? ''} onChange={(e) => cambiar(i, 'stock', e.target.value === '' ? null : Number(e.target.value))} placeholder="∞" className={campo} />
                    </Campo>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm text-fg">
                      <input type="checkbox" checked={p.activo !== false} onChange={(e) => cambiar(i, 'activo', e.target.checked)} /> {t('dashboard.tienda_v.onSale')}
                    </label>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" aria-label={t('dashboard.tienda_v.up')} disabled={i === 0} onClick={() => mover(i, -1)} className="rounded-lg p-1.5 text-muted hover:bg-card disabled:opacity-30"><ArrowUp size={15} /></button>
                    <button type="button" aria-label={t('dashboard.tienda_v.down')} disabled={i === productos.length - 1} onClick={() => mover(i, 1)} className="rounded-lg p-1.5 text-muted hover:bg-card disabled:opacity-30"><ArrowDown size={15} /></button>
                    <button type="button" aria-label={t('dashboard.tienda_v.remove')} onClick={() => quitar(i)} className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 size={15} /></button>
                  </div>
                </div>
                {aviso(p.id) && <div className="mt-2"><Aviso tipo="alerta">{aviso(p.id)}</Aviso></div>}
                {(!p.nombre?.trim() || !p.rolId) && <p className="mt-2 text-xs text-muted">{t('dashboard.tienda_v.incomplete')}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      <div data-help="tienda-previa" className={tarjeta}>
        <CabeceraTarjeta icono={ShoppingBag} titulo={t('dashboard.tienda_v.preview')} />
        <div className="mt-3">
          <VistaDiscord embed={{
            titulo: t('dashboard.tienda_v.prevTitle'), color: '#c9a227', pie: t('dashboard.tienda_v.prevFooter'),
            descripcion: (productos.filter((p) => p.nombre && p.activo !== false).slice(0, 4).map((p) => `${p.emoji} **${p.nombre}** — 🪙 ${n(p.precio)}\n-# ${duracion(p.horas)}`).join('\n\n')) || t('dashboard.tienda_v.prevEmpty'),
          }} />
        </div>
      </div>

      <div data-help="tienda-ventas" className={tarjeta}>
        <CabeceraTarjeta icono={Receipt} titulo={t('dashboard.tienda_v.sales')} />
        {(datos.ultimas || []).length === 0 ? (
          <Vacio icono={Receipt} titulo={t('dashboard.tienda_v.noSales')} sub={t('dashboard.tienda_v.noSalesSub')} />
        ) : (
          <ul className="mt-4 space-y-2">
            {datos.ultimas.map((c, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2">
                <Avatar src={c.avatar} name={c.nombre} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm text-fg"><b>{c.nombre}</b> · {c.producto}</span>
                <span className="text-sm font-semibold text-fg">🪙 {n(c.precio)}</span>
                <span className="text-xs text-muted">{relativo(c.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
