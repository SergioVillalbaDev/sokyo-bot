// Configuración → Acceso al panel · «Acceso por persona» (1.13.0): dar el panel a alguien
// sin crearle un rol, con las secciones que elijas, si puede moderar y hasta cuándo.
// Solo los administradores dan y quitan (la API lo exige); cada cambio queda en el
// registro (Seguridad). API: /api/config/:guildId/acceso/personas (models/AccesoPersona.js).
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Search, Trash2, Loader2, Clock, Gavel, Plus, X } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { apiFetch, procesarRespuesta } from '../../../lib/api';
import { AREAS } from '../../../lib/accesoPanel';
import { navGroups } from '../navConfig';
import { useRelativo } from '../../../hooks/useModulo';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const DIAS = [0, 1, 3, 7, 14, 30, 90];
const estiloArea = (area) => {
  const g = navGroups.find((x) => x.id === area) || navGroups.find((x) => x.items.some((it) => it.area === area));
  const it = g?.items.find((x) => x.area === area);
  return { icono: (navGroups.find((x) => x.id === area)?.icon) || it?.icon, color: g?.color || '#94a3b8' };
};

export default function AccesosPersona({ guildId, onCambio }) {
  const { t, i18n } = useTranslation();
  const relativo = useRelativo();
  const [lista, setLista] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [resultados, setResultados] = useState([]);
  const [persona, setPersona] = useState(null);
  const [areas, setAreas] = useState(['tickets']);
  const [moderar, setModerar] = useState(false);
  const [dias, setDias] = useState(7);
  const [nota, setNota] = useState('');
  const [estado, setEstado] = useState('');

  const cargar = useCallback(() => {
    if (!guildId) return;
    apiFetch(`/api/config/${guildId}/acceso/personas`).then(procesarRespuesta)
      .then((d) => setLista(Array.isArray(d) ? d : [])).catch((e) => setLista({ error: e.message }));
    // El idioma: los errores de la API vienen en el idioma del panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, i18n.language]);
  useEffect(() => { cargar(); }, [cargar]);

  // Buscador de miembros (los 10 primeros que coinciden).
  useEffect(() => {
    if (!buscar.trim() || persona) return undefined;
    const id = setTimeout(() => {
      apiFetch(`/api/servidor/miembros?guildId=${encodeURIComponent(guildId)}&q=${encodeURIComponent(buscar.trim())}`)
        .then(procesarRespuesta).then((d) => setResultados(Array.isArray(d) ? d : [])).catch(() => setResultados([]));
    }, 250);
    return () => clearTimeout(id);
  }, [buscar, guildId, persona]);

  const dar = async () => {
    setEstado('guardando');
    const res = await apiFetch(`/api/config/${guildId}/acceso/personas/${persona.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ areas, moderar, dias, nota }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setEstado(res.status === 403 ? t('dashboard.acceso_v.personas.onlyAdmin') : (d.error || t('dashboard.acceso_v.personas.error'))); return; }
    setEstado(''); setAbierto(false); setPersona(null); setBuscar(''); setNota(''); setAreas(['tickets']); setModerar(false); setDias(7);
    cargar(); onCambio?.();
  };
  const quitar = async (c) => {
    if (!window.confirm(t('dashboard.acceso_v.personas.confirmRemove', { nombre: c.nombre }))) return;
    const res = await apiFetch(`/api/config/${guildId}/acceso/personas/${c.userId}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); window.alert(res.status === 403 ? t('dashboard.acceso_v.personas.onlyAdmin') : (d.error || t('dashboard.acceso_v.personas.error'))); return; }
    cargar(); onCambio?.();
  };
  const alternarArea = (a) => setAreas((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]));

  return (
    <div data-help="acceso-personas" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-fg"><KeyRound size={18} className="text-brand" /> {t('dashboard.acceso_v.personas.title')}</h3>
          <p className="mt-0.5 text-xs text-muted">{t('dashboard.acceso_v.personas.desc')}</p>
        </div>
        {!abierto && (
          <button type="button" onClick={() => setAbierto(true)} className="sk-foco flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3.5 py-2 text-sm font-semibold text-on-brand">
            <Plus size={15} /> {t('dashboard.acceso_v.personas.give')}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-4 rounded-2xl border border-brand/40 bg-brand/5 p-4">
          {!persona ? (
            <>
              <label className="relative block">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input autoFocus value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={t('dashboard.acceso_v.personas.search')}
                  className="w-full rounded-xl border border-line bg-bg py-2 pl-9 pr-3 text-sm text-fg outline-none focus:border-brand" />
              </label>
              {resultados.length > 0 && (
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {resultados.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => setPersona(m)} className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-bg px-3 py-2 text-left hover:border-brand/50">
                        <Avatar src={m.avatar} name={m.displayName} size={28} />
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-fg">{m.displayName}</span><span className="block truncate text-[11px] text-muted">@{m.username}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Avatar src={persona.avatar} name={persona.displayName} size={40} />
                <span className="min-w-0 flex-1"><span className="block truncate font-bold text-fg">{persona.displayName}</span><span className="block truncate text-xs text-muted">@{persona.username}</span></span>
                <button type="button" onClick={() => setPersona(null)} className="sk-boton-icono" aria-label={t('dashboard.acceso_v.personas.change')}><X size={15} /></button>
              </div>
              <p className="mt-4 text-sm font-semibold text-fg">{t('dashboard.acceso_v.personas.which')}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {AREAS.map((a) => {
                  const { icono: Icono, color } = estiloArea(a);
                  const si = areas.includes(a);
                  return (
                    <button key={a} type="button" onClick={() => alternarArea(a)} aria-pressed={si}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${si ? 'text-fg' : 'border-line text-muted hover:text-fg'}`}
                      style={si ? { borderColor: color, background: `${color}22` } : undefined}>
                      {Icono && <Icono size={12} style={{ color }} />} {t(`dashboard.acceso_v.areaNames.${a}`)}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-fg">{t('dashboard.acceso_v.personas.until')}</span>
                  <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none">
                    {DIAS.map((d) => <option key={d} value={d}>{d ? t('dashboard.acceso_v.personas.days', { count: d }) : t('dashboard.acceso_v.personas.forever')}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-fg">{t('dashboard.acceso_v.personas.note')}</span>
                  <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder={t('dashboard.acceso_v.personas.notePh')}
                    className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand" />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-line bg-bg px-4 py-3">
                <span className="text-sm font-semibold text-fg"><Gavel size={14} className="mr-1.5 inline text-danger" />{t('dashboard.acceso_v.personas.mod')}</span>
                <Toggle checked={moderar} onChange={setModerar} />
              </div>
            </>
          )}
          {estado && estado !== 'guardando' && <p className="mt-3 text-sm font-semibold text-danger">{estado}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => { setAbierto(false); setPersona(null); setBuscar(''); setEstado(''); }} className="sk-foco rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:text-fg">{t('dashboard.acceso_v.personas.cancel')}</button>
            <button type="button" onClick={dar} disabled={!persona || !areas.length || estado === 'guardando'}
              className="sk-foco flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-50">
              {estado === 'guardando' ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {t('dashboard.acceso_v.personas.confirm')}
            </button>
          </div>
        </div>
      )}

      {lista?.error ? <p className="mt-4 text-sm font-semibold text-danger">{lista.error}</p>
        : !lista ? null
        : lista.length === 0 ? <p className="mt-4 text-sm italic text-muted">{t('dashboard.acceso_v.personas.empty')}</p>
        : (
          <ul className="mt-4 grid gap-2.5 lg:grid-cols-2">
            {lista.map((c) => (
              <li key={c.userId} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-3">
                <Avatar src={c.avatar} name={c.nombre} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-bold text-fg">{c.nombre}{c.moderar && <Gavel size={12} className="shrink-0 text-danger" />}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {c.areas.map((a) => { const { icono: Icono, color } = estiloArea(a); return Icono ? <span key={a} title={t(`dashboard.acceso_v.areaNames.${a}`)} className="grid h-6 w-6 place-items-center rounded-md" style={{ background: `${color}22`, color }}><Icono size={12} /></span> : null; })}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                    <Clock size={11} /> {c.expiraEn ? t('dashboard.acceso_v.personas.ends', { cuando: relativo(c.expiraEn) }) : t('dashboard.acceso_v.personas.noEnd')}
                    {c.creadoPorNombre ? ` · ${t('dashboard.acceso_v.personas.by', { nombre: c.creadoPorNombre })}` : ''}
                  </span>
                  {c.nota && <span className="mt-0.5 block truncate text-[11px] italic text-muted">“{c.nota}”</span>}
                </span>
                <button type="button" onClick={() => quitar(c)} className="sk-foco flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10">
                  <Trash2 size={13} /> {t('dashboard.acceso_v.personas.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
