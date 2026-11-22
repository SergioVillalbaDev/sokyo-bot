// Panel → Propietario → «Acceso de soporte» (1.23.0, solo propietarios del bot).
// Crea la clave de soporte para ver, comprobar y, si lo permites, cambiar la
// configuración de los servidores por la API /api/soporte/… Se enseña UNA vez; se puede
// pasar a «solo mirar» o revocar. Los cambios salen en el historial como «Equipo de Sokyo».
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, Copy, Check, KeyRound, Eye, PencilLine, Trash2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../../lib/api';

async function llamar(ruta, opciones) {
  try {
    const r = await apiFetch(ruta, opciones);
    return { ok: r.ok, datos: await r.json().catch(() => ({})) };
  } catch { return { ok: false, datos: {} }; }
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const tarjeta = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

export default function OwnerSoporteView() {
  const { t, i18n } = useTranslation();
  const [acceso, setAcceso] = useState(undefined);
  const [clave, setClave] = useState('');
  const [copiada, setCopiada] = useState(false);
  const [modo, setModo] = useState('lectura');
  const [dias, setDias] = useState(30);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    llamar('/api/owner/soporte').then(({ ok, datos }) => { if (vivo) { if (ok) setAcceso(datos.acceso); else setError(datos.error || t('dashboard.owner_soporte.err')); } });
    return () => { vivo = false; };
  }, [t]);

  const hacer = async (ruta, opciones, alAcabar) => {
    setOcupado(true); setError('');
    const { ok, datos } = await llamar(ruta, opciones);
    setOcupado(false);
    if (!ok) { setError(datos.error || t('dashboard.owner_soporte.err')); return; }
    setAcceso(datos.acceso);
    alAcabar?.(datos);
  };
  const fecha = (d) => (d ? new Date(d).toLocaleString(i18n.language) : '—');
  const copiar = async () => { try { await navigator.clipboard.writeText(clave); setCopiada(true); setTimeout(() => setCopiada(false), 2000); } catch { /* sin portapapeles */ } };

  if (acceso === undefined && !error) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;

  return (
    <div className="space-y-5">
      <div className={tarjeta}>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand"><LifeBuoy size={22} /></span>
          <div>
            <p className="text-lg font-extrabold text-fg">{t('dashboard.owner_soporte.titulo')}</p>
            <p className="text-sm text-muted">{t('dashboard.owner_soporte.intro')}</p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          {['p1', 'p2', 'p3'].map((p) => <li key={p} className="rounded-2xl border border-line bg-bg p-3 text-fg">{t(`dashboard.owner_soporte.${p}`)}</li>)}
        </ul>
      </div>

      {error && <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {clave && (
        <div className={`${tarjeta} border-amber-400/60`}>
          <p className="flex items-center gap-2 text-sm font-extrabold text-amber-300"><KeyRound size={16} /> {t('dashboard.owner_soporte.nuevaTitulo')}</p>
          <p className="mt-1 text-xs text-muted">{t('dashboard.owner_soporte.nuevaSub')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl border border-line bg-bg px-3 py-2 text-xs text-fg">{clave}</code>
            <button type="button" onClick={copiar} className="sk-foco flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-sm font-bold text-on-brand">
              {copiada ? <Check size={15} /> : <Copy size={15} />} {copiada ? t('dashboard.owner_soporte.copiada') : t('dashboard.owner_soporte.copiar')}
            </button>
          </div>
          <p className="mt-3 text-xs text-fg">{t('dashboard.owner_soporte.comoDar')}</p>
        </div>
      )}

      <div className={tarjeta}>
        {acceso ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${acceso.activo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                {acceso.activo ? t('dashboard.owner_soporte.activa') : t('dashboard.owner_soporte.caducada')}
              </span>
              <span className="text-sm text-fg">{t('dashboard.owner_soporte.termina', { pista: acceso.pista })}</span>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-muted">{t('dashboard.owner_soporte.creada')}</dt><dd className="text-fg">{fecha(acceso.creado)}</dd></div>
              <div><dt className="text-xs text-muted">{t('dashboard.owner_soporte.caduca')}</dt><dd className="text-fg">{acceso.caduca ? fecha(acceso.caduca) : t('dashboard.owner_soporte.nunca')}</dd></div>
              <div><dt className="text-xs text-muted">{t('dashboard.owner_soporte.ultimoUso')}</dt><dd className="text-fg">{fecha(acceso.ultimoUso)}</dd></div>
              <div><dt className="text-xs text-muted">{t('dashboard.owner_soporte.usos')}</dt><dd className="text-fg">{acceso.usos}</dd></div>
            </dl>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.owner_soporte.quepuede')}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[['lectura', Eye], ['completo', PencilLine]].map(([m, Icono]) => (
                <button key={m} type="button" disabled={ocupado} onClick={() => acceso.modo !== m && hacer('/api/owner/soporte', json('PUT', { modo: m }))} aria-pressed={acceso.modo === m}
                  className={`flex items-start gap-3 rounded-2xl border p-3 text-left ${acceso.modo === m ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}>
                  <Icono size={18} className="mt-0.5 shrink-0 text-brand" />
                  <span><span className="block text-sm font-bold text-fg">{t(`dashboard.owner_soporte.modo.${m}.t`)}</span><span className="block text-xs text-muted">{t(`dashboard.owner_soporte.modo.${m}.d`)}</span></span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={ocupado} onClick={() => { if (window.confirm(t('dashboard.owner_soporte.confirmRevocar'))) hacer('/api/owner/soporte', { method: 'DELETE' }, () => setClave('')); }}
                className="sk-foco flex items-center gap-1.5 rounded-xl border border-red-500/40 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10"><Trash2 size={15} /> {t('dashboard.owner_soporte.revocar')}</button>
              <button type="button" disabled={ocupado} onClick={() => hacer('/api/owner/soporte', json('POST', { modo: acceso.modo, dias }), (d) => setClave(d.clave))}
                className="sk-foco flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-bold text-fg hover:border-brand"><KeyRound size={15} /> {t('dashboard.owner_soporte.otra')}</button>
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-bold text-fg"><ShieldCheck size={16} className="text-brand" /> {t('dashboard.owner_soporte.sinClave')}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {['lectura', 'completo'].map((m) => (
                <button key={m} type="button" onClick={() => setModo(m)} aria-pressed={modo === m}
                  className={`rounded-2xl border p-3 text-left ${modo === m ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}>
                  <span className="block text-sm font-bold text-fg">{t(`dashboard.owner_soporte.modo.${m}.t`)}</span>
                  <span className="block text-xs text-muted">{t(`dashboard.owner_soporte.modo.${m}.d`)}</span>
                </button>
              ))}
            </div>
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fg">
              {t('dashboard.owner_soporte.duracion')}
              <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg">
                {[1, 7, 30, 90, 0].map((d) => <option key={d} value={d}>{d ? t('dashboard.owner_soporte.dias', { count: d }) : t('dashboard.owner_soporte.nunca')}</option>)}
              </select>
            </label>
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={ocupado} onClick={() => hacer('/api/owner/soporte', json('POST', { modo, dias }), (d) => setClave(d.clave))}
                className="sk-foco flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-extrabold text-on-brand"><KeyRound size={16} /> {t('dashboard.owner_soporte.crear')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
