// Música → «Cuenta de YouTube» (solo el propietario del bot). YouTube pide iniciar
// sesión para dejar sonar muchas canciones («This video requires login»); con una
// cuenta de Google conectada vuelven a sonar. El inicio de sesión es el de las TVs:
// se abre google.com/device en el móvil y se escribe el código que sale aquí.
// Lógica en utils/cuentaYoutube.js (bot) y scripts/lavalink.js (lanzador).
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CirclePlay, Loader2, Copy, Check, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const boton = 'sk-foco inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

export default function CuentaYoutube({ destacar = false }) {
  const { t } = useTranslation();
  const [cuenta, setCuenta] = useState(null); // { disponible, estado, url, codigo }
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await apiFetch('/api/musica/youtube');
      if (r.ok) setCuenta(await r.json());
    } catch { /* se reintenta en el siguiente sondeo */ }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  // Mientras se espera a que se acepte en Google, se mira cada 3 s si ya está.
  const esperando = cuenta?.estado === 'esperando';
  useEffect(() => {
    if (!esperando) return undefined;
    const id = setInterval(() => { if (!document.hidden) cargar(); }, 3000);
    return () => clearInterval(id);
  }, [esperando, cargar]);

  const accion = async (ruta) => {
    setOcupado(true); setError('');
    try {
      const r = await apiFetch(`/api/musica/youtube/${ruta}`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.codigo ? t(`dashboard.music_v.yt.errores.${d.codigo}`, { defaultValue: d.error }) : (d.error || t('dashboard.music_v.yt.errores.fallo')));
      else setCuenta(d);
    } catch { setError(t('dashboard.music_v.yt.errores.apagado')); }
    setOcupado(false);
  };
  const desconectar = () => { if (window.confirm(t('dashboard.music_v.yt.confirmarDesconectar'))) accion('desconectar'); };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(cuenta.codigo); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ }
  };

  if (!cuenta) return null;
  const { estado } = cuenta;

  return (
    <div id="cuenta-youtube" className={`${card} ${destacar ? 'ring-2 ring-amber-400/60' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CirclePlay size={18} className="text-red-500" />
        <h3 className="text-lg font-bold text-fg">{t('dashboard.music_v.yt.titulo')}</h3>
        {estado === 'conectada' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success"><CheckCircle2 size={12} /> {t('dashboard.music_v.yt.conectada')}</span>
        )}
      </div>
      <p className="text-sm text-muted">{t('dashboard.music_v.yt.intro')}</p>

      {!cuenta.disponible ? (
        <p className="mt-3 rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-fg">{t('dashboard.music_v.yt.noDisponible')}</p>
      ) : estado === 'esperando' ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-line bg-bg p-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-fg">
            <li>
              {t('dashboard.music_v.yt.paso1')}{' '}
              <a href={cuenta.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand underline">
                {String(cuenta.url).replace(/^https?:\/\//, '')} <ExternalLink size={13} />
              </a>
            </li>
            <li>
              {t('dashboard.music_v.yt.paso2')}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-xl bg-elevated px-4 py-2 font-mono text-xl font-bold tracking-widest text-fg">{cuenta.codigo}</code>
                <button type="button" onClick={copiar} className="sk-foco inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-fg hover:border-brand">
                  {copiado ? <Check size={15} className="text-success" /> : <Copy size={15} />} {copiado ? t('dashboard.music_v.yt.copiado') : t('dashboard.music_v.yt.copiar')}
                </button>
              </div>
            </li>
            <li>{t('dashboard.music_v.yt.paso3')}</li>
          </ol>
          <p className="flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> {t('dashboard.music_v.yt.esperando')}</p>
        </div>
      ) : estado === 'conectada' ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-fg">{t('dashboard.music_v.yt.conectadaDesc')}</p>
          <button type="button" onClick={desconectar} disabled={ocupado} className={`${boton} border border-line bg-bg text-muted hover:text-danger`}>
            {t('dashboard.music_v.yt.desconectar')}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {['caducado', 'denegado', 'invalida'].includes(estado) && (
            <p className="flex items-start gap-2 text-sm text-warning"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {t(`dashboard.music_v.yt.estado.${estado}`)}</p>
          )}
          <p className="flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-fg"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" /> {t('dashboard.music_v.yt.secundaria')}</p>
          <button type="button" onClick={() => accion('conectar')} disabled={ocupado} className={`${boton} bg-gradient-brand text-on-brand shadow-soft`}>
            {ocupado ? <Loader2 size={16} className="animate-spin" /> : <CirclePlay size={16} />} {t('dashboard.music_v.yt.conectar')}
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
