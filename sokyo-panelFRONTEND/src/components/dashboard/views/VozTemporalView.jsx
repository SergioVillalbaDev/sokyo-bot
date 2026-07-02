// Vista de Canales de Voz Temporales (Join-to-Create) — panel admin.
// Configura generadores, el panel de control, qué botones se ofrecen y permite
// ver/cerrar las salas activas en vivo.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic2, Save, Check, Plus, Trash2, RefreshCw, Send, Lock, Eye, Users, X, Crown, Sparkles,
} from 'lucide-react';
import { Card, Toggle } from '../../ui/primitives';

const inputCls = 'rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand/50';
const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

// Etiquetas de cada control del panel para los toggles.
const CONTROLES = [
  ['renombrar', 'Renombrar', '✏️'],
  ['limite', 'Límite de usuarios', '👥'],
  ['bloquear', 'Bloquear / Abrir', '🔒'],
  ['ocultar', 'Ocultar / Mostrar', '👁️'],
  ['bitrate', 'Calidad (bitrate)', '🎚️'],
  ['invitar', 'Invitar a alguien', '➕'],
  ['expulsar', 'Expulsar y vetar', '🚫'],
  ['reclamar', 'Reclamar el canal', '👑'],
  ['transferir', 'Transferir el canal', '🔄'],
  ['eliminar', 'Eliminar el canal', '🗑️'],
];

function Ajuste({ titulo, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-line/60 last:border-0">
      <div className="min-w-0">
        <div className="font-semibold text-fg">{titulo}</div>
        {desc && <div className="text-sm text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Banner({ msg }) {
  if (!msg) return null;
  const ok = msg.tipo === 'ok';
  return (
    <div className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
      {msg.texto}
    </div>
  );
}

const GEN_DEF = { canalId: '', nombre: '🔊 {user}', categoriaId: '', limite: 0, bitrate: 64, bloqueadoPorDefecto: false, ocultoPorDefecto: false };
const MAX_GENERADORES = 3; // tope global de canales generadores por servidor

// Plantillas de generador (función Pro): rellenan los ajustes de un generador nuevo.
const PLANTILLAS = [
  { id: 'gaming', label: '🎮 Gaming', nombre: '🎮 {user}’s room', limite: 5, bitrate: 96 },
  { id: 'estudio', label: '📚 Estudio', nombre: '📚 {user} studying', limite: 4, bitrate: 64 },
  { id: 'musica', label: '🎵 Música', nombre: '🎵 {user}', limite: 0, bitrate: 128 },
  { id: 'privada', label: '🔒 Privada', nombre: '🔒 {user}’s room', limite: 2, bitrate: 64, bloqueadoPorDefecto: true, ocultoPorDefecto: true },
  { id: 'chill', label: '🛋️ Chill', nombre: '🛋️ {user}', limite: 0, bitrate: 64 },
];

// Etiqueta "Pro" reutilizable.
function ProTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-brand px-2 py-0.5 text-[11px] font-bold text-on-brand">
      <Crown size={11} /> Pro
    </span>
  );
}

