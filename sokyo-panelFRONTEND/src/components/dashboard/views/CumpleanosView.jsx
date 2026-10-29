// Tu comunidad · Cumpleaños — el bot felicita a cada miembro en su día (el día lo
// guarda cada uno con /cumple o en «Mi cuenta»), con rol del día y regalo opcionales.
// Lógica del bot en utils/cumpleanos.js.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cake, CalendarHeart, Send, Loader2 } from 'lucide-react';
import { Avatar } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio } from './modulosShared';
import { useModulo } from '../../../hooks/useModulo';

const VARIABLES = ['{mention}', '{user}', '{server}'];

export default function CumpleanosView({ dash }) {
  const { t, i18n } = useTranslation();
  const { canales, roles, accionModulo } = dash;
  const { datos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'cumpleanos');
  const [prueba, setPrueba] = useState('');

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const probar = async () => {
    setPrueba('enviando');
    const r = await accionModulo('cumpleanos/probar');
    setPrueba(r.error ? r.error : 'ok');
  };
  const fecha = (dia, mes) => new Date(Date.UTC(2024, mes - 1, dia)).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  // La hora se guarda en UTC: se enseña también en la hora de quien mira.
  const horaLocal = (h) => new Date(Date.UTC(2024, 0, 1, h)).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.cumple_v.intro')}</p>
      {form.activo && !form.canalId && <Aviso tipo="alerta">{t('dashboard.cumple_v.needChannel')}</Aviso>}

      <div data-help="cumple-config" className={tarjeta}>
        <CabeceraTarjeta icono={Cake} titulo={t('dashboard.cumple_v.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.cumple_v.channel')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} />
          </Campo>
          <Campo etiqueta={t('dashboard.cumple_v.hour')} ayuda={t('dashboard.cumple_v.hourHint', { hora: horaLocal(form.hora ?? 9) })}>
            <select value={form.hora ?? 9} onChange={(e) => set('hora')(Number(e.target.value))} className={campo}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00 UTC`}</option>)}
            </select>
          </Campo>
          <Campo etiqueta={t('dashboard.cumple_v.message')} ayuda={t('dashboard.cumple_v.messageHint', { vars: VARIABLES.join(' ') })} className="sm:col-span-2">
            <textarea rows={2} maxLength={1000} value={form.mensaje || ''} onChange={(e) => set('mensaje')(e.target.value)} className={`${campo} resize-y`} />
          </Campo>
          <Campo etiqueta={t('dashboard.cumple_v.role')} ayuda={t('dashboard.cumple_v.roleHint')}>
            <SelectRol roles={roles} value={form.rolId} onChange={set('rolId')} vacio={t('dashboard.cumple_v.noRole')} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta={t('dashboard.cumple_v.gold')}><Numero value={form.oro ?? 0} onChange={set('oro')} max={1000000} /></Campo>
            <Campo etiqueta={t('dashboard.cumple_v.xp')}><Numero value={form.xp ?? 0} onChange={set('xp')} max={100000} disabled={!datos.nivelesActivo} /></Campo>
          </div>
        </div>
        {!datos.nivelesActivo && form.xp > 0 && <div className="mt-3"><Aviso>{t('dashboard.cumple_v.xpNeedsLevels')}</Aviso></div>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} />
          <button type="button" onClick={probar} disabled={prueba === 'enviando' || !form.canalId}
            className="flex items-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50">
            {prueba === 'enviando' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {t('dashboard.cumple_v.test')}
          </button>
          {prueba === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.cumple_v.testOk')}</span>}
          {prueba && prueba !== 'ok' && prueba !== 'enviando' && <span className="text-sm font-semibold text-danger">{prueba}</span>}
        </div>
      </div>

      <div data-help="cumple-lista" className={tarjeta}>
        <CabeceraTarjeta icono={CalendarHeart} titulo={t('dashboard.cumple_v.upcoming')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.cumple_v.upcomingHint')}</p>
        {datos.proximos.length === 0 ? (
          <Vacio icono={Cake} titulo={t('dashboard.cumple_v.emptyTitle')} sub={t('dashboard.cumple_v.emptySub')} />
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {datos.proximos.map((p) => (
              <li key={p.userId} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${p.faltan === 0 ? 'border-pink-400/50 bg-pink-400/10' : 'border-line bg-bg'}`}>
                <Avatar src={p.avatar} name={p.nombre} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{p.nombre}</span>
                  <span className="block text-xs text-muted">{fecha(p.dia, p.mes)}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${p.faltan === 0 ? 'bg-pink-400 text-white' : 'bg-elevated text-muted'}`}>
                  {p.faltan === 0 ? t('dashboard.cumple_v.today') : t('dashboard.cumple_v.inDays', { count: p.faltan })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
