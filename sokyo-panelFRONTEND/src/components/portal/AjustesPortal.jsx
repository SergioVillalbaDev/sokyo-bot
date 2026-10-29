// «Mis avisos y sanciones» en Mi cuenta: qué privados quieres del bot y en qué
// idioma te habla (lo mismo que /preferencias en Discord), tu cumpleaños (lo mismo
// que /cumple), los sorteos que has ganado y tu historial de sanciones en los
// servidores, con su estado.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Gavel, Gift, Loader2, ExternalLink, Globe, ShieldCheck, Cake } from 'lucide-react';
import { Tarjeta, TituloVista, Vacio } from './glass';

const TIPOS = ['anuncios', 'tickets', 'niveles', 'sorteos'];
const COLOR_ESTADO = { activa: '#f87171', terminada: '#94a3b8', quitada: '#34d399', registrada: '#fbbf24' };

function Interruptor({ activo, onCambiar, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} onClick={() => onCambiar(!activo)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${activo ? 'bg-[var(--accent-color)]' : 'bg-white/15'}`}>
      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

const fecha = (f, lng) => (f ? new Date(f).toLocaleDateString(lng, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Mi cumpleaños: día y mes (sin el año). Vale en todos los servidores con Sokyo.
function Cumple({ portalFetch, avisar }) {
  const { t, i18n } = useTranslation();
  const [cumple, setCumple] = useState(null); // { dia, mes } (null = cargando)
  const [form, setForm] = useState({ dia: '', mes: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    portalFetch('/api/portal/cumple').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!vivo) return;
      const c = d && d.dia ? d : { dia: null, mes: null };
      setCumple(c);
      setForm({ dia: c.dia || '', mes: c.mes || '' });
    }).catch(() => { if (vivo) setCumple({ dia: null, mes: null }); });
    return () => { vivo = false; };
  }, [portalFetch]);

  const meses = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2024, i, 1)).toLocaleDateString(i18n.language, { month: 'long', timeZone: 'UTC' }));
  const maxDia = form.mes ? DIAS_MES[form.mes - 1] : 31;
  const guardar = async (datos) => {
    setGuardando(true);
    const r = await portalFetch('/api/portal/cumple', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }).catch(() => null);
    setGuardando(false);
    if (r && r.ok) {
      const c = await r.json();
      setCumple(c);
      setForm({ dia: c.dia || '', mes: c.mes || '' });
      avisar?.(t('portal.ajustes.guardado'), 'ok');
    } else avisar?.(t('portal.login.errConexion'), 'error');
  };
  const cambiado = cumple && (Number(form.dia) !== (cumple.dia || 0) || Number(form.mes) !== (cumple.mes || 0));

  return (
    <Tarjeta className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold text-fg"><Cake size={18} className="text-pink-400" /> {t('portal.ajustes.cumpleTitle')}</h2>
      <p className="mt-1 text-sm text-muted">{t('portal.ajustes.cumpleDesc')}</p>
      {!cumple ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted" /></div> : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">{t('portal.ajustes.cumpleDia')}</span>
            <select value={form.dia} onChange={(e) => setForm((f) => ({ ...f, dia: Number(e.target.value) || '' }))} className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-2 text-sm text-fg">
              <option value="">—</option>
              {Array.from({ length: maxDia }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">{t('portal.ajustes.cumpleMes')}</span>
            <select value={form.mes} onChange={(e) => setForm((f) => ({ ...f, mes: Number(e.target.value) || '', dia: f.dia && Number(e.target.value) && f.dia > DIAS_MES[Number(e.target.value) - 1] ? '' : f.dia }))} className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-2 text-sm capitalize text-fg">
              <option value="">—</option>
              {meses.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <button type="button" disabled={guardando || !form.dia || !form.mes || !cambiado} onClick={() => guardar({ dia: form.dia, mes: form.mes })}
            className="rounded-xl bg-[var(--accent-color)] px-4 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-40">
            {guardando ? <Loader2 size={16} className="animate-spin" /> : t('portal.ajustes.cumpleGuardar')}
          </button>
          {cumple.dia && (
            <button type="button" disabled={guardando} onClick={() => guardar({ dia: null, mes: null })} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-fg">
              {t('portal.ajustes.cumpleBorrar')}
            </button>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

export default function AjustesPortal({ portalFetch, avisar, sorteos = [] }) {
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = useState(null);
  const [sanciones, setSanciones] = useState(null);

  useEffect(() => {
    let vivo = true;
    portalFetch('/api/portal/preferencias').then((r) => (r.ok ? r.json() : null)).then((d) => { if (vivo && d) setPrefs(d); }).catch(() => {});
    portalFetch('/api/portal/sanciones').then((r) => (r.ok ? r.json() : [])).then((d) => { if (vivo) setSanciones(Array.isArray(d) ? d : []); }).catch(() => { if (vivo) setSanciones([]); });
    return () => { vivo = false; };
  }, [portalFetch]);

  const guardar = async (cambios) => {
    const antes = prefs;
    setPrefs((p) => ({ ...p, ...cambios, dms: { ...p.dms, ...(cambios.dms || {}) } }));
    const r = await portalFetch('/api/portal/preferencias', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) }).catch(() => null);
    if (r && r.ok) { setPrefs(await r.json()); avisar?.(t('portal.ajustes.guardado'), 'ok'); } else { setPrefs(antes); avisar?.(t('portal.login.errConexion'), 'error'); }
  };

  return (
    <div className="space-y-5">
      <TituloVista icono={Bell} color="#a855f7" titulo={t('portal.ajustes.title')} subtitulo={t('portal.ajustes.subtitle')} />

      {/* Avisos por privado e idioma */}
      <Tarjeta className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-fg"><Bell size={18} className="text-brand" /> {t('portal.ajustes.dmsTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('portal.ajustes.dmsDesc')}</p>
        {!prefs ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted" /></div> : (
          <>
            <ul className="mt-4 divide-y divide-white/10">
              {TIPOS.map((k) => (
                <li key={k} className="flex items-center justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-fg">{t(`portal.ajustes.dms.${k}`)}</span>
                    <span className="block text-xs text-muted">{t(`portal.ajustes.dmsHint.${k}`)}</span>
                  </span>
                  <Interruptor activo={prefs.dms?.[k] !== false} etiqueta={t(`portal.ajustes.dms.${k}`)} onCambiar={(v) => guardar({ dms: { [k]: v } })} />
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-fg"><Globe size={14} /> {t('portal.ajustes.idioma')}</p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('portal.ajustes.idioma')}>
                {['auto', 'es', 'en'].map((op) => (
                  <button key={op} type="button" role="radio" aria-checked={prefs.idioma === op} onClick={() => guardar({ idioma: op })}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${prefs.idioma === op ? 'border-[var(--accent-color)] bg-white/10 text-fg' : 'border-white/10 text-muted hover:text-fg'}`}>
                    {t(`portal.ajustes.idiomas.${op}`)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </Tarjeta>

      {/* Mi cumpleaños */}
      <Cumple portalFetch={portalFetch} avisar={avisar} />

      {/* Sorteos ganados */}
      {sorteos.length > 0 && (
        <Tarjeta className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-bold text-fg"><Gift size={18} className="text-pink-400" /> {t('portal.ajustes.sorteosTitle')}</h2>
          <ul className="mt-3 space-y-2">
            {sorteos.map((s) => (
              <li key={s.id} className="flex items-start gap-3 rounded-2xl bg-white/[.05] px-3 py-2.5">
                <span className="text-xl leading-none" aria-hidden="true">🎉</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{s.premio}</span>
                  <span className="block text-xs text-muted">{s.nombre}{s.servidor ? ` · ${s.servidor}` : ''} · {fecha(s.fecha, i18n.language)}</span>
                  <span className="mt-0.5 block text-xs text-fg/80">{t('portal.ajustes.sorteoComo')}</span>
                </span>
                {s.enlace && <a href={s.enlace} target="_blank" rel="noreferrer" className="gx-icono !h-8 !w-8 shrink-0" aria-label={t('portal.ajustes.verEnDiscord')} title={t('portal.ajustes.verEnDiscord')}><ExternalLink size={14} /></a>}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {/* Mis sanciones */}
      <Tarjeta className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-fg"><Gavel size={18} className="text-amber-400" /> {t('portal.ajustes.sancionesTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('portal.ajustes.sancionesDesc')}</p>
        {!sanciones ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-muted" /></div>
          : sanciones.length === 0 ? (
            <Vacio icono={ShieldCheck} titulo={t('portal.ajustes.sinSanciones')} texto={t('portal.ajustes.sinSancionesDesc')} className="mt-3" />
          ) : (
            <ul className="mt-4 space-y-2">
              {sanciones.map((s) => (
                <li key={s.id} className="rounded-2xl bg-white/[.05] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-fg">{t(`portal.ajustes.acciones.${s.accion}`, { defaultValue: s.accion })}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${COLOR_ESTADO[s.estado]}26`, color: COLOR_ESTADO[s.estado] }}>
                      {t(`portal.ajustes.estados.${s.estado}`)}
                    </span>
                    <span className="text-xs text-muted">{s.servidor} · {fecha(s.fecha, i18n.language)}</span>
                  </div>
                  {s.motivo && <p className="mt-1 text-sm text-fg/85">“{s.motivo}”</p>}
                  {s.estado === 'activa' && s.fin && <p className="mt-1 text-xs text-muted">{t('portal.ajustes.hasta', { fecha: new Date(s.fin).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>}
                </li>
              ))}
            </ul>
          )}
        <p className="mt-3 text-xs text-muted">{t('portal.ajustes.sancionesNota')}</p>
      </Tarjeta>
    </div>
  );
}
