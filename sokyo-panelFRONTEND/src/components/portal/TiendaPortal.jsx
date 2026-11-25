// Tienda de "Mi cuenta" (2.0.0): la tienda DEL SERVIDOR elegido. Los admins ponen a la venta
// roles especiales (colores, títulos, canales VIP…) desde el panel y aquí se compran con el oro
// de ese servidor. Antes era una tienda global donde cualquiera creaba objetos: se quitó porque
// permitía trampas. Misma compra que /tienda en Discord (utils/tiendaServidor.js).
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Loader2, PackageOpen, Check, Clock } from 'lucide-react';
import { Tarjeta, TituloVista, Vacio } from './glass';
import { fmtNum } from './portalUtils';
import SelectorServidorOro from './SelectorServidorOro';

export default function TiendaPortal({ portalFetch, avisar, onOro, guildId = '', servidores = [], onCambiarServidor }) {
  const { t, i18n } = useTranslation();
  const idioma = i18n.language === 'en' ? 'en' : 'es';
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(() => portalFetch(`/api/portal/tienda${guildId ? `?guildId=${encodeURIComponent(guildId)}` : ''}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('red'))))
    .then((d) => { setDatos(d); setError(''); onOro?.(d.balance); })
    .catch(() => setError(t('portal.login.errConexion'))), [portalFetch, guildId, onOro, t]);

  useEffect(() => { cargar(); }, [cargar]);

  const duracion = (h) => (!h ? t('portal.shop.forever') : h % 24 === 0 ? t('portal.shop.days', { count: h / 24 }) : t('portal.shop.hours', { count: h }));

  const comprar = async (p) => {
    setOcupado(p.id);
    try {
      const r = await portalFetch('/api/portal/tienda/comprar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId: datos?.guildId || guildId, productoId: p.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { avisar?.(d.error || t('portal.shop.buyError'), 'error'); return; }
      avisar?.(t('portal.shop.bought', { name: p.nombre, gold: fmtNum(d.balance, idioma) }), 'ok');
      await cargar();
    } finally { setOcupado(null); }
  };

  const oro = datos?.balance;
  const productos = datos?.productos || [];

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

      <SelectorServidorOro className="mb-4 max-w-md" servidores={servidores} valor={guildId} onCambiar={onCambiarServidor} />

      {error && !datos && <Vacio icono={ShoppingBag} titulo={t('portal.home.errorTitle')} texto={error}><button onClick={cargar} className="gx-btn mt-3">{t('portal.login.retry')}</button></Vacio>}
      {!error && !datos && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="gx-card h-44 animate-pulse" />)}</div>}
      {datos && productos.length === 0 && (
        <Vacio icono={PackageOpen} titulo={datos.activa ? t('portal.shop.emptyTitle') : t('portal.shop.closedTitle')} texto={t('portal.shop.emptyDesc')} />
      )}

      {productos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {productos.map((p) => {
            const agotado = p.quedan === 0;
            const caro = oro != null && oro < p.precio;
            const color = p.rol?.color && p.rol.color !== '#000000' ? p.rol.color : '#a78bfa';
            return (
              <Tarjeta key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${color}22`, boxShadow: `inset 0 0 0 1px ${color}55` }}>{p.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-fg">{p.nombre}</div>
                    {p.rol && <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color, background: `${color}1a` }}>@{p.rol.nombre}</div>}
                    {p.descripcion && <p className="mt-1.5 text-sm text-muted">{p.descripcion}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {duracion(p.horas)}</span>
                  {p.quedan != null && <span>· {agotado ? t('portal.shop.soldOut') : t('portal.shop.left', { count: p.quedan })}</span>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <div className="text-lg font-extrabold text-fg">🪙 {fmtNum(p.precio, idioma)}</div>
                  {p.loTienes && !p.horas ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-400"><Check size={15} /> {t('portal.shop.owned')}</span>
                  ) : (
                    <button onClick={() => comprar(p)} disabled={agotado || caro || ocupado === p.id} className="gx-btn gx-btn-primario shrink-0 px-4 py-2" title={caro ? t('portal.shop.notEnough') : undefined}>
                      {ocupado === p.id && <Loader2 size={15} className="animate-spin" />}
                      {agotado ? t('portal.shop.soldOut') : p.loTienes ? t('portal.shop.extend') : t('portal.shop.buy')}
                    </button>
                  )}
                </div>
                {caro && !agotado && <p className="-mt-1 text-[11px] text-muted">{t('portal.shop.notEnough')}</p>}
              </Tarjeta>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">{t('portal.shop.howToEarn')}</p>
    </div>
  );
}
