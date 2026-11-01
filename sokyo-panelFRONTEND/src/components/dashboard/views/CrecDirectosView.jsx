// Crecimiento · Directos y vídeos — avisos cuando un canal de Twitch o Kick empieza
// directo, uno de YouTube publica, o hay algo nuevo en una comunidad de Reddit o en
// una web con RSS. Lógica del bot en utils/directos.js.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, Tv, Plus, Loader2, Send, Trash2, ExternalLink, AlertTriangle } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { getStaffSession } from '../../../lib/api';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, SelectRol, Aviso, BotonGuardar } from './crecimientoShared';
import { relativo } from './crecimientoUtils';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import VistaDiscord from '../VistaDiscord';

const COLOR = { twitch: '#9146FF', youtube: '#FF0000', kick: '#53FC18', reddit: '#FF4500', rss: '#F59E0B' };
const NOMBRE = { twitch: 'Twitch', youtube: 'YouTube', kick: 'Kick', reddit: 'Reddit', rss: 'RSS' };
const TIPOS = Object.keys(NOMBRE);
const EN_DIRECTO = new Set(['twitch', 'kick']); // los que tienen «en directo / desconectado»
const PLACEHOLDER = { twitch: 'placeholderTwitch', youtube: 'placeholderYoutube', kick: 'placeholderKick', reddit: 'placeholderReddit', rss: 'placeholderRss' };

// Cómo sale el aviso en Discord (utils/directos.js: anunciar): el mensaje, la ficha con el
// autor, el título y la plataforma, y el botón de enlace (gris, como todos los de enlace).
// La plataforma (y su color) es la de la primera fuente de ese tipo que haya añadido.
const TIPOS_AVISO = {
  directo: { defecto: 'twitch', entre: ['twitch', 'kick'], mensaje: 'defaultLive', titulo: 'sampleLiveTitle', boton: 'watchStream' },
  video: { defecto: 'youtube', entre: ['youtube'], mensaje: 'defaultVideo', titulo: 'sampleVideoTitle', boton: 'watchVideo' },
  post: { defecto: 'reddit', entre: ['reddit', 'rss'], mensaje: 'defaultPost', titulo: 'samplePostTitle', boton: 'readPost' },
};
function PreviaAviso({ t, tipo, plantilla, rol, fuentes = [] }) {
  const c = TIPOS_AVISO[tipo];
  const plataforma = (fuentes.find((f) => c.entre.includes(f.tipo)) || {}).tipo || c.defecto;
  const d = (k) => t(`dashboard.crec_v.directos.${k}`);
  return (
    <VistaDiscord className="mt-2" texto={`${rol ? `@${rol.nombre} ` : ''}${plantilla || d(c.mensaje)}`}
      variables={{ streamer: d('sampleStreamer'), title: d(c.titulo), url: 'https://…', platform: NOMBRE[plataforma] }}
      embed={{ titulo: d(c.titulo), color: COLOR[plataforma], pie: NOMBRE[plataforma], campos: tipo === 'directo' ? [{ nombre: d('livePlaying'), valor: 'Valorant', inline: true }] : [] }}
      botones={[{ texto: d(c.boton), estilo: 'gris' }]} />
  );
}

