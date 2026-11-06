// Seguridad · Verificación → «Registro y cifras» (1.9.15): las cifras de los últimos 7
// días (verificados, esperando al staff, rechazados, captcha fallado, frenados por los
// requisitos, expulsados por no verificarse), lo último que ha pasado y «Verificar a
// alguien a mano». Bot: utils/puertaEntrada.js (registrar) y models/RegistroEntrada.js.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotebookPen, RefreshCw, UserPlus, Loader2, Check, AlertTriangle } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

// Cifra → qué tipos del registro suma (de los últimos 7 días), y su color. «Esperando al
// staff» (null) son las solicitudes que siguen esperando ahora (`esperando`).
const CIFRAS = [
  ['verificados', ['verificado', 'aceptado', 'manual'], '#22c55e'],
  ['pendientes', null, '#eab308'],
  ['rechazados', ['rechazado'], '#ef4444'],
  ['captcha', ['captcha_fallido'], '#f97316'],
  ['bloqueados', ['bloqueado'], '#94a3b8'],
  ['expulsados', ['expulsado'], '#dc2626'],
];
const ICONOS = { verificado: '✅', aceptado: '✅', manual: '🛠️', pendiente: '⏳', rechazado: '❌', captcha_fallido: '🧩', bloqueado: '🚧', expulsado: '👢' };
const DETALLES = ['edad', 'avatar', 'espera', 'esperar', 'aislar', 'expulsar'];

export default function RegistroVerificaciones({ dash }) {
  const { t } = useTranslation();
  const { cargarRegistroVerificacion, verificarAMano, configServidor } = dash;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [manual, setManual] = useState(null); // null | 'enviando' | { ok, texto }

  const leer = useCallback(async () => {
    const d = await cargarRegistroVerificacion();
    setError(!d);
    if (d) setDatos(d);
  }, [cargarRegistroVerificacion]);
  // Al abrir y cada 20 s (mientras se mira, entra gente).
  useEffect(() => {
    let vivo = true;
    const una = () => cargarRegistroVerificacion().then((d) => { if (!vivo) return; setError(!d); if (d) setDatos(d); });
    una();
    const id = setInterval(una, 20000);
    return () => { vivo = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configServidor?.guildId]);

  const verificar = async () => {
    if (!usuario.trim()) return;
    setManual('enviando');
    const r = await verificarAMano(usuario.trim());
    if (r.ok) {
      setManual({ ok: true, texto: t(r.fallo ? 'dashboard.verif_v.reg.manualOkRoles' : 'dashboard.verif_v.reg.manualOk', { nombre: r.usuario?.nombre || usuario }) });
      setUsuario('');
      leer();
    } else {
      const clave = { 'no-esta': 'manual_no_esta', ya: 'manual_ya', 'sin-acceso': 'manual_sin_acceso', jerarquia: 'manual_jerarquia' }[r.codigo] || 'manual_error';
      setManual({ ok: false, texto: t(`dashboard.verif_v.reg.${clave}`) });
    }
  };

  const semana = datos?.semana || {};
  const fecha = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  const detalle = (e) => (DETALLES.includes(e.detalle) ? t(`dashboard.verif_v.reg.det_${e.detalle}`) : e.detalle);

  return (
    <div data-help="verif-registro" className={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-fg"><NotebookPen size={18} className="text-brand" /> {t('dashboard.verif_v.reg.title')}</h3>
          <p className="mt-1 text-xs leading-snug text-muted">{t('dashboard.verif_v.reg.desc')}</p>
        </div>
        <button type="button" onClick={leer} className="shrink-0 rounded-xl border border-line p-2 text-muted transition-colors hover:text-fg" aria-label={t('dashboard.verif_v.reg.refresh')} title={t('dashboard.verif_v.reg.refresh')}><RefreshCw size={14} /></button>
      </div>

      {/* Cifras de la semana */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {CIFRAS.map(([id, tipos, color]) => (
          <div key={id} className="rounded-2xl border border-line bg-bg p-3" style={{ '--grupo': color }}>
            <p className="text-2xl font-extrabold tracking-tight" style={{ color }}>{!datos ? '–' : tipos ? tipos.reduce((n, tp) => n + (semana[tp] || 0), 0) : (datos.esperando || 0)}</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-tight text-muted">{t(`dashboard.verif_v.reg.st_${id}`)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 border-t border-line pt-4 lg:grid-cols-[1fr_320px]">
        {/* Lo último que ha pasado */}
        <div className="min-w-0">
          {error && (
            <p className="mb-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t('dashboard.verif_v.reg.err')}
            </p>
          )}
          {datos && datos.eventos.length === 0 && <p className="py-3 text-center text-sm italic text-muted">{t('dashboard.verif_v.reg.empty')}</p>}
          {datos && datos.eventos.length > 0 && (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {datos.eventos.map((e) => (
                <li key={e._id} className="flex items-start gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-sm">
                  <span aria-hidden="true">{ICONOS[e.tipo] || '•'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-fg">@{e.userTag || e.userId}</span>
                    <span className="text-muted"> · {t(`dashboard.verif_v.reg.tipo_${e.tipo}`, { defaultValue: e.tipo })}</span>
                    {e.detalle && <span className="block truncate text-xs text-muted">{detalle(e)}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{fecha(e.fecha)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Verificar a alguien a mano */}
        <div className="rounded-2xl border border-line bg-bg p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-fg"><UserPlus size={16} className="text-brand" /> {t('dashboard.verif_v.reg.manualTitle')}</p>
          <p className="mt-1 text-xs text-muted">{t('dashboard.verif_v.reg.manualDesc')}</p>
          <div className="mt-3 flex gap-2">
            <input value={usuario} onChange={(e) => { setUsuario(e.target.value); setManual(null); }} onKeyDown={(e) => { if (e.key === 'Enter') verificar(); }}
              placeholder={t('dashboard.verif_v.reg.manualPh')} className={`${input} min-w-0 flex-1`} aria-label={t('dashboard.verif_v.reg.manualPh')} />
            <button type="button" onClick={verificar} disabled={manual === 'enviando' || !usuario.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-success px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {manual === 'enviando' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t('dashboard.verif_v.reg.manualBtn')}
            </button>
          </div>
          {manual && manual !== 'enviando' && (
            <p role="status" className={`mt-2 text-xs font-semibold ${manual.ok ? 'text-success' : 'text-danger'}`}>{manual.texto}</p>
          )}
        </div>
      </div>
    </div>
  );
}
