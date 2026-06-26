// Comunidad · Sorteos — crea y gestiona sorteos en tu servidor de Discord.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Trash2, Info, Trophy, Clock, RefreshCw, Play, Users, ShieldCheck } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

function minLocal() {
  const d = new Date(Date.now() + 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function tiempoRestante(fechaFin) {
  const diff = new Date(fechaFin) - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SorteosView({ dash }) {
  const { t } = useTranslation();
  const { canales, roles, sorteos = [], crearSorteo, terminarSorteo, rerollSorteo, eliminarSorteo } = dash;

  const [nombre, setNombre] = useState('');
  const [premio, setPremio] = useState('');
  const [canalId, setCanalId] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [ganadores, setGanadores] = useState(1);
  const [nivelMin, setNivelMin] = useState(0);
  const [rolRequerido, setRolRequerido] = useState('');
  const [estado, setEstado] = useState('');

  const activos = sorteos.filter((s) => s.activo);
  const terminados = sorteos.filter((s) => !s.activo);

  const crear = async () => {
    setEstado('creando');
    const r = await crearSorteo({
      nombre, premio, canalId,
      fechaFin: new Date(fechaFin).toISOString(),
      ganadores: Number(ganadores),
      nivelMin: Number(nivelMin),
      rolRequerido: rolRequerido || null,
    });
    setEstado(r?.error ? `error:${r.error}` : 'ok');
    if (!r?.error) {
      setNombre(''); setPremio(''); setCanalId(''); setFechaFin('');
      setGanadores(1); setNivelMin(0); setRolRequerido('');
    }
  };

  const nombreCanal = (id) => (canales.find((c) => c.id === id) || {}).nombre || id;
  const nombreRol = (id) => (roles.find((r) => r.id === id) || {}).nombre || id;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.sorteos_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.sorteos_v.note')}</p>
      </div>

      {/* Sorteos activos */}
      <div data-help="sorteos-activos" className={card}>
        <h3 className="mb-3 font-bold text-fg">{t('dashboard.sorteos_v.active')}</h3>
        {activos.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-muted">{t('dashboard.sorteos_v.emptyActive')}</p>
        ) : (
          <div className="space-y-3">
            {activos.map((s) => {
              const restante = tiempoRestante(s.fechaFin);
              return (
                <div key={s._id} className="rounded-2xl border border-line bg-bg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold text-fg">
                        <Gift size={15} className="shrink-0 text-brand" />
                        {s.nombre}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">#{nombreCanal(s.canalId)}</p>
                      <p className="mt-1 text-sm text-muted">
                        {t('dashboard.sorteos_v.prize')}:{' '}
                        <span className="font-medium text-fg">{s.premio}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                          <Trophy size={10} /> {s.ganadores} {t('dashboard.sorteos_v.winners')}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">
                          <Users size={10} /> {s.participantes || 0} {t('dashboard.sorteos_v.entries')}
                        </span>
                        {restante && (
                          <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
                            <Clock size={10} /> {restante}
                          </span>
                        )}
                        {s.nivelMin > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">
                            <ShieldCheck size={10} /> Nv. {s.nivelMin}+
                          </span>
                        )}
                        {s.rolRequerido && (
                          <span className="flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">
                            @{nombreRol(s.rolRequerido)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => terminarSorteo(s._id)}
                        title={t('dashboard.sorteos_v.endNow')}
                        className="rounded-xl border border-line px-2.5 py-2 text-brand transition-colors hover:bg-brand/10"
                      >
                        <Play size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarSorteo(s._id)}
                        className="rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sorteos terminados */}
      {terminados.length > 0 && (
        <div className={card}>
          <h3 className="mb-3 font-bold text-muted">{t('dashboard.sorteos_v.finished')}</h3>
          <div className="space-y-3">
            {terminados.slice(0, 5).map((s) => (
              <div key={s._id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-bg p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                    <Gift size={13} className="shrink-0 opacity-50" /> {s.nombre}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{t('dashboard.sorteos_v.prize')}: {s.premio}</p>
                  {s.ganadoresSeleccionados?.length > 0 && (
                    <p className="mt-1 text-xs font-semibold text-success">
                      <Trophy size={11} className="mr-1 inline" />
                      {s.ganadoresSeleccionados.map((g) => `@${g.tag || g.id}`).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => rerollSorteo(s._id)}
                    title={t('dashboard.sorteos_v.reroll')}
                    className="rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-brand"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminarSorteo(s._id)}
                    className="rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crear sorteo */}
      <div data-help="sorteos-crear" className={card}>
        <h3 className="mb-4 font-bold text-fg">{t('dashboard.sorteos_v.createTitle')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sorteos_v.name')}</span>
            <input
              value={nombre}
              onChange={(e) => { setEstado(''); setNombre(e.target.value); }}
              className={input}
              maxLength={100}
              placeholder={t('dashboard.sorteos_v.namePh')}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sorteos_v.prize')}</span>
            <input
              value={premio}
              onChange={(e) => { setEstado(''); setPremio(e.target.value); }}
              className={input}
              maxLength={200}
              placeholder={t('dashboard.sorteos_v.prizePh')}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sorteos_v.channel')}</span>
            <select value={canalId} onChange={(e) => { setEstado(''); setCanalId(e.target.value); }} className={input}>
              <option value="">{t('dashboard.sorteos_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sorteos_v.endAt')}</span>
            <input
              type="datetime-local"
              value={fechaFin}
              min={minLocal()}
              onChange={(e) => { setEstado(''); setFechaFin(e.target.value); }}
              className={input}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sorteos_v.winnersLabel')}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={ganadores}
              onChange={(e) => setGanadores(e.target.value)}
              className={input}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sorteos_v.minLevel')}</span>
            <input
              type="number"
              min={0}
              max={999}
              value={nivelMin}
              onChange={(e) => setNivelMin(e.target.value)}
              className={input}
              placeholder="0"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.sorteos_v.roleReq')}</span>
            <select value={rolRequerido} onChange={(e) => setRolRequerido(e.target.value)} className={input}>
              <option value="">{t('dashboard.sorteos_v.roleReqNone')}</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={crear}
            disabled={estado === 'creando' || !nombre || !premio || !canalId || !fechaFin}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Gift size={16} />
            {estado === 'creando' ? t('dashboard.sorteos_v.creating') : t('dashboard.sorteos_v.create')}
          </button>
          {estado === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.sorteos_v.createOk')}</span>}
          {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
        </div>
      </div>
    </div>
  );
}
