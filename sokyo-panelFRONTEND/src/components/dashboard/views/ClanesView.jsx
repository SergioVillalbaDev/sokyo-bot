// Diversión · Clanes — equipos que compiten cada semana: cada XP que gana un miembro
// suma para su clan, y el lunes el ganador se lleva el premio. Los miembros los
// gestionan con /clan; aquí se ajustan las reglas y se puede borrar un clan.
// Lógica del bot en utils/clanes.js.
import { useTranslation } from 'react-i18next';
import { Shield, Trophy, Trash2 } from 'lucide-react';
import { Avatar } from '../../ui/primitives';
import { tarjeta, CabeceraTarjeta, Campo, SelectCanal, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio } from './modulosShared';
import { useModulo } from '../../../hooks/useModulo';
import VistaDiscord from '../VistaDiscord';

const MEDALLAS = ['🥇', '🥈', '🥉'];

export default function ClanesView({ dash }) {
  const { t, i18n } = useTranslation();
  const { canales, accionModulo } = dash;
  const { datos, setDatos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'clanes');

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const borrar = async (c) => {
    if (!window.confirm(t('dashboard.clanes_v.confirmDelete', { n: c.nombre }))) return;
    const r = await accionModulo(`clanes/${c.id}`, 'DELETE');
    if (!r.error) setDatos((d) => ({ ...d, clanes: d.clanes.filter((x) => x.id !== c.id) }));
  };
  const n = (v) => Number(v || 0).toLocaleString(i18n.language);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.clanes_v.intro')}</p>
      {form.activo && !datos.nivelesActivo && <Aviso tipo="alerta">{t('dashboard.clanes_v.needLevels')}</Aviso>}

      <div data-help="clanes-config" className={tarjeta}>
        <CabeceraTarjeta icono={Shield} titulo={t('dashboard.clanes_v.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.clanes_v.channel')} ayuda={t('dashboard.clanes_v.channelHint')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} vacio={t('dashboard.clanes_v.noChannel')} />
          </Campo>
          <Campo etiqueta={t('dashboard.clanes_v.max')}>
            <Numero value={form.maxMiembros ?? 10} onChange={set('maxMiembros')} min={2} max={100} />
          </Campo>
          <Campo etiqueta={t('dashboard.clanes_v.cost')} ayuda={t('dashboard.clanes_v.costHint')}>
            <Numero value={form.costeCrear ?? 0} onChange={set('costeCrear')} max={1000000} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta={t('dashboard.clanes_v.prizeGold')}><Numero value={form.premioOro ?? 100} onChange={set('premioOro')} max={1000000} /></Campo>
            <Campo etiqueta={t('dashboard.clanes_v.prizeXp')}><Numero value={form.premioXp ?? 0} onChange={set('premioXp')} max={100000} /></Campo>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{t('dashboard.clanes_v.prizeHint')}</p>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      {/* Cómo sale el ranking semanal (utils/clanes.js: embedRanking) */}
      <div data-help="clanes-previa" className={tarjeta}>
        <CabeceraTarjeta icono={Shield} titulo={t('dashboard.clanes_v.prevTitle')} />
        <div className="mt-3">
          <VistaDiscord embed={{
            titulo: t('dashboard.clanes_v.prevName'), color: '#f59e0b', pie: t('dashboard.clanes_v.prevFooter'),
            descripcion: [`🥇 🔥 **Phoenix** — ${n(5420)} ${t('dashboard.clanes_v.prevPts')} · 8 👥 · 🏆 2`, `🥈 🌊 **Tsunami** — ${n(4180)} ${t('dashboard.clanes_v.prevPts')} · 6 👥`, `🥉 ⚡ **Rayo** — ${n(2950)} ${t('dashboard.clanes_v.prevPts')} · 5 👥`].join('\n'),
          }} />
        </div>
      </div>

      <div data-help="clanes-lista" className={tarjeta}>
        <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.clanes_v.ranking')} />
        {datos.clanes.length === 0 ? (
          <Vacio icono={Shield} titulo={t('dashboard.clanes_v.emptyTitle')} sub={t('dashboard.clanes_v.emptySub')} />
        ) : (
          <ul className="mt-4 space-y-2">
            {datos.clanes.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <span className="w-7 shrink-0 text-center text-lg">{MEDALLAS[i] || <span className="text-sm font-bold text-muted">{i + 1}</span>}</span>
                <span className="text-2xl leading-none">{c.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-fg">{c.nombre}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Avatar src={c.lider?.avatar} name={c.lider?.nombre || '?'} size={16} /> {c.lider?.nombre} · {t('dashboard.clanes_v.members', { count: c.miembros })}{c.victorias ? ` · 🏆 ${c.victorias}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold text-fg">{n(c.puntosSemana)}</span>
                  <span className="block text-[11px] text-muted">{t('dashboard.clanes_v.thisWeek')}</span>
                </span>
                <button type="button" onClick={() => borrar(c)} className="shrink-0 rounded-xl border border-line p-2 text-muted hover:text-danger" aria-label={t('dashboard.clanes_v.delete')} title={t('dashboard.clanes_v.delete')}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
