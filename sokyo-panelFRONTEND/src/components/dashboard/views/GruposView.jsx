// Diversión · Buscar grupo — /grupo publica «busco gente para jugar a…» con un botón
// para apuntarse; al llenarse, el bot avisa y crea una sala de voz para el grupo.
// Lógica del bot en utils/grupos.js.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gamepad2, Users, Lock, ExternalLink, Loader2 } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor } from './modulosShared';
import { useModulo, useRelativo } from '../../../hooks/useModulo';
import VistaDiscord from '../VistaDiscord';

const COLOR = { abierto: 'bg-success/15 text-success', lleno: 'bg-brand/15 text-brand', cerrado: 'bg-elevated text-muted' };

export default function GruposView({ dash }) {
  const { t } = useTranslation();
  const { canales, categorias = [], accionModulo } = dash;
  const { datos, setDatos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'grupos');
  const relativo = useRelativo();
  const [cerrando, setCerrando] = useState('');

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const cerrar = async (g) => {
    setCerrando(g.id);
    const r = await accionModulo(`grupos/${g.id}/cerrar`);
    setCerrando('');
    if (!r.error) setDatos((d) => ({ ...d, grupos: d.grupos.map((x) => (x.id === g.id ? { ...x, estado: 'cerrado' } : x)) }));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.grupos_v.intro')}</p>

      <div data-help="grupos-config" className={tarjeta}>
        <CabeceraTarjeta icono={Gamepad2} titulo={t('dashboard.grupos_v.title')} activo={form.activo !== false} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.grupos_v.channel')} ayuda={t('dashboard.grupos_v.channelHint')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} vacio={t('dashboard.grupos_v.anyChannel')} />
          </Campo>
          <Campo etiqueta={t('dashboard.grupos_v.expire')} ayuda={t('dashboard.grupos_v.expireHint')}>
            <Numero value={form.horasCaducidad ?? 6} onChange={set('horasCaducidad')} min={1} max={72} />
          </Campo>
          <div className="sm:col-span-2">
            <FilaInterruptor titulo={t('dashboard.grupos_v.room')} desc={t('dashboard.grupos_v.roomHint')}>
              <Toggle checked={form.crearSala !== false} onChange={set('crearSala')} />
            </FilaInterruptor>
          </div>
          {form.crearSala !== false && (
            <Campo etiqueta={t('dashboard.grupos_v.category')} ayuda={t('dashboard.grupos_v.categoryHint')} className="sm:col-span-2">
              <select value={form.categoriaId || ''} onChange={(e) => set('categoriaId')(e.target.value || null)} className={campo}>
                <option value="">{t('dashboard.grupos_v.sameCategory')}</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
          )}
        </div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      {/* Cómo sale un grupo (utils/grupos.js: embedGrupo y filaGrupo) */}
      <div data-help="grupos-previa" className={tarjeta}>
        <CabeceraTarjeta icono={Gamepad2} titulo={t('dashboard.grupos_v.prevTitle')} />
        <div className="mt-3">
          <VistaDiscord
            embed={{
              autor: t('dashboard.grupos_v.prevAuthor'), titulo: 'Valorant', descripcion: t('dashboard.grupos_v.prevDesc'), color: '#22c55e', pie: t('dashboard.grupos_v.prevFooter'),
              campos: [
                { nombre: t('dashboard.grupos_v.prevSlots'), valor: '**2/5**', inline: true },
                { nombre: t('dashboard.grupos_v.prevWhen'), valor: t('dashboard.grupos_v.prevWhenVal'), inline: true },
                ...(form.crearSala !== false ? [{ nombre: t('dashboard.grupos_v.prevRoom'), valor: '#valorant', inline: true }] : []),
                { nombre: t('dashboard.grupos_v.prevJoined'), valor: '👑 @Alex\n• @Sara' },
              ],
            }}
            botones={[{ texto: t('dashboard.grupos_v.prevJoin'), estilo: 'verde' }, { texto: t('dashboard.grupos_v.prevLeave'), estilo: 'gris' }, { texto: t('dashboard.grupos_v.prevClose'), estilo: 'rojo' }]} />
        </div>
      </div>

      <div data-help="grupos-lista" className={tarjeta}>
        <CabeceraTarjeta icono={Users} titulo={t('dashboard.grupos_v.latest')} />
        {datos.grupos.length === 0 ? (
          <Vacio icono={Gamepad2} titulo={t('dashboard.grupos_v.emptyTitle')} sub={t('dashboard.grupos_v.emptySub')} />
        ) : (
          <ul className="mt-4 space-y-2">
            {datos.grupos.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <Avatar src={g.creador?.avatar} name={g.creador?.nombre || '?'} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{g.juego}</span>
                  <span className="block text-xs text-muted">{g.creador?.nombre} · {relativo(g.fecha)}{g.cuando ? ` · ${g.cuando}` : ''}</span>
                </span>
                <span className="shrink-0 text-xs font-bold text-fg">{g.miembros}/{g.plazas}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${COLOR[g.estado]}`}>{t(`dashboard.grupos_v.estados.${g.estado}`)}</span>
                {g.url && <a href={g.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl border border-line p-2 text-muted hover:text-fg" aria-label={t('dashboard.grupos_v.open')} title={t('dashboard.grupos_v.open')}><ExternalLink size={14} /></a>}
                {g.estado !== 'cerrado' && (
                  <button type="button" onClick={() => cerrar(g)} disabled={cerrando === g.id} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-danger disabled:opacity-50">
                    {cerrando === g.id ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />} {t('dashboard.grupos_v.close')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
