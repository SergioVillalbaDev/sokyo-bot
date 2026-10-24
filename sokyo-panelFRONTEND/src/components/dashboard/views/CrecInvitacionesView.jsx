// Crecimiento · Invitaciones — quién invita a quién, antitrampas y recompensas
// (oro, XP y roles) para quien trae gente. Lógica del bot en utils/invitaciones.js.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, ShieldCheck, Gift, Trophy, Users, Plus, X, ArrowRight } from 'lucide-react';
import { Avatar } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { relativo } from './crecimientoUtils';

const COLOR_ESTADO = { valida: 'text-success', pendiente: 'text-warning', salio: 'text-muted', falsa: 'text-danger' };

export default function CrecInvitacionesView({ dash }) {
  const { t, i18n } = useTranslation();
  const { canales, roles, configServidor, cargarCrecimiento, guardarCrecimiento, setActiveTab } = dash;

  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState('');

  const cargar = useCallback(async () => {
    const r = await cargarCrecimiento('invitaciones');
    if (r.error) { setDatos({ error: r.error }); return; }
    setDatos(r);
    setForm({ ...r.config, recompensas: (r.config.recompensas || []).map((x) => ({ invitaciones: x.invitaciones, rolId: x.rolId })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.crec_v.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setEstado(''); };
  const setRecompensa = (i, k, v) => set('recompensas')(form.recompensas.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const nivelesActivos = !!(configServidor && configServidor.nivelesActivo);

  const guardar = async () => {
    setEstado('guardando');
    const r = await guardarCrecimiento('invitaciones', {
      ...form,
      recompensas: form.recompensas.filter((x) => x.rolId && Number(x.invitaciones) > 0),
    });
    if (r.error) { setEstado(r.error); return; }
    setEstado('ok');
    setDatos((d) => ({ ...d, config: r.config, permiso: r.permiso }));
    setForm({ ...r.config, recompensas: (r.config.recompensas || []).map((x) => ({ invitaciones: x.invitaciones, rolId: x.rolId })) });
  };

  const { resumen, ranking = [], recientes = [] } = datos;
  const origen = (r) => {
    if (r.fuente === 'invitacion' && r.invitadorId) return t('dashboard.crec_v.inv.invitedBy', { name: r.invitador || r.invitadorId });
    if (r.fuente === 'web') return t('dashboard.crec_v.inv.viaWeb');
    if (r.fuente === 'vanity') return t('dashboard.crec_v.inv.viaVanity');
    return t('dashboard.crec_v.inv.viaUnknown');
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.crec_v.inv.intro')}</p>
      {form.activo && datos.permiso === false && <Aviso tipo="alerta">{t('dashboard.crec_v.inv.noPermission')}</Aviso>}
      <Aviso>{t('dashboard.crec_v.inv.commandsNote')}</Aviso>

      <div data-help="inv-config" className={tarjeta}>
        <CabeceraTarjeta icono={Send} titulo={t('dashboard.crec_v.inv.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.crec_v.inv.announceChannel')}>
            <SelectCanal canales={canales} value={form.canalAvisosId} onChange={set('canalAvisosId')} vacio={t('dashboard.crec_v.inv.announceNone')} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.inv.message')} ayuda={t('dashboard.crec_v.inv.messageHint')} className="sm:col-span-2">
            <textarea rows={2} maxLength={500} value={form.mensaje || ''} onChange={(e) => set('mensaje')(e.target.value)} className={campo} disabled={!form.canalAvisosId} />
          </Campo>
        </div>
      </div>

      <div data-help="inv-reglas" className={tarjeta}>
        <CabeceraTarjeta icono={ShieldCheck} titulo={t('dashboard.crec_v.inv.rulesTitle')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.crec_v.inv.hours')} ayuda={t('dashboard.crec_v.inv.hoursHint')}>
            <Numero value={form.horasConfirmacion} onChange={set('horasConfirmacion')} min={0} max={168} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.inv.days')} ayuda={t('dashboard.crec_v.inv.daysHint')}>
            <Numero value={form.diasCuentaMin} onChange={set('diasCuentaMin')} min={0} max={365} />
          </Campo>
        </div>
      </div>

      <div data-help="inv-recompensas" className={tarjeta}>
        <CabeceraTarjeta icono={Gift} titulo={t('dashboard.crec_v.inv.rewardsTitle')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={`🪙 ${t('dashboard.crec_v.inv.gold')}`}>
            <Numero value={form.oroPorInvitacion} onChange={set('oroPorInvitacion')} min={0} max={10000} />
          </Campo>
          <Campo etiqueta={`✨ ${t('dashboard.crec_v.inv.xp')}`} ayuda={nivelesActivos ? null : t('dashboard.crec_v.inv.xpOff')}>
            <Numero value={form.xpPorInvitacion} onChange={set('xpPorInvitacion')} min={0} max={100000} disabled={!nivelesActivos} />
          </Campo>
        </div>
        <div className="mt-5">
          <p className="text-sm font-semibold text-fg">{t('dashboard.crec_v.inv.rolesTitle')}</p>
          <p className="mb-3 text-xs text-muted">{t('dashboard.crec_v.inv.rolesDesc')}</p>
          <div className="space-y-2">
            {form.recompensas.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <div className="flex w-full items-center gap-2 sm:w-44">
                  <input type="number" min={1} max={10000} value={r.invitaciones}
                    onChange={(e) => setRecompensa(i, 'invitaciones', e.target.value === '' ? '' : Number(e.target.value))}
                    className={`${campo} w-24`} aria-label={t('dashboard.crec_v.inv.invitesUnit')} />
                  <span className="text-xs text-muted">{t('dashboard.crec_v.inv.invitesUnit')}</span>
                </div>
                <div className="min-w-0 flex-1"><SelectRol roles={roles} value={r.rolId} onChange={(v) => setRecompensa(i, 'rolId', v)} /></div>
                <button type="button" onClick={() => set('recompensas')(form.recompensas.filter((_, idx) => idx !== i))}
                  className="shrink-0 rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-danger" aria-label="✕">
                  <X size={14} />
                </button>
              </div>
            ))}
            {form.recompensas.length < 20 && (
              <button type="button" onClick={() => set('recompensas')([...form.recompensas, { invitaciones: (form.recompensas.at(-1)?.invitaciones || 0) + 5, rolId: '' }])}
                className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted transition-colors hover:border-brand hover:text-brand">
                <Plus size={14} /> {t('dashboard.crec_v.inv.addRole')}
              </button>
            )}
          </div>
        </div>
      </div>

      <BotonGuardar estado={estado} onClick={guardar} />

      {resumen && (
        <div className={tarjeta}>
          <CabeceraTarjeta icono={Users} titulo={t('dashboard.crec_v.inv.statsTitle')} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-line bg-bg p-3">
              <p className="text-2xl font-extrabold text-fg">{resumen.total}</p>
              <p className="text-xs text-muted">{t('dashboard.crec_v.inv.statsTotal')}</p>
            </div>
            {['valida', 'pendiente', 'salio', 'falsa'].map((k) => (
              <div key={k} className="rounded-2xl border border-line bg-bg p-3">
                <p className={`text-2xl font-extrabold ${COLOR_ESTADO[k]}`}>{resumen.estados[k]}</p>
                <p className="text-xs text-muted">{t(`dashboard.crec_v.inv.estado.${k}`)}</p>
              </div>
            ))}
          </div>
          {resumen.total > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(resumen.fuentes).filter(([, n]) => n > 0).map(([k, n]) => (
                <span key={k} className="rounded-full border border-line bg-elevated px-3 py-1 text-xs text-muted">{t(`dashboard.crec_v.inv.fuente.${k}`)}: <b className="text-fg">{n}</b></span>
              ))}
            </div>
          )}
        </div>
      )}

      <div data-help="inv-ranking" className="grid gap-5 lg:grid-cols-2">
        <div className={tarjeta}>
          <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.crec_v.inv.rankingTitle')} />
          {ranking.length === 0 ? (
            <p className="mt-4 text-sm italic text-muted">{t('dashboard.crec_v.inv.rankingEmpty')}</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {ranking.map((r, i) => (
                <li key={r.userId} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2">
                  <span className="w-6 text-center font-bold text-brand">{['🥇', '🥈', '🥉'][i] || i + 1}</span>
                  <Avatar src={r.avatar} name={r.nombre || r.tag || '?'} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{r.nombre || r.tag || r.userId}</span>
                  <span className="text-right text-xs text-muted">
                    <b className="text-sm text-fg">{r.validas}</b> {t('dashboard.crec_v.inv.confirmed')}
                    {r.pendientes > 0 && <span className="block">+{r.pendientes} {t('dashboard.crec_v.inv.pending')}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className={tarjeta}>
          <CabeceraTarjeta icono={Users} titulo={t('dashboard.crec_v.inv.recentTitle')} />
          {recientes.length === 0 ? (
            <p className="mt-4 text-sm italic text-muted">{t('dashboard.crec_v.inv.recentEmpty')}</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recientes.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{r.invitado || r.invitadoId}</p>
                    <p className="truncate text-xs text-muted">{origen(r)} · {relativo(r.fecha, i18n.language)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold ${COLOR_ESTADO[r.estado] || 'text-muted'}`}>{t(`dashboard.crec_v.inv.estadoUno.${r.estado}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Aviso accion={(
        <button type="button" onClick={() => setActiveTab('com-sorteos')}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand">
          <Gift size={13} /> {t('dashboard.crec_v.inv.goGiveaways')} <ArrowRight size={13} />
        </button>
      )}>{t('dashboard.crec_v.inv.giveawayTip')}</Aviso>
    </div>
  );
}