export default function VozTemporalView({ dash }) {
  const { t } = useTranslation();
  const {
    configServidor, canales, canalesVoz, categorias, vozActivos, esPremium,
    guardarVozTemporal, publicarPanelVoz, cerrarSalaVoz, cargarVozActivos, subirImagen,
  } = dash;

  const [f, setF] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [msg, setMsg] = useState(null);
  const [publicando, setPublicando] = useState(false);
  const [pubMsg, setPubMsg] = useState(null);   // resultado de publicar, junto al botón
  const [subiendoImg, setSubiendoImg] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const v = configServidor?.vozTemporal || {};
    const c = v.controles || {};
    setF({
      activo: v.activo ?? false,
      generadores: Array.isArray(v.generadores) ? v.generadores.map((g) => ({ ...GEN_DEF, ...g, categoriaId: g.categoriaId || '' })) : [],
      panelCanalId: v.panelCanalId || '',
      panelTitulo: v.panelTitulo || '🔊 Tu canal de voz',
      panelDescripcion: v.panelDescripcion || 'Entra al canal generador para crear tu sala. Luego usa estos botones para gestionarla.',
      panelColor: v.panelColor || '#5865F2',
      panelImagen: v.panelImagen || '',
      panelBloquearCanal: v.panelBloquearCanal ?? false,
      controles: Object.fromEntries(CONTROLES.map(([k]) => [k, c[k] !== false])),
      maxPorUsuario: v.maxPorUsuario ?? 1,
    });
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!f) return null;

  const set = (campo, valor) => { setGuardado(false); setF((s) => ({ ...s, [campo]: valor })); };
  const setCtrl = (k, v) => { setGuardado(false); setF((s) => ({ ...s, controles: { ...s.controles, [k]: v } })); };
  const setGen = (i, campo, valor) => {
    setGuardado(false);
    setF((s) => ({ ...s, generadores: s.generadores.map((g, idx) => (idx === i ? { ...g, [campo]: valor } : g)) }));
  };
  const addGen = () => {
    setGuardado(false);
    setF((s) => (s.generadores.length >= MAX_GENERADORES ? s : { ...s, generadores: [...s.generadores, { ...GEN_DEF }] }));
  };
  const addGenPlantilla = (id) => {
    const p = PLANTILLAS.find((x) => x.id === id);
    if (!p) return;
    const { nombre, limite, bitrate, bloqueadoPorDefecto, ocultoPorDefecto } = p;
    const campos = { nombre, limite, bitrate, bloqueadoPorDefecto: !!bloqueadoPorDefecto, ocultoPorDefecto: !!ocultoPorDefecto };
    setGuardado(false);
    setF((s) => (s.generadores.length >= MAX_GENERADORES ? s : { ...s, generadores: [...s.generadores, { ...GEN_DEF, ...campos }] }));
  };
  const delGen = (i) => { setGuardado(false); setF((s) => ({ ...s, generadores: s.generadores.filter((_, idx) => idx !== i) })); };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarVozTemporal(f);
    setGuardando(false);
    setGuardado(ok);
    setMsg(ok ? { tipo: 'ok', texto: t('dashboard.voztemporal_v.msgSaved') } : { tipo: 'err', texto: t('dashboard.voztemporal_v.msgSaveError') });
    setTimeout(() => setMsg(null), 3000);
  };

  // Sube un archivo (imagen/GIF) a /uploads y guarda la ruta en panelImagen.
  const onSubirImagen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubiendoImg(true);
    setMsg(null);
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const r = await subirImagen(dataUrl);
      if (r?.url) { set('panelImagen', r.url); setMsg({ tipo: 'ok', texto: t('dashboard.voztemporal_v.msgImgUploaded') }); }
      else setMsg({ tipo: 'err', texto: r?.error || t('dashboard.voztemporal_v.msgImgError') });
    } catch { setMsg({ tipo: 'err', texto: t('dashboard.voztemporal_v.msgReadError') }); }
    setSubiendoImg(false);
    setTimeout(() => setMsg(null), 4000);
  };

  const publicar = async () => {
    if (!f.panelCanalId) { setPubMsg({ tipo: 'err', texto: t('dashboard.voztemporal_v.pickTextFirst') }); return; }
    setPublicando(true);
    setPubMsg({ tipo: 'ok', texto: t('dashboard.voztemporal_v.savingPublishing') });
    // Guardamos primero para que el servidor tenga el canal/título actualizados.
    const okGuardado = await guardarVozTemporal(f);
    if (!okGuardado) {
      setPublicando(false);
      setPubMsg({ tipo: 'err', texto: t('dashboard.voztemporal_v.saveConfigError') });
      return;
    }
    setGuardado(true);
    const r = await publicarPanelVoz();
    setPublicando(false);
    setPubMsg(r?.success
      ? { tipo: 'ok', texto: t('dashboard.voztemporal_v.panelPublished') }
      : { tipo: 'err', texto: r?.error || t('dashboard.voztemporal_v.publishError') });
  };

  return (
    <div className="space-y-5">
      <Banner msg={msg} />

      {/* Interruptor general */}
      <Card data-help="voztemporal-general" className={card}>
        <Ajuste
          titulo={t('dashboard.voztemporal_v.enableTitle')}
          desc={t('dashboard.voztemporal_v.enableDesc')}
        >
          <Toggle checked={f.activo} onChange={(v) => set('activo', v)} />
        </Ajuste>
        <Ajuste titulo={t('dashboard.voztemporal_v.maxRooms')} desc={t('dashboard.voztemporal_v.maxRoomsDesc')}>
          <input type="number" min="1" max="10" value={f.maxPorUsuario}
            onChange={(e) => set('maxPorUsuario', Number(e.target.value))}
            className={`w-24 ${inputCls}`} />
        </Ajuste>
      </Card>

      {/* Preferencias por usuario (Pro): automático, sin configuración. */}
      <Card className={`${card} ${esPremium ? 'border-brand/40' : ''}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-on-brand"><Crown size={18} /></span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-bold text-fg">{t('dashboard.voztemporal_v.userPrefs')} <ProTag /></div>
            <p className="text-sm text-muted">
              {esPremium ? t('dashboard.voztemporal_v.userPrefsOn') : t('dashboard.voztemporal_v.userPrefsOff')}
            </p>
          </div>
        </div>
      </Card>

      {/* Generadores */}
      <Card data-help="voztemporal-generadores" className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-fg">
            <Mic2 size={18} /> {t('dashboard.voztemporal_v.generators')}
            <span className="text-xs font-normal text-muted">({f.generadores.length}/{MAX_GENERADORES})</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Plantillas (Pro): crean un generador con ajustes predefinidos. */}
            <div className="flex items-center gap-1.5">
              <select defaultValue="" disabled={!esPremium || f.generadores.length >= MAX_GENERADORES}
                onChange={(e) => { if (e.target.value) { addGenPlantilla(e.target.value); e.target.value = ''; } }}
                title={esPremium ? t('dashboard.voztemporal_v.addFromTemplate') : t('dashboard.voztemporal_v.templatesPro')}
                className={`rounded-xl border border-line bg-bg px-3 py-1.5 text-sm text-fg disabled:opacity-50 ${inputCls}`}>
                <option value="">{esPremium ? t('dashboard.voztemporal_v.fromTemplate') : t('dashboard.voztemporal_v.templatesProOpt')}</option>
                {esPremium && PLANTILLAS.map((p) => <option key={p.id} value={p.id}>{t(`dashboard.voztemporal_v.templates.${p.id}`)}</option>)}
              </select>
              {!esPremium && <ProTag />}
            </div>
            <button onClick={addGen} disabled={f.generadores.length >= MAX_GENERADORES}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-sm font-semibold text-fg hover:bg-elevated disabled:opacity-40">
              <Plus size={15} /> {t('dashboard.voztemporal_v.add')}
            </button>
          </div>
        </div>

        {f.generadores.length >= MAX_GENERADORES && (
          <p className="mb-2 text-xs text-muted">{t('dashboard.voztemporal_v.maxReached', { max: MAX_GENERADORES })}</p>
        )}

        {f.generadores.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">{t('dashboard.voztemporal_v.noGenerators')}</p>
        )}

        <div className="space-y-4">
          {f.generadores.map((g, i) => (
            <div key={i} className="rounded-2xl border border-line bg-bg/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted">{t('dashboard.voztemporal_v.generator', { n: i + 1 })}</span>
                <button onClick={() => delGen(i)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">{t('dashboard.voztemporal_v.voiceChannelIn')}</span>
                  <select value={g.canalId} onChange={(e) => setGen(i, 'canalId', e.target.value)} className={inputCls}>
                    <option value="">{t('dashboard.voztemporal_v.pickVoice')}</option>
                    {canalesVoz.map((c) => <option key={c.id} value={c.id}>🔊 {c.nombre}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">{t('dashboard.voztemporal_v.categoryCreate')}</span>
                  <select value={g.categoriaId} onChange={(e) => setGen(i, 'categoriaId', e.target.value)} className={inputCls}>
                    <option value="">{t('dashboard.voztemporal_v.sameAsGen')}</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-muted">{t('dashboard.voztemporal_v.roomName')}</span>
                  <input value={g.nombre} onChange={(e) => setGen(i, 'nombre', e.target.value)} className={inputCls} maxLength={100} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">{t('dashboard.voztemporal_v.userLimit')}</span>
                  <input type="number" min="0" max="99" value={g.limite} onChange={(e) => setGen(i, 'limite', Number(e.target.value))} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">{t('dashboard.voztemporal_v.quality')}</span>
                  <input type="number" min="8" max="384" value={g.bitrate} onChange={(e) => setGen(i, 'bitrate', Number(e.target.value))} className={inputCls} />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm text-fg">
                  <Toggle checked={g.bloqueadoPorDefecto} onChange={(v) => setGen(i, 'bloqueadoPorDefecto', v)} />
                  <span className="flex items-center gap-1"><Lock size={14} /> {t('dashboard.voztemporal_v.bornLocked')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-fg">
                  <Toggle checked={g.ocultoPorDefecto} onChange={(v) => setGen(i, 'ocultoPorDefecto', v)} />
                  <span className="flex items-center gap-1"><Eye size={14} /> {t('dashboard.voztemporal_v.bornHidden')}</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Panel de control */}
      <Card data-help="voztemporal-panel" className={card}>
        <div className="mb-3 font-bold text-fg">{t('dashboard.voztemporal_v.controlPanel')}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{t('dashboard.voztemporal_v.panelTextChannel')}</span>
            <select value={f.panelCanalId} onChange={(e) => set('panelCanalId', e.target.value)} className={inputCls}>
              <option value="">{t('dashboard.voztemporal_v.pickText')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
            </select>
          </label>
        </div>

        {/* Personalización del panel (Pro): título, descripción y color propios. */}
        <div className="mt-4 rounded-2xl border border-line bg-bg/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
            <Sparkles size={15} /> {t('dashboard.voztemporal_v.panelCustom')} <ProTag />
          </div>
          {!esPremium && (
            <p className="mb-3 text-xs text-muted">{t('dashboard.voztemporal_v.panelCustomFree')}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{t('dashboard.voztemporal_v.panelTitle')}</span>
              <input value={f.panelTitulo} onChange={(e) => set('panelTitulo', e.target.value)} disabled={!esPremium} className={`${inputCls} disabled:opacity-50`} maxLength={100} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{t('dashboard.voztemporal_v.panelColor')}</span>
              <input type="color" value={f.panelColor} onChange={(e) => set('panelColor', e.target.value)} disabled={!esPremium} className={`h-10 w-full cursor-pointer rounded-xl border border-line bg-bg disabled:opacity-50`} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-muted">{t('dashboard.voztemporal_v.panelDesc')}</span>
              <textarea value={f.panelDescripcion} onChange={(e) => set('panelDescripcion', e.target.value)} disabled={!esPremium} rows={2} className={`${inputCls} disabled:opacity-50`} maxLength={500} />
            </label>

            {/* Imagen / GIF del panel */}
            <div className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-muted">{t('dashboard.voztemporal_v.panelImage')}</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={f.panelImagen}
                  onChange={(e) => set('panelImagen', e.target.value)}
                  disabled={!esPremium}
                  placeholder={t('dashboard.voztemporal_v.panelImagePh')}
                  className={`min-w-0 flex-1 ${inputCls} disabled:opacity-50`}
                  maxLength={500}
                />
                <label className={`flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2 text-sm font-semibold text-fg hover:bg-elevated ${!esPremium || subiendoImg ? 'pointer-events-none opacity-50' : ''}`}>
                  {subiendoImg ? t('dashboard.voztemporal_v.uploading') : t('dashboard.voztemporal_v.upload')}
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={onSubirImagen} disabled={!esPremium || subiendoImg} />
                </label>
                {f.panelImagen && esPremium && (
                  <button type="button" onClick={() => set('panelImagen', '')}
                    className="flex items-center gap-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
                    <X size={14} /> {t('dashboard.voztemporal_v.remove')}
                  </button>
                )}
              </div>
              {f.panelImagen && (
                <img src={f.panelImagen} alt="preview"
                  className="mt-2 max-h-40 w-auto rounded-xl border border-line object-contain"
                  onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
              )}
            </div>
          </div>
        </div>
        <Ajuste
          titulo={t('dashboard.voztemporal_v.lockPanelChannel')}
          desc={t('dashboard.voztemporal_v.lockPanelChannelDesc')}
        >
          <Toggle checked={f.panelBloquearCanal} onChange={(v) => set('panelBloquearCanal', v)} />
        </Ajuste>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={publicar} disabled={publicando || !f.panelCanalId}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
            <Send size={16} /> {publicando ? t('dashboard.voztemporal_v.publishing') : t('dashboard.voztemporal_v.publishPanel')}
          </button>
          <span className="text-xs text-muted">{t('dashboard.voztemporal_v.publishHint')}</span>
          {pubMsg && (
            <span className={`text-sm font-semibold ${pubMsg.tipo === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {pubMsg.texto}
            </span>
          )}
        </div>
      </Card>

      {/* Controles disponibles */}
      <Card data-help="voztemporal-controles" className={card}>
        <div className="mb-1 font-bold text-fg">{t('dashboard.voztemporal_v.panelButtons')}</div>
        <p className="mb-2 text-sm text-muted">{t('dashboard.voztemporal_v.panelButtonsDesc')}</p>
        {CONTROLES.map(([k, , emoji]) => (
          <Ajuste key={k} titulo={`${emoji} ${t(`dashboard.voztemporal_v.controls.${k}`)}`}>
            <Toggle checked={f.controles[k]} onChange={(v) => setCtrl(k, v)} />
          </Ajuste>
        ))}
      </Card>

      {/* Guardar */}
      <div className="flex justify-end">
        <button onClick={guardar} disabled={guardando}
          className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {guardado ? <Check size={16} /> : <Save size={16} />}
          {guardando ? t('dashboard.voztemporal_v.saving') : guardado ? t('dashboard.voztemporal_v.saved') : t('dashboard.voztemporal_v.saveChanges')}
        </button>
      </div>

      {/* Salas activas en vivo */}
      <Card data-help="voztemporal-activas" className={card}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-fg"><Users size={18} /> {t('dashboard.voztemporal_v.activeRooms')}</div>
          <button onClick={cargarVozActivos} className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-sm text-fg hover:bg-elevated">
            <RefreshCw size={14} /> {t('dashboard.voztemporal_v.refresh')}
          </button>
        </div>
        {(!vozActivos || vozActivos.length === 0) ? (
          <p className="py-4 text-center text-sm text-muted">{t('dashboard.voztemporal_v.noActiveRooms')}</p>
        ) : (
          <div className="space-y-2">
            {vozActivos.map((s) => (
              <div key={s.canalId} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-fg">🔊 {s.nombre}</div>
                  <div className="text-xs text-muted">
                    {t('dashboard.voztemporal_v.owner')}: {s.dueno?.nombre || '—'} · {s.miembros} {t('dashboard.voztemporal_v.connected')}
                    {s.bloqueado ? ' · 🔒' : ''}{s.oculto ? ' · 👁️' : ''}
                  </div>
                </div>
                <button onClick={() => cerrarSalaVoz(s.canalId)}
                  className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10">
                  <X size={14} /> {t('dashboard.voztemporal_v.close')}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
