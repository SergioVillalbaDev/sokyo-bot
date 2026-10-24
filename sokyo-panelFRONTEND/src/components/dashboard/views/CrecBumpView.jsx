// Crecimiento · Recordatorio de bump — avisa cuando se puede volver a hacer /bump
// en DISBOARD, menciona a un rol y premia con oro. Lógica del bot en utils/bump.js.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsUp, Timer, Trophy, ExternalLink } from 'lucide-react';
import { Avatar } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { relativo } from './crecimientoUtils';

export default function CrecBumpView({ dash }) {
  const { t, i18n } = useTranslation();
  const { canales, roles, cargarCrecimiento, guardarCrecimiento } = dash;

  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    const r = await cargarCrecimiento('bump');
    if (r.error) { setDatos({ error: r.error }); return; }
    setDatos(r);
    setForm(r.config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);
  // La cuenta atrás del próximo bump se refresca cada 30 s.
  useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 30000); return () => clearInterval(id); }, []);

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.crec_v.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setEstado(''); };
  const guardar = async () => {
    setEstado('guardando');
    const r = await guardarCrecimiento('bump', form);
    if (r.error) { setEstado(r.error); return; }
    setEstado('ok');
    cargar();
  };

  const e = datos.estado || {};
  const proximo = e.proximoBump ? new Date(e.proximoBump) : null;
  const yaSePuede = proximo && proximo.getTime() <= ahora;
  const fecha = (d) => new Date(d).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.crec_v.bump.intro')}</p>
      {!datos.disboard && (
        <Aviso tipo="alerta" accion={(
          <a href="https://disboard.org/" target="_blank" rel="noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand">
            {t('dashboard.crec_v.bump.addDisboard')} <ExternalLink size={13} />
          </a>
        )}>{t('dashboard.crec_v.bump.noDisboard')}</Aviso>
      )}

      <div data-help="bump-config" className={tarjeta}>
        <CabeceraTarjeta icono={ChevronsUp} titulo={t('dashboard.crec_v.bump.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.crec_v.bump.channel')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} vacio={t('dashboard.crec_v.bump.channelAuto')} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.bump.role')} ayuda={t('dashboard.crec_v.bump.roleHint')}>
            <SelectRol roles={roles} value={form.rolId} onChange={set('rolId')} vacio={t('dashboard.crec_v.noMention')} />
          </Campo>
          <Campo etiqueta={`🪙 ${t('dashboard.crec_v.bump.gold')}`}>
            <Numero value={form.oroPorBump} onChange={set('oroPorBump')} min={0} max={10000} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.bump.reminder')} className="sm:col-span-2">
            <textarea rows={2} maxLength={500} value={form.mensajeRecordatorio || ''} onChange={(ev) => set('mensajeRecordatorio')(ev.target.value)} className={campo} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.bump.thanks')} ayuda={t('dashboard.crec_v.bump.thanksHint')} className="sm:col-span-2">
            <textarea rows={2} maxLength={500} value={form.mensajeGracias || ''} onChange={(ev) => set('mensajeGracias')(ev.target.value)} className={campo} />
          </Campo>
        </div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} /></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div data-help="bump-estado" className={tarjeta}>
          <CabeceraTarjeta icono={Timer} titulo={t('dashboard.crec_v.bump.statusTitle')} />
          {!proximo ? (
            <p className="mt-4 text-sm text-muted">{t('dashboard.crec_v.bump.never')}</p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-line bg-bg p-4">
                <p className="text-xs font-semibold text-muted">{t('dashboard.crec_v.bump.next')}</p>
                {yaSePuede
                  ? <p className="mt-1 text-lg font-extrabold text-success">{t('dashboard.crec_v.bump.available')}</p>
                  : <p className="mt-1 text-lg font-extrabold text-fg">{relativo(proximo, i18n.language, ahora)} <span className="text-xs font-normal text-muted">· {fecha(proximo)}</span></p>}
              </div>
              {e.ultimoBumpFecha && (
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg p-4">
                  {e.ultimoBumpPor && e.ultimoBumpPor.id && <Avatar src={e.ultimoBumpPor.avatar} name={e.ultimoBumpPor.nombre || '?'} size={32} />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted">{t('dashboard.crec_v.bump.last')}</p>
                    <p className="truncate text-sm text-fg">
                      {relativo(e.ultimoBumpFecha, i18n.language, ahora)}
                      {e.ultimoBumpPor && e.ultimoBumpPor.nombre ? ` · ${t('dashboard.crec_v.bump.by', { name: e.ultimoBumpPor.nombre })}` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="mt-4 text-xs text-muted">{t('dashboard.crec_v.bump.total')}: <b className="text-fg">{datos.total || 0}</b></p>
        </div>

        <div data-help="bump-ranking" className={tarjeta}>
          <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.crec_v.bump.rankingTitle')} />
          {(datos.ranking || []).length === 0 ? (
            <p className="mt-4 text-sm italic text-muted">{t('dashboard.crec_v.bump.rankingEmpty')}</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {datos.ranking.map((r, i) => (
                <li key={r.userId} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2">
                  <span className="w-6 text-center font-bold text-brand">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
                  <Avatar src={r.avatar} name={r.nombre || '?'} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{r.nombre || r.userId}</span>
                  <span className="text-xs text-muted"><b className="text-sm text-fg">{r.bumps}</b> {t('dashboard.crec_v.bump.bumps')}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <Aviso>{t('dashboard.crec_v.bump.how')}</Aviso>
    </div>
  );
}