export default function CrecDirectosView({ dash }) {
  const { t, i18n } = useTranslation();
  const { canales, roles, cargarCrecimiento, guardarCrecimiento, anadirFuenteDirecto, eliminarFuenteDirecto, probarFuenteDirecto } = dash;

  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState('');
  const [aviso, setAviso] = useState('');
  const [tipo, setTipo] = useState('twitch');
  const [entrada, setEntrada] = useState('');
  const [anadiendo, setAnadiendo] = useState(false);
  const [errorAlta, setErrorAlta] = useState('');
  const [accion, setAccion] = useState({}); // id -> 'probando' | 'ok' | mensaje de error

  const cargar = useCallback(async () => {
    const r = await cargarCrecimiento('directos');
    if (r.error) { setDatos({ error: r.error }); return; }
    setDatos(r);
    setForm(r.config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setEstado('guardando'); setAviso('');
    const r = await guardarCrecimiento('directos', form);
    if (r.error) { setEstado(r.error); return false; }
    setEstado('ok');
    if (r.aviso) setAviso(r.aviso);
    // `form` no se pisa con la respuesta: tiene lo que se está escribiendo y las filas a
    // medias que aún no se guardan (ver hooks/useDesdeServidor.js).
    return true;
  };
  // Se guarda solo al dejar de tocar algo (hooks/useAutoguardado.js).
  const autoguardado = useAutoguardado(form, guardar, { listo: !!form, borrador: 'crec-directos', restaurar: setForm });

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.crec_v.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setEstado(''); setAviso(''); };

  const anadir = async () => {
    if (!entrada.trim()) return;
    setAnadiendo(true); setErrorAlta('');
    const r = await anadirFuenteDirecto(tipo, entrada.trim());
    setAnadiendo(false);
    if (r.error) { setErrorAlta(r.error); return; }
    setEntrada('');
    setDatos((d) => ({ ...d, fuentes: [...d.fuentes, r.fuente] }));
  };
  const quitar = async (f) => {
    if (!window.confirm(t('dashboard.crec_v.directos.confirmRemove', { n: f.nombre }))) return;
    const r = await eliminarFuenteDirecto(f.id);
    if (!r.error) setDatos((d) => ({ ...d, fuentes: d.fuentes.filter((x) => x.id !== f.id) }));
  };
  const probar = async (f) => {
    setAccion((a) => ({ ...a, [f.id]: 'probando' }));
    const r = await probarFuenteDirecto(f.id);
    setAccion((a) => ({ ...a, [f.id]: r.error ? r.error : 'ok' }));
  };

  const fuentes = datos.fuentes || [];
  const lleno = fuentes.length >= (datos.max || 10);
  const pestana = (v) => `flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${tipo === v ? 'bg-card text-fg shadow-soft' : 'text-muted hover:text-fg'}`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.crec_v.directos.intro')}</p>
      {form.activo && !form.canalId && <Aviso tipo="alerta">{t('dashboard.crec_v.directos.needChannel')}</Aviso>}

      <div data-help="directos-config" className={tarjeta}>
        <CabeceraTarjeta icono={Radio} titulo={t('dashboard.crec_v.directos.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.crec_v.directos.channel')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.directos.role')}>
            <SelectRol roles={roles} value={form.rolId} onChange={set('rolId')} vacio={t('dashboard.crec_v.noMention')} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.directos.message')} className="sm:col-span-2">
            <input maxLength={500} value={form.mensaje || ''} onChange={(e) => set('mensaje')(e.target.value)} className={campo} />
            <PreviaAviso t={t} tipo="directo" fuentes={datos.fuentes} plantilla={form.mensaje} rol={form.rolId && roles.find((x) => x.id === form.rolId)} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.directos.messageVideo')} className="sm:col-span-2">
            <input maxLength={500} value={form.mensajeVideo || ''} onChange={(e) => set('mensajeVideo')(e.target.value)} className={campo} />
            <PreviaAviso t={t} tipo="video" fuentes={datos.fuentes} plantilla={form.mensajeVideo} rol={form.rolId && roles.find((x) => x.id === form.rolId)} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.directos.messagePost')} ayuda={t('dashboard.crec_v.directos.messageHint')} className="sm:col-span-2">
            <input maxLength={500} value={form.mensajePost || ''} onChange={(e) => set('mensajePost')(e.target.value)} className={campo} />
            <PreviaAviso t={t} tipo="post" fuentes={datos.fuentes} plantilla={form.mensajePost} rol={form.rolId && roles.find((x) => x.id === form.rolId)} />
          </Campo>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg px-4 py-3 sm:col-span-2">
            <span className="text-sm font-semibold text-fg">{t('dashboard.crec_v.directos.shorts')}</span>
            <Toggle checked={!!form.incluirShorts} onChange={set('incluirShorts')} />
          </div>
        </div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
        {aviso && <div className="mt-3"><Aviso tipo="alerta">{aviso}</Aviso></div>}
      </div>

      <div data-help="directos-fuentes" className={tarjeta}>
        <CabeceraTarjeta icono={Tv} titulo={t('dashboard.crec_v.directos.sourcesTitle', { n: fuentes.length, max: datos.max || 10 })} />

        {!lleno && (
          <div className="mt-4 space-y-2">
            <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-bg p-1 sm:w-fit">
              {TIPOS.map((tp) => (
                <button key={tp} type="button" className={`${pestana(tp)} shrink-0 whitespace-nowrap`} onClick={() => { setTipo(tp); setErrorAlta(''); }}>{NOMBRE[tp]}</button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={entrada} onChange={(e) => setEntrada(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') anadir(); }}
                placeholder={t(`dashboard.crec_v.directos.${PLACEHOLDER[tipo]}`)}
                className={`${campo} sm:flex-1`} />
              <button type="button" onClick={anadir} disabled={anadiendo || !entrada.trim()}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50">
                {anadiendo ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {anadiendo ? t('dashboard.crec_v.directos.adding') : t('dashboard.crec_v.directos.add')}
              </button>
            </div>
            {tipo === 'rss' && <p className="text-xs text-muted">{t('dashboard.crec_v.directos.rssHint')}</p>}
            {errorAlta && <p className="flex items-center gap-1.5 text-sm font-semibold text-danger"><AlertTriangle size={14} /> {errorAlta}</p>}
          </div>
        )}

        {fuentes.length === 0 ? (
          <p className="mt-4 text-sm italic text-muted">{t('dashboard.crec_v.directos.sourcesEmpty')}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {fuentes.map((f) => {
              const a = accion[f.id];
              return (
                <li key={f.id} className="rounded-2xl border border-line bg-bg p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar src={f.avatar} name={f.nombre || '?'} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                        <span className="truncate">{f.nombre}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${f.tipo === 'kick' ? 'text-black' : 'text-white'}`} style={{ backgroundColor: COLOR[f.tipo] }}>{NOMBRE[f.tipo] || f.tipo}</span>
                        {EN_DIRECTO.has(f.tipo) && (
                          <span className={`text-xs font-semibold ${f.enDirecto ? 'text-danger' : 'text-muted'}`}>
                            {f.enDirecto ? `● ${t('dashboard.crec_v.directos.live')}` : t('dashboard.crec_v.directos.offline')}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {f.ultimoAviso ? t('dashboard.crec_v.directos.lastAlert', { fecha: relativo(f.ultimoAviso, i18n.language) }) : t('dashboard.crec_v.directos.neverAlerted')}
                        {f.pendientes > 0 ? ` · ${t('dashboard.crec_v.directos.scheduled', { n: f.pendientes })}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <a href={f.url} target="_blank" rel="noreferrer" className="rounded-xl border border-line p-2 text-muted transition-colors hover:text-fg" aria-label={f.nombre}><ExternalLink size={15} /></a>
                      <button type="button" onClick={() => probar(f)} disabled={a === 'probando'}
                        className="flex items-center gap-1.5 rounded-xl border border-line px-2.5 py-2 text-xs font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50">
                        {a === 'probando' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} <span className="hidden sm:inline">{t('dashboard.crec_v.directos.test')}</span>
                      </button>
                      <button type="button" onClick={() => quitar(f)} className="rounded-xl border border-line p-2 text-muted transition-colors hover:text-danger" aria-label={t('dashboard.crec_v.directos.remove')}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {a === 'ok' && <p className="mt-2 text-xs font-semibold text-success">{t('dashboard.crec_v.directos.testOk')}</p>}
                  {a && a !== 'ok' && a !== 'probando' && <p className="mt-2 text-xs font-semibold text-danger">{a}</p>}
                  {!a && f.ultimoError && <p className="mt-2 text-xs text-danger">{t('dashboard.crec_v.directos.error', { e: f.ultimoError })}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Las claves del .env solo las puede poner quien lleva el bot (OWNER_IDS). */}
      <Aviso>
        {getStaffSession()?.owner && (
          <>
            {datos.modoTwitch === 'api' ? t('dashboard.crec_v.directos.twitchApi') : t('dashboard.crec_v.directos.twitchBasic')}{' '}
            {datos.youtubeApi ? t('dashboard.crec_v.directos.ytApi') : t('dashboard.crec_v.directos.ytBasic')}{' '}
          </>
        )}
        {t('dashboard.crec_v.directos.frequency')}{' '}{t('dashboard.crec_v.directos.tiktokNote')}
      </Aviso>
    </div>
  );
}
