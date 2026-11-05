// Comunidad · Eventos — crea y gestiona eventos del servidor de Discord.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Trash2, Info, Clock, Users, MapPin, Radio, Mic, Pencil, X } from 'lucide-react';
import { FechaPicker, SubirImagen } from './comunidadShared.jsx';
import { OpcionCrear } from '../CrearAlVuelo';
import VistaDiscord from '../VistaDiscord';
import { API_URL } from '../../../lib/api';
import { useRelativo } from '../../../hooks/useModulo';
import { useBorrador } from '../../../hooks/useAutoguardado';
import EstadoAutoguardado from '../EstadoAutoguardado';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const TIPO_ICONO = { voz: Mic, escenario: Radio, externo: MapPin };
// El emoji del título del evento en Discord (utils/comunidad.js: construirEmbedEvento).
const EMOJI_TIPO = { voz: '🔊', escenario: '🎤', externo: '📍' };

export default function EventosView({ dash }) {
  const { t, i18n } = useTranslation();
  const relativo = useRelativo();
  const { canales, configServidor, eventos = [], crearEvento, eliminarEvento, subirImagen, editarCreado } = dash;
  const [editando, setEditando] = useState(null); // id del evento que se edita (1.9.12)

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [canalId, setCanalId] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [tipo, setTipo] = useState('voz');
  const [recordatorio, setRecordatorio] = useState('15');
  const [portada, setPortada] = useState('');
  const [estado, setEstado] = useState('');

  // Hora actual, refrescada cada minuto: un evento pasa solo a "pasados" al empezar.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const proximos = (eventos)
    .filter((e) => new Date(e.fechaInicio) > ahora)
    .sort((a, b) => new Date(a.fechaInicio) - new Date(b.fechaInicio));
  const pasados = eventos.filter((e) => new Date(e.fechaInicio) <= ahora);

  // Borrador: lo que se está escribiendo vuelve tras recargar (useBorrador).
  const borrador = useBorrador('eventos', { titulo, descripcion, canalId, fechaInicio, tipo, recordatorio, portada },
    !titulo.trim() && !descripcion.trim() && !portada,
    (v) => { setTitulo(v?.titulo || ''); setDescripcion(v?.descripcion || ''); setCanalId(v?.canalId || ''); setFechaInicio(v?.fechaInicio || ''); setTipo(v?.tipo || 'voz'); setRecordatorio(v?.recordatorio || '15'); setPortada(v?.portada || ''); });

  const vaciar = () => {
    setTitulo(''); setDescripcion(''); setCanalId(''); setFechaInicio('');
    setTipo('voz'); setRecordatorio('15'); setPortada(''); setEditando(null);
  };
  const crear = async () => {
    setEstado('creando');
    const datos = { titulo, descripcion, canalId, fechaInicio, tipo, recordatorio: Number(recordatorio), portada: portada || null };
    const r = editando ? await editarCreado('eventos', editando, datos) : await crearEvento(datos);
    setEstado(r?.error ? `error:${r.error}` : editando ? (r.enDiscord === false ? 'editado-sin-discord' : 'editado') : 'ok');
    if (!r?.error) vaciar();
  };
  // «Editar»: el evento vuelve al formulario (su mensaje de Discord se actualiza al guardar).
  const editar = (e) => {
    setEstado(''); setEditando(e._id);
    setTitulo(e.titulo || ''); setDescripcion(e.descripcion || ''); setCanalId(e.canalId); setFechaInicio(e.fechaInicio);
    setTipo(e.tipo || 'voz'); setRecordatorio(String(e.recordatorio ?? 15)); setPortada(e.portada || '');
    document.querySelector('[data-help="eventos-crear"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => editar(e)} className="rounded-xl border border-line px-2.5 py-2 text-muted transition-colors hover:text-brand" aria-label={t('dashboard.editar.edit')} title={t('dashboard.editar.edit')}><Pencil size={14} /></button>
                      <button
                        type="button"
                        onClick={() => { if (editando === e._id) vaciar(); eliminarEvento(e._id); }}
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
        <h3 className="mb-4 font-bold text-fg">{editando ? t('dashboard.editar.edit') : t('dashboard.eventos_v.createTitle')}</h3>
        {editando && <p className="mb-4 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-xs font-semibold text-fg">{t('dashboard.editar.editing', { n: titulo })} {t('dashboard.editar.channelLocked')}</p>}
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
            <select value={canalId} disabled={!!editando} onChange={(e) => { setEstado(''); setCanalId(e.target.value); }} className={`${input} disabled:opacity-60`}>
              <option value="">{t('dashboard.eventos_v.channelPh')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              <OpcionCrear tipo="canal" />
            </select>
          </label>
          <div className="block">
            <FechaPicker value={fechaInicio} onChange={(v) => { setEstado(''); setFechaInicio(v); }} titulo={t('dashboard.eventos_v.startAt')} />
          </div>
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
          <div className="block sm:col-span-2">
            <SubirImagen value={portada} onChange={setPortada} subirImagen={subirImagen} titulo={t('dashboard.eventos_v.coverUrl')} />
          </div>
        </div>

        {/* Cómo se publica en el canal (utils/comunidad.js: construirEmbedEvento y filaEvento) */}
        <div data-help="eventos-previa" className="mt-4">
          <p className="mb-1.5 text-sm font-semibold text-fg">{t('dashboard.eventos_v.prevTitle')}</p>
          <VistaDiscord
            embed={{
              titulo: `${EMOJI_TIPO[tipo] || '📅'} ${titulo || t('dashboard.eventos_v.prevTitleSample')}`,
              descripcion, color: configServidor?.colorEmbed || '#5865F2',
              campos: [{ nombre: t('dashboard.eventos_v.prevWhen'), valor: fechaInicio && !Number.isNaN(new Date(fechaInicio).getTime()) ? `${new Date(fechaInicio).toLocaleString(i18n.language, { dateStyle: 'full', timeStyle: 'short' })} (${relativo(fechaInicio)})` : '—' }],
              imagen: portada ? (portada.startsWith('/uploads/') ? `${API_URL}${portada}` : portada) : '',
            }}
            botones={[{ texto: `🔔 ${t('dashboard.eventos_v.prevRemind')}`, estilo: 'gris' }]} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={crear}
            disabled={estado === 'creando' || !titulo || !canalId || !fechaInicio}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarDays size={16} />
            {estado === 'creando' ? t('dashboard.eventos_v.creating') : editando ? t('dashboard.editar.save') : t('dashboard.eventos_v.create')}
          </button>
          {editando && (
            <button type="button" onClick={() => { vaciar(); setEstado(''); }} className="flex items-center gap-1.5 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-fg">
              <X size={15} /> {t('dashboard.editar.cancel')}
            </button>
          )}
          {estado === 'editado' && <span className="text-sm font-semibold text-success">{t('dashboard.editar.savedDiscord')}</span>}
          {estado === 'editado-sin-discord' && <span className="text-sm font-semibold text-warning">{t('dashboard.editar.notInDiscord')}</span>}
          {!estado && <EstadoAutoguardado estado={borrador} />}
          {estado === 'ok' && <span className="text-sm font-semibold text-success">{t('dashboard.eventos_v.createOk')}</span>}
          {estado.startsWith('error:') && <span className="text-sm font-semibold text-danger">{estado.slice(6)}</span>}
        </div>
      </div>
    </div>
  );
}
