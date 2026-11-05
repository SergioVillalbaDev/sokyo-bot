// Tu comunidad · «Mi cuenta» de los miembros — cómo encuentra cada miembro su
// web (tickets, tienda, música y tarjeta) y el mensaje fijo con el botón
// «Abrir mi cuenta» para un canal. Lógica del bot en utils/cuenta.js.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CircleUserRound, MousePointerClick, KeyRound, PartyPopper, Send, Loader2, Check, ExternalLink, Copy,
  SquareSlash, AtSign, Ticket, Globe, AlertTriangle, Eye, Paintbrush, RotateCcw,
} from 'lucide-react';
import { tarjeta, Campo, SelectCanal } from './crecimientoShared';
import EmbedBuilder from './EmbedBuilder';
import { EMBED_VACIO } from './embedDefaults';
import EditorBoton from '../EditorBoton';
import TextareaCanales from '../TextareaCanales';
import { Toggle } from '../../ui/primitives';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import { useDesdeServidor } from '../../../hooks/useDesdeServidor';
import EstadoAutoguardado from '../EstadoAutoguardado';

const ETIQUETAS_VACIAS = { tickets: '', tienda: '', musica: '', tarjeta: '' };
const SECCIONES = [['tickets', '🎫'], ['tienda', '🛒'], ['musica', '🎵'], ['tarjeta', '🎨']];
// El formulario del mensaje a partir de lo guardado (models/ServidorConfig.js: panelCuenta).
const formDesde = (pc = {}) => ({
  contenido: pc.contenido || '', embed: pc.embed || null, textoBoton: pc.textoBoton || '', estiloBoton: pc.estiloBoton || 'verde',
  botonWeb: pc.botonWeb !== false, secciones: pc.secciones !== false, etiquetas: { ...ETIQUETAS_VACIAS, ...(pc.etiquetas || {}) },
});

const PASOS = [
  { Icono: MousePointerClick, color: '#a855f7' },
  { Icono: KeyRound, color: '#ec4899' },
  { Icono: PartyPopper, color: '#22d3ee' },
];
const OTRAS = [
  { id: 'cmd', Icono: SquareSlash, color: '#60a5fa' },
  { id: 'mention', Icono: AtSign, color: '#f472b6' },
  { id: 'tickets', Icono: Ticket, color: '#fbbf24' },
  { id: 'web', Icono: Globe, color: '#34d399' },
];

