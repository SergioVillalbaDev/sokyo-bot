// Diversión · Bromas (1.14.0) — los miembros gastan oro en bromas (apodo, payaso,
// reacción, loro) y se compran escudos. Aquí se eligen qué bromas hay, sus precios,
// cuánto duran, qué roles son intocables, y se ven las que están en marcha.
// Lógica del bot en utils/bromas.js.
import { useTranslation } from 'react-i18next';
import { Laugh, Coins, Shield, Timer, X, History, Trophy } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor, Fichas } from './modulosShared';
import { useModulo } from '../../../hooks/useModulo';
import VistaDiscord from '../VistaDiscord';

const TIPOS = [
  { id: 'apodo', emoji: '🏷️' },
  { id: 'payaso', emoji: '🤡' },
  { id: 'reaccion', emoji: '💩' },
  { id: 'loro', emoji: '🦜' },
];

export default function BromasView({ dash }) {
  const { t, i18n } = useTranslation();
  const { canales, roles, accionModulo } = dash;
  const { datos, setDatos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'bromas');

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const tipos = form.tipos || {};
  const setTipo = (id, k) => (v) => set('tipos')({ ...tipos, [id]: { ...(tipos[id] || {}), [k]: v } });
  const descuento = datos.descuento || 0;
  const precio = (id) => Math.round((Number(tipos[id]?.precio) || 0) * (1 - descuento));
  const hora = (f) => new Date(f).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const quitar = async (b) => {
    const r = await accionModulo(`bromas/${b.id}`, 'DELETE');
    if (!r.error) setDatos((d) => ({ ...d, activas: d.activas.filter((x) => x.id !== b.id) }));
  };
  const detalle = (b) => t(`dashboard.bromas_v.det.${b.tipo}`, { texto: b.texto });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.bromas_v.intro')}</p>
      {form.activo && tipos.payaso?.activo && !form.rolPayasoId && <Aviso tipo="alerta">{t('dashboard.bromas_v.needClownRole')}</Aviso>}

      <div data-help="bromas-config" className={tarjeta}>
        <CabeceraTarjeta icono={Laugh} titulo={t('dashboard.bromas_v.title')} activo={form.activo} onActivo={set('activo')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.bromas_v.titleHint')}</p>

        {/* Las bromas: una ficha por tipo con su interruptor y su precio */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {TIPOS.map((x) => {
            const activo = tipos[x.id]?.activo !== false;
            return (
              <div key={x.id} className={`rounded-2xl border p-4 transition-colors ${activo ? 'border-brand/40 bg-brand/5' : 'border-line bg-bg opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none" aria-hidden>{x.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-fg">{t(`dashboard.bromas_v.tipos.${x.id}`)}</span>
                    <span className="block text-xs text-muted">{t(`dashboard.bromas_v.tiposDesc.${x.id}`)}</span>
                  </span>
                  <Toggle checked={activo} onChange={setTipo(x.id, 'activo')} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Coins size={15} className="shrink-0 text-amber-400" />
                  <div className="w-32"><Numero value={tipos[x.id]?.precio ?? 0} onChange={setTipo(x.id, 'precio')} max={1000000} disabled={!activo} /></div>
                  {descuento > 0 && activo && <span className="text-xs font-semibold text-emerald-400">{t('dashboard.bromas_v.withPet', { n: precio(x.id), pct: Math.round(descuento * 100) })}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.bromas_v.channel')} ayuda={t('dashboard.bromas_v.channelHint')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} vacio={t('dashboard.bromas_v.noChannel')} />
          </Campo>
          <Campo etiqueta={t('dashboard.bromas_v.clownRole')} ayuda={t('dashboard.bromas_v.clownRoleHint')}>
            <SelectRol roles={roles} value={form.rolPayasoId} onChange={set('rolPayasoId')} vacio={t('dashboard.bromas_v.noRole')} />
          </Campo>
          <Campo etiqueta={t('dashboard.bromas_v.duration')} ayuda={t('dashboard.bromas_v.durationHint')}>
            <Numero value={form.duracionMin ?? 60} onChange={set('duracionMin')} min={5} max={1440} />
          </Campo>
          <Campo etiqueta={t('dashboard.bromas_v.wait')} ayuda={t('dashboard.bromas_v.waitHint')}>
            <Numero value={form.esperaMin ?? 10} onChange={set('esperaMin')} max={1440} />
          </Campo>
        </div>

        {/* Defensa: escudo y devolver */}
        <div className="mt-5 rounded-2xl border border-line bg-bg p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-fg"><Shield size={15} className="text-sky-400" /> {t('dashboard.bromas_v.defense')}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Campo etiqueta={t('dashboard.bromas_v.shieldPrice')}><Numero value={form.escudoPrecio ?? 400} onChange={set('escudoPrecio')} max={1000000} /></Campo>
            <Campo etiqueta={t('dashboard.bromas_v.shieldHours')}><Numero value={form.escudoHoras ?? 12} onChange={set('escudoHoras')} min={1} max={168} /></Campo>
          </div>
          <div className="mt-3">
            <FilaInterruptor titulo={t('dashboard.bromas_v.revenge')} desc={t('dashboard.bromas_v.revengeHint')}>
              <Toggle checked={form.devolver !== false} onChange={set('devolver')} />
            </FilaInterruptor>
          </div>
          <p className="mt-4 text-sm font-semibold text-fg">{t('dashboard.bromas_v.immune')}</p>
          <p className="mb-2 text-xs text-muted">{t('dashboard.bromas_v.immuneHint')}</p>
          <Fichas items={roles.filter((r) => r.nombre !== '@everyone')} seleccion={form.inmunes || []} onCambio={set('inmunes')} prefijo="@" vacio={t('dashboard.bromas_v.noRoles')} />
          <p className="mt-3 text-xs text-muted">{t('dashboard.bromas_v.optOut')}</p>
        </div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      {/* Así se ve en Discord */}
      <div data-help="bromas-previa" className={tarjeta}>
        <CabeceraTarjeta icono={Laugh} titulo={t('dashboard.bromas_v.prevTitle')} />
        <div className="mt-3">
          <VistaDiscord embed={{
            color: '#f472b6',
            descripcion: t('dashboard.bromas_v.prevText', { min: form.duracionMin ?? 60 }),
            pie: t('dashboard.bromas_v.prevFooter'),
          }} botones={[
            ...(form.devolver !== false ? [{ texto: `↩️ ${t('dashboard.bromas_v.prevRevenge', { n: precio('payaso') * 2 })}`, estilo: 'rojo' }] : []),
            { texto: `🛡️ ${t('dashboard.bromas_v.prevShield', { h: form.escudoHoras ?? 12, n: form.escudoPrecio ?? 400 })}`, estilo: 'gris' },
          ]} />
        </div>
      </div>

      {/* En marcha */}
      <div data-help="bromas-activas" className={tarjeta}>
        <CabeceraTarjeta icono={Timer} titulo={t('dashboard.bromas_v.active', { n: datos.activas.length })} />
        {datos.activas.length === 0 ? (
          <Vacio icono={Laugh} titulo={t('dashboard.bromas_v.noneActive')} sub={t('dashboard.bromas_v.noneActiveSub')} />
        ) : (
          <ul className="mt-4 space-y-2">
            {datos.activas.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <span className="text-2xl leading-none" aria-hidden>{TIPOS.find((x) => x.id === b.tipo)?.emoji}</span>
                <Avatar src={b.objetivo.avatar} name={b.objetivo.nombre} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-fg">{b.objetivo.nombre} <span className="font-normal text-muted">· {detalle(b)}</span></span>
                  <span className="block truncate text-xs text-muted">{t(b.devolucion ? 'dashboard.bromas_v.byRevenge' : 'dashboard.bromas_v.by', { n: b.autor.nombre, hora: hora(b.fin) })}</span>
                </span>
                <button type="button" onClick={() => quitar(b)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-danger">
                  <X size={13} /> {t('dashboard.bromas_v.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div data-help="bromas-top" className={tarjeta}>
          <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.bromas_v.top')} />
          {datos.top.length === 0 ? <Vacio icono={Trophy} titulo={t('dashboard.bromas_v.noTop')} /> : (
            <ul className="mt-4 space-y-2">
              {datos.top.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="w-6 text-center">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
                  <Avatar src={p.avatar} name={p.nombre} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{p.nombre}</span>
                  <span className="text-xs text-muted">{t('dashboard.bromas_v.stats', { g: p.gastadas, r: p.recibidas })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div data-help="bromas-recientes" className={tarjeta}>
          <CabeceraTarjeta icono={History} titulo={t('dashboard.bromas_v.recent')} />
          {datos.recientes.length === 0 ? <Vacio icono={History} titulo={t('dashboard.bromas_v.noRecent')} /> : (
            <ul className="mt-4 space-y-1.5">
              {datos.recientes.slice(0, 10).map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-sm">
                  <span aria-hidden>{b.devolucion ? '↩️' : TIPOS.find((x) => x.id === b.tipo)?.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-fg"><b>{b.autor.nombre}</b> → <b>{b.objetivo.nombre}</b> <span className="text-muted">· {detalle(b)}</span></span>
                  <span className="shrink-0 text-xs text-muted">🪙 {b.precio}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
