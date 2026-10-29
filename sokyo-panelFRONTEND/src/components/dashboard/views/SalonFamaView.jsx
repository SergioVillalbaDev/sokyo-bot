// Diversión · Salón de la fama — los mensajes que llegan a X reacciones (⭐ por
// defecto) se copian a un canal. Lógica del bot en utils/salonFama.js.
import { useTranslation } from 'react-i18next';
import { Star, Trophy, ExternalLink } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor } from './modulosShared';
import { useModulo, useRelativo } from '../../../hooks/useModulo';

export default function SalonFamaView({ dash }) {
  const { t } = useTranslation();
  const { canales } = dash;
  const { datos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'salon');
  const relativo = useRelativo();

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const exentos = form.canalesExentos || [];
  const alternarExento = (id) => set('canalesExentos')(exentos.includes(id) ? exentos.filter((x) => x !== id) : [...exentos, id]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.salon_v.intro')}</p>
      {form.activo && !form.canalId && <Aviso tipo="alerta">{t('dashboard.salon_v.needChannel')}</Aviso>}

      <div data-help="salon-config" className={tarjeta}>
        <CabeceraTarjeta icono={Star} titulo={t('dashboard.salon_v.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Campo etiqueta={t('dashboard.salon_v.channel')} className="sm:col-span-3">
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} />
          </Campo>
          <Campo etiqueta={t('dashboard.salon_v.emoji')} ayuda={t('dashboard.salon_v.emojiHint')}>
            <input value={form.emoji || ''} maxLength={64} onChange={(e) => set('emoji')(e.target.value)} className={campo} />
          </Campo>
          <Campo etiqueta={t('dashboard.salon_v.min')} ayuda={t('dashboard.salon_v.minHint')}>
            <Numero value={form.minimo ?? 3} onChange={set('minimo')} min={1} max={100} />
          </Campo>
          <div className="flex items-end">
            <FilaInterruptor titulo={t('dashboard.salon_v.own')} desc={t('dashboard.salon_v.ownHint')}>
              <Toggle checked={!!form.propios} onChange={set('propios')} />
            </FilaInterruptor>
          </div>
        </div>
        <div className="mt-5">
          <span className="text-xs font-semibold text-muted">{t('dashboard.salon_v.exempt')}</span>
          <p className="mb-2 text-xs text-muted">{t('dashboard.salon_v.exemptHint')}</p>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {canales.map((c) => (
              <button key={c.id} type="button" onClick={() => alternarExento(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${exentos.includes(c.id) ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}>
                #{c.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      <div data-help="salon-lista" className={tarjeta}>
        <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.salon_v.latest')} />
        {datos.ultimos.length === 0 ? (
          <Vacio icono={Star} titulo={t('dashboard.salon_v.emptyTitle')} sub={t('dashboard.salon_v.emptySub', { n: form.minimo ?? 3, emoji: form.emoji || '⭐' })} />
        ) : (
          <ul className="mt-4 space-y-2">
            {datos.ultimos.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <Avatar src={x.autor?.avatar} name={x.autor?.nombre || '?'} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{x.autor?.nombre || '—'}</span>
                  <span className="block text-xs text-muted">#{canales.find((c) => c.id === x.canalId)?.nombre || '?'} · {relativo(x.fecha)}</span>
                </span>
                <span className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-500">{form.emoji || '⭐'} {x.estrellas}</span>
                <a href={x.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl border border-line p-2 text-muted hover:text-fg" aria-label={t('dashboard.salon_v.open')} title={t('dashboard.salon_v.open')}><ExternalLink size={14} /></a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
