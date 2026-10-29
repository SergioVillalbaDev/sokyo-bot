// Historial de cambios: quién cambió qué en el panel y cuándo, con lo que había
// antes y lo que quedó, y «Volver a como estaba» en cada cambio. Lo apunta la API
// sola en cada guardado (utils/historialCambios.js) y se guarda 90 días.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Undo2, Loader2, ChevronDown, ChevronRight, AlertTriangle, User } from 'lucide-react';
import { apiFetch, procesarRespuesta } from '../../../lib/api';
import { cn } from '../../../lib/cn';

const card = 'rounded-3xl border border-line bg-card p-4 shadow-soft sm:p-5';
const ES_ID = /^\d{15,22}$/;

// Diferencias campo a campo (hasta 3 niveles), para enseñarlas en una lista.
function hojas(antes, despues, ruta = '', nivel = 0, out = []) {
  const esObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (nivel < 3 && (esObj(antes) || esObj(despues))) {
    const claves = new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})]);
    for (const k of claves) if (k !== '_id') hojas(antes?.[k], despues?.[k], ruta ? `${ruta}.${k}` : k, nivel + 1, out);
    return out;
  }
  if (JSON.stringify(antes ?? null) !== JSON.stringify(despues ?? null)) out.push({ ruta, antes, despues });
  return out;
}

