// Comunidad · Eventos — crea y gestiona eventos del servidor de Discord.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Trash2, Info, Clock, Users, MapPin, Radio, Mic } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

function minLocal() {
  const d = new Date(Date.now() + 60000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const TIPO_ICONO = { voz: Mic, escenario: Radio, externo: MapPin };

export default function EventosView({ dash }) {
  const { t } = useTranslation();
  const { canales, eventos = [], crearEvento, eliminarEvento } = dash;

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [canalId, setCanalId] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [tipo, setTipo] = useState('voz');
  const [recordatorio, setRecordatorio] = useState('15');
  const [portada, setPortada] = useState('');
  const [estado, setEstado] = useState('');

  const proximos = (eventos)
    .filter((e) => new Date(e.fechaInicio) > Date.now())
    .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));
  const pasados = eventos.filter((e) => new Date(e.fechaInicio) <= Date.now());

  const crear = async () => {
    setEstado('creando');
    const r = await crearEvento({
      titulo, descripcion, canalId,
      fechaInicio: new Date(fechaInicio).toISOString(),
      tipo, recordatorio: Number(recordatorio),
      portada: portada || null,
    });
    setEstado(r?.error ? `error:${r.error}` : 'ok');
    if (!r?.error) {
      setTitulo(''); setDescripcion(''); setCanalId(''); setFechaInicio('');
      setTipo('voz'); setRecordatorio('15'); setPortada('');
    }
  };

  const nombreCanal = (id) => (canales.find((c) => c.id === id) || {}).nombre || id;
  const fecha = (d) => new Date(d).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.eventos_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.eventos_v.note')}</p>
      </div>

      {/* Próximos eventos */}
      <div data-help="eventos-proximos" className={card}>
        <h3 className="mb-3 font-bold text-fg">{t('dashboard.eventos_v.upcoming')}</h3>
        {proximos.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-muted">{t('dashboard.eventos_v.emptyUpcoming')}</p>
        ) : (
          <div className="space-y-3">
            {proximos.map((e) => {
              const Icon = TIPO_ICONO[e.tipo] || CalendarDays;
              return (
                <div key={e._id} className="rounded-2xl border border-line bg-bg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold text-fg">
                        <Icon size={15} className="shrink-0 text-brand" />
                        {e.titulo}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">#{nombreCanal(e.canalId)}</p>
                      {e.descripcion && (
                        <p className="mt-1 truncate text-xs text-muted">{e.descripcion}</p>
                      )}
                      {e.portada && (
                        <img
                          src={e.portada}
                          alt=""
                          className="mt-2 h-20 w-full rounded-xl object-cover"
                          onError={(ev) => { ev.target.style.display = 'none'; }}
                        />
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                          <Clock size={10} /> {fecha(e.fechaInicio)}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-xs capitalize text-muted">
                          <Icon size={10} /> {t(`dashboard.eventos_v.tipo.${e.tipo}`)}
                        </span>
                        {e.asistentes > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">
                            <Users size={10} /> {e.asistentes}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarEvento(e._id)}
                      className="shrink-0 rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Eventos pasados */}
      {pasados.length > 0 && (
        <div className={card}>
          <h3 className="mb-3 font-bold text-muted">{t('dashboard.eventos_v.past')}</h3>
          <div className="space-y-2">
            {pasados.slice(0, 5).map((e) => (
              <div key={e._id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted">{e.titulo}</p>
                  <p className="text-xs text-muted/60">{fecha(e.fechaInicio)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => eliminarEvento(e._id)}
                  className="shrink-0 text-muted transition-colors hover:text-danger"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crear evento */}
      <div data-help="eventos-crear" className={card}>
        <h3 className="mb-4 font-bold text-fg">{t('dashboard.eventos_v.createTitle')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.eventos_v.title')}</span>
            <input
              value={titulo}
              onChange={(e) => { setEstado(''); setTitulo(e.target.value); }}
              className={input}
              maxLength={100}
              placeholder={t('dashboard.eventos_v.titlePh')}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.eventos_v.desc')}</span>
            <textarea
              value={descripcion}
              onChange={(e) => { setEstado(''); setDescripcion(e.target.value); }}
              rows={2}
              className={`${input} resize-none`}
              maxLength={500}
              placeholder={t('dashboard.eventos_v.descPh')}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.eventos_v.channel')}</span>
            <select value={canalId} onChange={(e) => { setEstado(''); setCanalId(e.target.value); }} className={input}>
              <option value="">{t('dashboard.eventos_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.eventos_v.startAt')}</span>
            <input
              type="datetime-local"
              value={fechaInicio}
              min={minLocal()}
              onChange={(e) => { setEstado(''); setFechaInicio(e.target.value); }}
              className={input}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.eventos_v.type')}</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={input}>
              <option value="voz">{t('dashboard.eventos_v.tipo.voz')}</option>
              <option value="escenario">{t('dashboard.eventos_v.tipo.escenario')}</option>
              <option value="externo">{t('dashboard.eventos_v.tipo.externo')}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.eventos_v.reminder')}</span>
            <select value={recordatorio} onChange={(e) => setRecordatorio(e.target.value)} className={input}>
              <option value="0">{t('dashboard.eventos_v.reminderNo')}</option>
              <option value="15">15 {t('dashboard.eventos_v.min')}</option>
              <option value="30">30 {t('dashboard.eventos_v.min')}</option>
              <option value="60">1 {t('dashboard.eventos_v.hora')}</option>
              <option value="1440">1 {t('dashboard.eventos_v.dia')}</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.eventos_v.coverUrl')}</span>
            <input
              value={portada}
              onChange={(e) => setPortada(e.target.value)}
              className={input}
              placeholder="https://..."
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={crear}
            disabled={estado === 'creando' || !titulo || !canalId || !fechaInicio}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarDays size={16} />
            {estado === 'creando' ? t('dashboard.eventos_v.creating') : t('dashboard.eventos_v.create')}
          </button>
          {estado === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.eventos_v.createOk')}</span>}
          {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
        </div>
      </div>
    </div>
  );
}
