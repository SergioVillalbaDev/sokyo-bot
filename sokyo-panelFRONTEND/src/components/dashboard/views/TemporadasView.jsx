// Diversión · Temporadas — un ranking de XP que vuelve a empezar cada mes (o semana) sin
// tocar los niveles: premios de oro al podio y rol de campeón al primero.
// Lógica del bot en utils/temporadas.js (y /comunidad temporada en Discord).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Medal, Flag, Loader2 } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor, Fichas } from './modulosShared';
import { useModulo, useRelativo } from '../../../hooks/useModulo';
import VistaDiscord from '../VistaDiscord';

const MEDALLAS = ['🥇', '🥈', '🥉'];

export default function TemporadasView({ dash }) {
  const { t } = useTranslation();
  const { canales, roles, accionModulo } = dash;
  const { datos, setDatos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'temporadas');
  const relativo = useRelativo();
  const [cierre, setCierre] = useState('');

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const oro = Array.isArray(form.oro) ? form.oro : [0, 0, 0];
  const setOro = (i) => (v) => set('oro')(oro.map((o, j) => (j === i ? v : o)));
  const cerrar = async () => {
    if (!window.confirm(t('dashboard.temp_v.confirmClose'))) return;
    setCierre('cerrando');
    const r = await accionModulo('temporadas/cerrar');
    if (r.error) { setCierre(r.error); return; }
    setDatos(r);
    setCierre('ok');
  };
  const rolCampeon = roles.find((r) => r.id === form.rolCampeonId);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.temp_v.intro')}</p>
      {!datos.nivelesActivo && <Aviso tipo="alerta">{t('dashboard.temp_v.needLevels')}</Aviso>}

      <div data-help="temp-config" className={tarjeta}>
        <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.temp_v.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.temp_v.channel')} ayuda={t('dashboard.temp_v.channelHint')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} />
          </Campo>
          <Campo etiqueta={t('dashboard.temp_v.length')}>
            <select value={form.duracion || 'mensual'} onChange={(e) => set('duracion')(e.target.value)} className={campo}>
              <option value="mensual">{t('dashboard.temp_v.monthly')}</option>
              <option value="semanal">{t('dashboard.temp_v.weekly')}</option>
            </select>
          </Campo>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            {[0, 1, 2].map((i) => (
              <Campo key={i} etiqueta={`${MEDALLAS[i]} ${t('dashboard.temp_v.gold')}`}><Numero value={oro[i] ?? 0} onChange={setOro(i)} max={10000000} /></Campo>
            ))}
          </div>
          <Campo etiqueta={t('dashboard.temp_v.role')} ayuda={t('dashboard.temp_v.roleHint')} className="sm:col-span-2">
            <SelectRol roles={roles} value={form.rolCampeonId} onChange={set('rolCampeonId')} vacio={t('dashboard.temp_v.noRole')} />
          </Campo>
          <Campo etiqueta={t('dashboard.temp_v.exclude')} ayuda={t('dashboard.temp_v.excludeHint')} className="sm:col-span-2">
            <Fichas items={roles.filter((r) => r.nombre !== '@everyone')} seleccion={form.excluirRoles || []} onCambio={set('excluirRoles')} prefijo="@" vacio={t('dashboard.temp_v.noRoles')} />
          </Campo>
          <FilaInterruptor titulo={t('dashboard.temp_v.mention')} desc={t('dashboard.temp_v.mentionHint')}>
            <Toggle checked={form.mencionar !== false} onChange={set('mencionar')} />
          </FilaInterruptor>
          <FilaInterruptor titulo={t('dashboard.temp_v.announceStart')} desc={t('dashboard.temp_v.announceStartHint')}>
            <Toggle checked={form.anunciarInicio !== false} onChange={set('anunciarInicio')} />
          </FilaInterruptor>
          <div className="sm:col-span-2">
            {/* Mismo formato que utils/temporadas.js (embedPodio). */}
            <VistaDiscord embed={{
              titulo: `🏆 ${t('dashboard.temp_v.exTitle', { n: Math.max(1, datos.numero || 1) })}`, color: '#f1c40f',
              descripcion: [`🥇 @Alex · 4.210 XP`, `🥈 @Laura · 3.980 XP`, `🥉 @Marco · 2.115 XP`, '',
                `${t('dashboard.temp_v.prizes')}: ${oro.map((o, i) => (o > 0 ? `${MEDALLAS[i]} ${o} 🪙` : null)).filter(Boolean).join(' · ')}`,
                rolCampeon ? t('dashboard.temp_v.exRole', { rol: rolCampeon.nombre || rolCampeon.name }) : '',
                t('dashboard.temp_v.exNext', { n: Math.max(1, datos.numero || 1) + 1 })].filter((l) => l !== null).join('\n'),
            }} />
          </div>
        </div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      <div data-help="temp-ranking" className={tarjeta}>
        <CabeceraTarjeta icono={Medal} titulo={datos.numero ? t('dashboard.temp_v.ranking', { n: datos.numero }) : t('dashboard.temp_v.rankingOff')}
          extra={form.activo && datos.fin && (
            <button type="button" onClick={cerrar} disabled={cierre === 'cerrando'}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50">
              {cierre === 'cerrando' ? <Loader2 size={13} className="animate-spin" /> : <Flag size={13} />} {t('dashboard.temp_v.closeNow')}
            </button>
          )} />
        {datos.fin && <p className="mt-1 text-xs text-muted">{t('dashboard.temp_v.endsIn', { cuando: relativo(datos.fin) })}{datos.campeon ? ` · ${t('dashboard.temp_v.champion', { nombre: datos.campeon.nombre })}` : ''}</p>}
        {cierre === 'ok' && <p className="mt-2 text-sm font-semibold text-success">{t('dashboard.temp_v.closed')}</p>}
        {cierre && cierre !== 'ok' && cierre !== 'cerrando' && <p className="mt-2 text-sm font-semibold text-danger">{cierre}</p>}
        {datos.ranking.length === 0 ? (
          <Vacio icono={Trophy} titulo={t('dashboard.temp_v.emptyTitle')} sub={t('dashboard.temp_v.emptySub')} />
        ) : (
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {datos.ranking.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <span className="w-7 shrink-0 text-center text-sm font-bold text-muted">{MEDALLAS[i] || `${i + 1}.`}</span>
                <Avatar src={p.avatar} name={p.nombre} size={34} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{p.nombre}</span>
                <span className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-xs font-bold text-muted">{p.xp.toLocaleString()} XP</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
