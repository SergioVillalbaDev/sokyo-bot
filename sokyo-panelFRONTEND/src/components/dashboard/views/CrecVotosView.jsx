// Crecimiento · Votos en top.gg — cada voto da oro (global) y, en este servidor, un rol
// temporal, XP y un mensaje de gracias. Lógica del bot en utils/votos.js.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Vote, Trophy, ExternalLink } from 'lucide-react';
import { Avatar } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio } from './modulosShared';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import VistaDiscord from '../VistaDiscord';

const VARIABLES = ['{mention}', '{user}', '{gold}', '{extra}', '{next}', '{server}'];

export default function CrecVotosView({ dash }) {
  const { t } = useTranslation();
  const { canales, roles, cargarCrecimiento, guardarCrecimiento } = dash;
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState('');

  const cargar = useCallback(async () => {
    const r = await cargarCrecimiento('votos');
    if (r.error) { setDatos({ error: r.error }); return; }
    setDatos(r);
    setForm(r.config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setEstado('guardando');
    const r = await guardarCrecimiento('votos', form);
    if (r.error) { setEstado(r.error); return false; }
    setEstado('ok');
    return true;
  };
  const autoguardado = useAutoguardado(form, guardar, { listo: !!form, borrador: 'crec-votos', restaurar: setForm });

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setEstado(''); };
  const rol = roles.find((r) => r.id === form.rolId);
  const extras = [rol ? t('dashboard.votos_v.exRole', { rol: rol.name, horas: form.horasRol || 12 }) : '', form.xp > 0 && datos.nivelesActivo ? `${form.xp} XP` : ''].filter(Boolean);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.votos_v.intro', { oro: datos.oroPorVoto })}</p>
      {!datos.configurado && <Aviso tipo="alerta">{t('dashboard.votos_v.notConfigured')}</Aviso>}
      {datos.urlVoto && (
        <a href={datos.urlVoto} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand">
          <ExternalLink size={15} /> {t('dashboard.votos_v.voteLink')}
        </a>
      )}

      <div data-help="votos-config" className={tarjeta}>
        <CabeceraTarjeta icono={Vote} titulo={t('dashboard.votos_v.title')} activo={form.activo} onActivo={set('activo')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.votos_v.titleHint')}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.votos_v.channel')} ayuda={t('dashboard.votos_v.channelHint')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} vacio={t('dashboard.votos_v.noChannel')} />
          </Campo>
          <Campo etiqueta={t('dashboard.votos_v.role')} ayuda={t('dashboard.votos_v.roleHint')}>
            <SelectRol roles={roles} value={form.rolId} onChange={set('rolId')} vacio={t('dashboard.votos_v.noRole')} />
          </Campo>
          <Campo etiqueta={t('dashboard.votos_v.hours')}><Numero value={form.horasRol ?? 12} onChange={set('horasRol')} min={1} max={168} /></Campo>
          <Campo etiqueta={t('dashboard.votos_v.xp')}><Numero value={form.xp ?? 0} onChange={set('xp')} max={100000} disabled={!datos.nivelesActivo} /></Campo>
          <Campo etiqueta={t('dashboard.votos_v.message')} ayuda={t('dashboard.votos_v.messageHint', { vars: VARIABLES.join(' ') })} className="sm:col-span-2">
            <textarea rows={2} maxLength={800} value={form.mensaje || ''} onChange={(e) => set('mensaje')(e.target.value)} className={`${campo} resize-y`} />
          </Campo>
          <div className="sm:col-span-2">
            {/* Mismo formato que utils/votos.js (rellenar): {extra} = « y el rol … y 50 XP». */}
            <VistaDiscord texto={form.mensaje || ''} variables={{
              mention: '@Alex', user: 'Alex', gold: String(datos.oroPorVoto), server: 'Nébula Gaming', next: t('dashboard.votos_v.exNext'),
              extra: extras.length ? ` ${t('dashboard.votos_v.and')} ${extras.join(` ${t('dashboard.votos_v.and')} `)}` : '',
            }} />
          </div>
        </div>
        {!datos.nivelesActivo && form.xp > 0 && <div className="mt-3"><Aviso>{t('dashboard.votos_v.xpNeedsLevels')}</Aviso></div>}
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      <div data-help="votos-top" className={tarjeta}>
        <CabeceraTarjeta icono={Trophy} titulo={t('dashboard.votos_v.top', { n: datos.total30d })} />
        {datos.top.length === 0 ? (
          <Vacio icono={Vote} titulo={t('dashboard.votos_v.emptyTitle')} sub={t('dashboard.votos_v.emptySub')} />
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {datos.top.map((p) => (
              <li key={p.userId} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <Avatar src={p.avatar} name={p.nombre} size={34} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{p.nombre}</span>
                <span className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-xs font-bold text-muted">{t('dashboard.votos_v.votes', { count: p.votos })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
