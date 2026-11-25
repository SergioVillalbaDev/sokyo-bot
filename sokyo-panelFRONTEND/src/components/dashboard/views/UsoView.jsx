// Datos · Uso de las funciones (1.34.0): qué se usa y qué no (últimos 30 días), dónde se para la gente en /empezar y
// qué ayudas «no se entienden» (botón 🤔 del bot). Solo cifras: no se guarda quién. Para saber qué explicar mejor o
// qué apagar. API: GET /api/config/:guildId/uso (api/routes/experiencia.js, área datos).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, BarChart3, EyeOff, HelpCircle, Footprints } from 'lucide-react';
import { apiFetch, procesarRespuesta } from '../../../lib/api';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
function Barras({ filas, vacio }) {
  const max = Math.max(1, ...filas.map((f) => f.n));
  if (!filas.length) return <p className="mt-3 text-sm text-muted">{vacio}</p>;
  return (
    <ul className="mt-3 space-y-1.5">{filas.map((f) => (
      <li key={f.clave} className="text-sm">
        <div className="flex justify-between gap-2"><span className="truncate text-fg">{f.etiqueta || f.clave}</span><span className="font-mono text-muted">{f.n}</span></div>
        <div className="mt-0.5 h-1.5 rounded-full bg-elevated"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${(f.n / max) * 100}%` }} /></div>
      </li>
    ))}</ul>
  );
}

export default function UsoView({ dash }) {
  const { t, i18n } = useTranslation();
  const { guildId } = dash;
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!guildId) return undefined;
    let vivo = true;
    apiFetch(`/api/config/${guildId}/uso`).then(procesarRespuesta).then((r) => { if (vivo) { setD(r); setError(''); } }).catch((e) => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [guildId, i18n.language]);
  if (error) return <div className={card}><p className="text-danger">{error}</p></div>;
  if (!d) return <div className="grid place-items-center py-16 text-muted"><Loader2 className="animate-spin" /></div>;
  const poco = d.modulos.filter((m) => m.n < 5);
  const fecha = (f) => new Date(f).toLocaleDateString(i18n.language?.startsWith('es') ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' });
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.uso_v.intro')}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><BarChart3 size={16} /> {t('dashboard.uso_v.masUsado')}</h3>
          <Barras filas={d.comandos.map((c) => ({ clave: c.clave, etiqueta: `/${c.clave}`, n: c.n }))} vacio={t('dashboard.uso_v.sinDatos')} />
        </div>
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><EyeOff size={16} /> {t('dashboard.uso_v.pocoUsado')}</h3>
          <p className="mt-1 text-xs text-muted">{t('dashboard.uso_v.pocoUsadoHint')}</p>
          {poco.length ? <ul className="mt-3 flex flex-wrap gap-2">{poco.map((m) => <li key={m.id} className="rounded-full border border-line bg-elevated/50 px-3 py-1 text-sm text-fg">{m.emoji} {m.nombre} <span className="text-muted">· {m.n}</span></li>)}</ul>
            : <p className="mt-3 text-sm text-muted">{t('dashboard.uso_v.todoUsado')}</p>}
        </div>
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><Footprints size={16} /> {t('dashboard.uso_v.pasos')}</h3>
          <p className="mt-1 text-xs text-muted">{t('dashboard.uso_v.pasosHint')}</p>
          <Barras filas={[...d.menu.map((x) => ({ clave: `m:${x.clave}`, etiqueta: `🏠 ${t(`dashboard.uso_v.menu.${x.clave}`, { defaultValue: x.clave })}`, n: x.n })), ...d.pasos.map((x) => ({ clave: `p:${x.clave}`, etiqueta: `👋 ${x.clave}`, n: x.n }))]} vacio={t('dashboard.uso_v.sinDatos')} />
        </div>
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><HelpCircle size={16} /> {t('dashboard.uso_v.noEntiende')}</h3>
          <p className="mt-1 text-xs text-muted">{t('dashboard.uso_v.noEntiendeHint')}</p>
          {d.comentarios.length ? <ul className="mt-3 space-y-2">{d.comentarios.map((c, i) => <li key={i} className="rounded-xl bg-elevated/50 px-3 py-2 text-sm"><span className="font-semibold text-fg">{c.tema}</span> <span className="text-xs text-muted">· {fecha(c.fecha)}</span>{c.texto ? <p className="mt-0.5 text-muted">«{c.texto}»</p> : null}</li>)}</ul>
            : <p className="mt-3 text-sm text-muted">{t('dashboard.uso_v.sinComentarios')}</p>}
        </div>
      </div>
    </div>
  );
}