export default function CambiosView({ dash }) {
  const { t, i18n } = useTranslation();
  const { guildId, setActiveTab, canales = [], roles = [], recargarSeccion } = dash;
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const [haciendo, setHaciendo] = useState(null);
  const [conflicto, setConflicto] = useState(null); // id del cambio que alguien tocó después
  const [aviso, setAviso] = useState('');
  const [ahora, setAhora] = useState(0); // cuándo llegó la lista (para «hace 5 minutos»)

  const cargar = useCallback(async () => {
    if (!guildId) return;
    try {
      setLista(await apiFetch(`/api/cambios?guildId=${encodeURIComponent(guildId)}&limite=60`).then(procesarRespuesta));
      setAhora(Date.now());
      setError(false);
    } catch { setError(true); }
  }, [guildId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la sección
  useEffect(() => { cargar(); }, [cargar]);

  const deshacer = async (c, forzar = false) => {
    setHaciendo(c.id); setAviso('');
    try {
      const res = await apiFetch(`/api/cambios/${c.id}/deshacer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, forzar }) });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409) { setConflicto(c.id); return; }
      if (!res.ok) { setAviso(t(`dashboard.cambios.errores.${d.codigo || 'otro'}`, { defaultValue: t('dashboard.cambios.errores.otro') })); return; }
      setConflicto(null);
      setAviso(d.omitidas?.length ? t('dashboard.cambios.hechoSinAcceso') : t('dashboard.cambios.hecho'));
      await cargar();
      recargarSeccion?.({ soloDatos: true });
    } finally { setHaciendo(null); }
  };

  const nombreValor = (v) => {
    if (v === null || v === undefined || v === '') return t('dashboard.cambios.vacio');
    if (typeof v === 'boolean') return v ? t('dashboard.cambios.si') : t('dashboard.cambios.no');
    if (typeof v === 'string' && ES_ID.test(v)) {
      const canal = canales.find((c) => c.id === v);
      if (canal) return `#${canal.nombre || canal.name}`;
      const rol = roles.find((r) => r.id === v);
      if (rol) return `@${rol.nombre || rol.name}`;
      return t('dashboard.cambios.algoBorrado');
    }
    if (Array.isArray(v)) return v.length ? (v.every((x) => typeof x !== 'object') ? v.map(nombreValor).join(', ') : t('dashboard.cambios.elementos', { count: v.length })) : t('dashboard.cambios.vacio');
    if (typeof v === 'object') return t('dashboard.cambios.ajustes', { count: Object.keys(v).length });
    const s = String(v);
    return s.length > 80 ? `${s.slice(0, 79)}…` : s;
  };
  const nombreRuta = (ruta) => ruta.split('.').map((p) => t(`dashboard.cambios.campos.${p}`, { defaultValue: p })).join(' › ');

  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
  const hace = (fecha) => {
    const seg = (new Date(fecha).getTime() - ahora) / 1000;
    const abs = Math.abs(seg);
    if (abs < 60) return rtf.format(Math.round(seg), 'second');
    if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
    return rtf.format(Math.round(seg / 86400), 'day');
  };

  if (error) return <p className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{t('dashboard.cambios.errorCarga')}</p>;
  if (!lista) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-4">
      <p data-help="cambios-intro" className="flex items-start gap-2 text-sm text-muted"><History size={16} className="mt-0.5 shrink-0 text-brand" /> {t('dashboard.cambios.intro')}</p>
      {aviso && <p className="rounded-2xl border border-brand/40 bg-brand/10 p-3 text-sm text-fg" role="status">{aviso}</p>}

      {!lista.length && (
        <div className={cn(card, 'text-center')}>
          <History size={32} className="mx-auto text-muted" />
          <p className="mt-2 font-semibold text-fg">{t('dashboard.cambios.vacioTitulo')}</p>
          <p className="mt-1 text-sm text-muted">{t('dashboard.cambios.vacioSub')}</p>
        </div>
      )}

      <ul data-help="cambios-lista" className="space-y-3">
        {lista.map((c) => {
          const detalles = c.claves.flatMap((k) => hojas(c.antes?.[k], c.despues?.[k], k));
          const desplegado = abierto === c.id;
          return (
            <li key={c.id} className={card}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <User size={14} className="text-muted" />
                    <span className="font-semibold text-fg">{c.usuarioNombre || t('dashboard.cambios.alguien')}</span>
                    <span className="text-muted">{c.deshaceA ? t('dashboard.cambios.deshizo') : t('dashboard.cambios.cambio')}</span>
                    {c.secciones.map((s) => (
                      <button key={s} onClick={() => s !== 'inicio' && setActiveTab(s)} className="sk-foco rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-fg hover:text-brand">
                        {s === 'inicio' ? t('dashboard.cambios.otros') : t(`dashboard.nav.items.${s}`)}
                      </button>
                    ))}
                    <span className="text-xs text-muted" title={new Date(c.fecha).toLocaleString(i18n.language)}>· {hace(c.fecha)}</span>
                  </p>
                  <button onClick={() => setAbierto(desplegado ? null : c.id)} className="sk-foco mt-2 flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg" aria-expanded={desplegado}>
                    {desplegado ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {t('dashboard.cambios.verDetalle', { count: detalles.length })}
                  </button>
                  {desplegado && (
                    <ul className="mt-2 space-y-1.5 rounded-2xl bg-elevated p-3 text-[13px]">
                      {detalles.slice(0, 40).map((d) => (
                        <li key={d.ruta} className="grid gap-0.5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-3">
                          <span className="truncate font-semibold text-fg" title={d.ruta}>{nombreRuta(d.ruta)}</span>
                          <span className="min-w-0 break-words text-muted">
                            <span className="line-through decoration-danger/60">{nombreValor(d.antes)}</span>
                            <span className="mx-1.5">→</span>
                            <span className="text-fg">{nombreValor(d.despues)}</span>
                          </span>
                        </li>
                      ))}
                      {detalles.length > 40 && <li className="text-muted">{t('dashboard.cambios.yMas', { count: detalles.length - 40 })}</li>}
                    </ul>
                  )}
                </div>
                <div className="shrink-0">
                  {c.deshechoEn ? (
                    <span className="rounded-full bg-elevated px-3 py-1 text-xs font-semibold text-muted">{t('dashboard.cambios.yaDeshecho', { quien: c.deshechoPor || t('dashboard.cambios.alguien') })}</span>
                  ) : (
                    <button onClick={() => deshacer(c)} disabled={haciendo === c.id}
                      className="sk-foco flex items-center gap-2 rounded-xl border border-line bg-elevated px-3.5 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand/40 disabled:opacity-60">
                      {haciendo === c.id ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />} {t('dashboard.cambios.volver')}
                    </button>
                  )}
                </div>
              </div>
              {conflicto === c.id && (
                <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm sm:flex-row sm:items-center">
                  <AlertTriangle size={16} className="shrink-0 text-warning" />
                  <span className="flex-1 text-fg">{t('dashboard.cambios.conflicto')}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setConflicto(null)} className="sk-foco rounded-xl px-3 py-1.5 text-sm font-semibold text-muted hover:text-fg">{t('dashboard.cambios.cancelar')}</button>
                    <button onClick={() => deshacer(c, true)} className="sk-foco rounded-xl bg-warning px-3 py-1.5 text-sm font-semibold text-black">{t('dashboard.cambios.igualmente')}</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
