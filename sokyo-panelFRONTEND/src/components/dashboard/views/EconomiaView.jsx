// Diversión · Juegos y economía (1.34.0): un resumen de todo lo que mueve oro en el servidor, en un sitio: cuánto oro
// hay y quién tiene más, lo que se jugó en el casino esta semana (y lo que se quedó la casa, que es oro que sale de la
// economía), los cofres abiertos y los juegos favoritos. Con accesos a cada sección de juegos.
// API: GET /api/config/:guildId/economia (api/routes/experiencia.js).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Loader2, TrendingDown, Gift, Users, Gamepad2, ArrowRight } from 'lucide-react';
import { apiFetch, procesarRespuesta } from '../../../lib/api';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const SECCIONES = [['com-tienda', '🛒'], ['com-casino', '🎰'], ['com-compis', '🐾'], ['com-mascota', '🐉'], ['com-clanes', '🛡️'], ['com-bromas', '😜'], ['crec-liga', '🏅']];

function Cifra({ icono: Icono, valor, etiqueta, ayuda }) {
  return (
    <div className="rounded-2xl border border-line bg-elevated/50 p-4" title={ayuda}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Icono size={14} /> {etiqueta}</p>
      <p className="mt-1 text-2xl font-extrabold text-fg">{valor}</p>
      {ayuda && <p className="mt-0.5 text-xs text-muted">{ayuda}</p>}
    </div>
  );
}

export default function EconomiaView({ dash }) {
  const { t, i18n } = useTranslation();
  const { guildId, setActiveTab } = dash;
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!guildId) return undefined;
    let vivo = true;
    apiFetch(`/api/config/${guildId}/economia`).then(procesarRespuesta).then((r) => { if (vivo) { setD(r); setError(''); } }).catch((e) => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [guildId, i18n.language]);
  const n = (v) => Number(v || 0).toLocaleString(i18n.language?.startsWith('es') ? 'es-ES' : 'en-US');
  if (error) return <div className={card}><p className="text-danger">{error}</p></div>;
  if (!d) return <div className="grid place-items-center py-16 text-muted"><Loader2 className="animate-spin" /></div>;
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.economia_v.intro')}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra icono={Coins} etiqueta={t('dashboard.economia_v.oro')} valor={`🪙 ${n(d.oro)}`} ayuda={t('dashboard.economia_v.oroHint', { n: n(d.conOro) })} />
        <Cifra icono={Gamepad2} etiqueta={t('dashboard.economia_v.jugadas')} valor={n(d.casino.jugadas)} ayuda={t('dashboard.economia_v.jugadoresHint', { n: n(d.casino.jugadores) })} />
        <Cifra icono={TrendingDown} etiqueta={t('dashboard.economia_v.casa')} valor={`🪙 ${n(d.casino.casa)}`} ayuda={t('dashboard.economia_v.casaHint', { a: n(d.casino.apostado) })} />
        <Cifra icono={Gift} etiqueta={t('dashboard.economia_v.cofres')} valor={n(d.cofres7d)} ayuda={t('dashboard.economia_v.semana')} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><Users size={16} /> {t('dashboard.economia_v.top')}</h3>
          {d.top.length ? (
            <ol className="mt-3 space-y-2">{d.top.map((x, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-elevated/50 px-3 py-2"><span className="w-6 text-center font-bold">{['🥇', '🥈', '🥉'][i] || i + 1}</span><span className="flex-1 truncate text-fg">{x.nombre}</span><span className="font-mono text-sm text-muted">🪙 {n(x.oro)}</span></li>
            ))}</ol>
          ) : <p className="mt-3 text-sm text-muted">{t('dashboard.economia_v.nadie')}</p>}
        </div>
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><Gamepad2 size={16} /> {t('dashboard.economia_v.juegos')}</h3>
          {d.juegos.length ? (
            <ul className="mt-3 space-y-2">{d.juegos.map((j) => (
              <li key={j.juego} className="flex items-center justify-between rounded-xl bg-elevated/50 px-3 py-2"><span className="text-fg">{t(`dashboard.casino_v.juegos.${j.juego}.n`, { defaultValue: j.juego })}</span><span className="font-mono text-sm text-muted">{n(j.n)}</span></li>
            ))}</ul>
          ) : <p className="mt-3 text-sm text-muted">{t('dashboard.economia_v.sinJuegos')}</p>}
        </div>
      </div>
      <div className={card}>
        <h3 className="font-bold text-fg">{t('dashboard.economia_v.secciones')}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SECCIONES.map(([tab, e]) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className="sk-foco flex items-center gap-2 rounded-xl border border-line bg-elevated/40 px-3 py-2.5 text-left text-sm font-semibold text-fg hover:border-brand/50">
              <span>{e}</span><span className="flex-1">{t(`dashboard.nav.items.${tab}`)}</span><ArrowRight size={14} className="text-muted" />
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">{t('dashboard.economia_v.virtual')}</p>
      </div>
    </div>
  );
}