export default function MiCuentaView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, canales = [], guildId, publicarPanelCuenta, subirImagen, presetsAnuncio, guardarPresetAnuncio, cargarMensajeCuentaDefecto, guardarMensajeCuenta } = dash;

  // Cómo es el mensaje (1.9.12): todo editable. Lo de fábrica viene del bot, en su idioma.
  const [defecto, setDefecto] = useState(null);
  useEffect(() => {
    let vivo = true;
    cargarMensajeCuentaDefecto?.().then((d) => { if (vivo) setDefecto(d); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);
  const [form, setForm] = useState(null);
  const [sinPublicar, setSinPublicar] = useState(false); // cambios guardados que aún no se ven en Discord
  useDesdeServidor(configServidor, () => { if (configServidor) setForm(formDesde(configServidor.panelCuenta || {})); });
  const cambiar = (parche) => { setForm((f) => ({ ...f, ...parche })); setSinPublicar(true); };
  const guardarForm = async () => (form ? guardarMensajeCuenta(form) : true);
  const autoguardado = useAutoguardado(form, guardarForm, { listo: !!form, borrador: 'micuenta-mensaje', restaurar: setForm });
  const restaurarFabrica = () => cambiar(formDesde({}));
  const et = (k) => form?.etiquetas?.[k]?.trim() || defecto?.etiquetas?.[k] || '';
  const botonesPrevia = form ? [
    { texto: `✨ ${form.textoBoton.trim() || defecto?.etiquetas?.abrir || 'Abrir mi cuenta'}`, estilo: form.estiloBoton },
    ...(form.botonWeb ? [{ texto: `🌐 ${window.location.host}/cuenta`, estilo: 'gris' }] : []),
    ...(form.secciones ? SECCIONES.map(([k, emoji]) => ({ texto: `${emoji} ${et(k)}`, estilo: 'gris' })) : []),
  ] : [];
  const publicado = configServidor?.panelCuenta?.mensajeId ? configServidor.panelCuenta : null;
  const nombreCanal = (id) => canales.find((c) => c.id === id)?.nombre || '';

  // Canal elegido: el que se escoja aquí o, si no, donde ya está publicado.
  const [elegido, setElegido] = useState('');
  const canalId = elegido || publicado?.canalId || '';
  const [estado, setEstado] = useState(null); // null | 'publicando' | { ok, texto }
  const [copiado, setCopiado] = useState(false);
  const web = `${window.location.origin}/cuenta`;

  const publicar = async () => {
    if (!canalId) { setEstado({ ok: false, texto: t('dashboard.micuenta_v.errChannel') }); return; }
    setEstado('publicando');
    // Primero se guarda cómo es (por si el autoguardado aún no lo ha hecho).
    if (form && !(await guardarForm())) { setEstado({ ok: false, texto: t('dashboard.micuenta_v.err') }); return; }
    const r = await publicarPanelCuenta(canalId);
    if (r.ok) setSinPublicar(false);
    const canal = nombreCanal(canalId);
    if (r.ok) setEstado({ ok: true, texto: t(r.actualizado ? 'dashboard.micuenta_v.okUpdated' : 'dashboard.micuenta_v.okNew', { canal }), url: r.url });
    else {
      const clave = { canal: 'errChannel', sin_permiso: 'errPerm', acceso: 'errAccess', red: 'errNet' }[r.codigo] || 'err';
      setEstado({ ok: false, texto: t(`dashboard.micuenta_v.${clave}`) });
    }
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(web); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ }
  };

  const pasos = t('dashboard.micuenta_v.steps', { returnObjects: true });
  const enlaceMensaje = publicado && guildId ? `https://discord.com/channels/${guildId}/${publicado.canalId}/${publicado.mensajeId}` : null;
  const mismoCanal = publicado && canalId === publicado.canalId;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.micuenta_v.intro')}</p>

      {/* Cómo entran: tres pasos */}
      <div className={`${tarjeta} sk-brillo`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold text-fg"><CircleUserRound size={18} className="text-brand" /> {t('dashboard.micuenta_v.howTitle')}</h3>
          <a href="/cuenta" target="_blank" rel="noreferrer" className="sk-foco flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-brand">
            <Eye size={13} /> {t('dashboard.micuenta_v.seeAsMember')}
          </a>
        </div>
        <ol className="mt-5 grid gap-3 md:grid-cols-3">
          {PASOS.map(({ Icono, color }, i) => (
            <li key={i} className="relative flex gap-3 rounded-2xl border border-line bg-bg/60 p-4">
              <span className="sk-orbe h-11 w-11" style={{ '--grupo': color }}><Icono size={19} /></span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{t('dashboard.micuenta_v.step', { n: i + 1 })}</p>
                <p className="mt-0.5 font-bold text-fg">{pasos[i]?.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{pasos[i]?.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
        {/* Publicar el mensaje fijo */}
        <div className={tarjeta}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><MousePointerClick size={18} className="text-brand" /> {t('dashboard.micuenta_v.publishTitle')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('dashboard.micuenta_v.publishDesc')}</p>

          {publicado && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm">
              <Check size={16} className="shrink-0 text-success" />
              <span className="min-w-0 flex-1 font-semibold text-fg">
                {nombreCanal(publicado.canalId) ? t('dashboard.micuenta_v.published', { canal: nombreCanal(publicado.canalId) }) : t('dashboard.micuenta_v.publishedUnknown')}
              </span>
              {enlaceMensaje && (
                <a href={enlaceMensaje} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-brand hover:underline">
                  {t('dashboard.micuenta_v.viewInDiscord')} <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}

          <div className="mt-4 space-y-4">
            <Campo etiqueta={t('dashboard.micuenta_v.channel')} ayuda={t('dashboard.micuenta_v.channelHint')}>
              <SelectCanal canales={canales} value={canalId} onChange={(v) => { setElegido(v); setEstado(null); }} />
            </Campo>
            <button
              onClick={publicar} disabled={estado === 'publicando'}
              className="sk-nav-activo sk-foco flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-opacity disabled:opacity-60 sm:w-auto"
            >
              {estado === 'publicando' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {estado === 'publicando' ? t('dashboard.micuenta_v.publishing') : t(mismoCanal ? 'dashboard.micuenta_v.update' : 'dashboard.micuenta_v.publish')}
            </button>
            {estado && estado !== 'publicando' && (
              <p role="status" className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${estado.ok ? 'border-success/30 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'}`}>
                {estado.ok ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
                <span className="min-w-0 flex-1">{estado.texto}</span>
                {estado.url && <a href={estado.url} target="_blank" rel="noreferrer" className="shrink-0 underline">{t('dashboard.micuenta_v.viewInDiscord')}</a>}
              </p>
            )}
            <p className="text-xs text-muted">{t('dashboard.micuenta_v.adminCmdPre')} <code className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-fg">/{t('dashboard.micuenta_v.adminCmd')}</code> {t('dashboard.micuenta_v.adminCmdPost')}</p>
          </div>
        </div>

        {/* Lo que dice el mensaje, en resumen */}
        <div className={tarjeta}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><Paintbrush size={18} className="text-brand" /> {t('dashboard.micuenta_v.customTitle')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('dashboard.micuenta_v.customDesc')}</p>
          {publicado && sinPublicar && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t('dashboard.micuenta_v.pendingUpdate')}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={restaurarFabrica} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:text-fg">
              <RotateCcw size={13} /> {t('dashboard.micuenta_v.resetMsg')}
            </button>
            <EstadoAutoguardado estado={autoguardado} />
          </div>
        </div>
      </div>

      {/* Editor del mensaje (texto, embed con imágenes/GIF y botones) con la vista previa de Discord */}
      {form && (
        <div className={tarjeta} data-help="micuenta-mensaje">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.micuenta_v.msgText')}</span>
              <TextareaCanales canales={canales} value={form.contenido} onChange={(ev) => cambiar({ contenido: ev.target.value })} onValor={(val) => cambiar({ contenido: val })}
                rows={2} maxLength={2000} placeholder={t('dashboard.micuenta_v.msgTextPh')}
                className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none" />
            </label>
            <EmbedBuilder value={form.embed || defecto?.embed || EMBED_VACIO} onChange={(emb) => cambiar({ embed: emb })} subirImagen={subirImagen}
              presets={presetsAnuncio} onGuardarPreset={(p) => guardarPresetAnuncio({ ...p, contenido: '' })} canales={canales} texto={form.contenido} botones={botonesPrevia} />
            <div className="grid gap-4 border-t border-line pt-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-fg">{t('dashboard.micuenta_v.mainButton')}</p>
                <EditorBoton texto={form.textoBoton} estilo={form.estiloBoton} onTexto={(val) => cambiar({ textoBoton: val })} onEstilo={(val) => cambiar({ estiloBoton: val })} placeholder={defecto?.etiquetas?.abrir || ''} />
              </div>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0"><span className="block text-sm font-semibold text-fg">{t('dashboard.micuenta_v.webButton')}</span><span className="block text-xs text-muted">{t('dashboard.micuenta_v.webButtonDesc')}</span></span>
                  <Toggle checked={form.botonWeb} onChange={(v) => cambiar({ botonWeb: v })} />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0"><span className="block text-sm font-semibold text-fg">{t('dashboard.micuenta_v.sectionButtons')}</span><span className="block text-xs text-muted">{t('dashboard.micuenta_v.sectionButtonsDesc')}</span></span>
                  <Toggle checked={form.secciones} onChange={(v) => cambiar({ secciones: v })} />
                </div>
                {form.secciones && (
                  <div className="grid grid-cols-2 gap-2">
                    {SECCIONES.map(([k, emoji]) => (
                      <label key={k} className="block">
                        <span className="mb-1 block text-xs font-semibold text-muted">{emoji} {defecto?.etiquetas?.[k] || k}</span>
                        <input value={form.etiquetas[k]} maxLength={80} onChange={(ev) => cambiar({ etiquetas: { ...form.etiquetas, [k]: ev.target.value } })}
                          placeholder={defecto?.etiquetas?.[k] || ''} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none" />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Otras formas de entrar, que ya funcionan sin configurar nada */}
      <div className={tarjeta}>
        <h3 className="font-bold text-fg">{t('dashboard.micuenta_v.otherTitle')}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {OTRAS.map(({ id, Icono, color }) => (
            <div key={id} className="flex flex-col gap-2 rounded-2xl border border-line bg-bg/60 p-4">
              <span className="sk-icono-grupo h-9 w-9" style={{ '--grupo': color }}><Icono size={17} /></span>
              <p className="font-mono text-sm font-bold text-fg">{t(`dashboard.micuenta_v.other.${id}.t`)}</p>
              <p className="text-xs leading-relaxed text-muted">{t(`dashboard.micuenta_v.other.${id}.d`)}</p>
              {id === 'web' && (
                <button onClick={copiar} className="sk-foco mt-auto flex items-center justify-between gap-2 rounded-xl border border-line bg-card px-3 py-2 text-left text-xs font-semibold text-fg transition-colors hover:border-brand">
                  <span className="truncate">{web.replace(/^https?:\/\//, '')}</span>
                  {copiado ? <Check size={14} className="shrink-0 text-success" /> : <Copy size={14} className="shrink-0 text-muted" />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
