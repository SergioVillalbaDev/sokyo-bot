// Tu comunidad · «Mi cuenta» de los miembros — cómo encuentra cada miembro su
// web (tickets, tienda, música y tarjeta) y el mensaje fijo con el botón
// «Abrir mi cuenta» para un canal. Lógica del bot en utils/cuenta.js.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CircleUserRound, MousePointerClick, KeyRound, PartyPopper, Send, Loader2, Check, ExternalLink, Copy,
  SquareSlash, AtSign, Ticket, Globe, AlertTriangle, Eye,
} from 'lucide-react';
import { tarjeta, Campo, SelectCanal } from './crecimientoShared';

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
  const { configServidor, canales = [], guildId, publicarPanelCuenta } = dash;
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
    const r = await publicarPanelCuenta(canalId);
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

        {/* Vista previa del mensaje en Discord */}
        <div className={tarjeta}>
          <h3 className="font-bold text-fg">{t('dashboard.micuenta_v.previewTitle')}</h3>
          <VistaPrevia />
        </div>
      </div>

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

// Maqueta del mensaje tal y como lo pinta Discord (colores de Discord, no del tema).
function VistaPrevia() {
  const { t } = useTranslation();
  const p = (k) => t(`dashboard.micuenta_v.preview.${k}`);
  const boton = 'inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[13px] font-medium text-white';
  return (
    <div className="mt-4 rounded-2xl bg-[#313338] p-4 text-[#dbdee1]" aria-label={t('dashboard.micuenta_v.previewTitle')}>
      <div className="flex gap-3">
        <img src="/assets/logo-96.webp" alt="" width="40" height="40" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[15px] font-medium text-white">
            Sokyo <span className="rounded-[3px] bg-[#5865f2] px-1 text-[10px] font-semibold leading-4 text-white">{p('app')}</span>
          </p>
          <div className="mt-1 rounded-[4px] border-l-4 border-[#a855f7] bg-[#2b2d31] p-3">
            <p className="text-[15px] font-semibold text-white">{p('title')}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed">{p('desc')}</p>
            <p className="mt-2 text-[13px] font-semibold text-white">{p('how')}</p>
            <p className="text-[13px] leading-relaxed">{p('steps')}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`${boton} bg-[#248046]`}>✨ {p('open')}</span>
            <span className={`${boton} bg-[#4e5058]`}>🌐 {p('web')} <ExternalLink size={12} /></span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {['tickets', 'shop', 'music', 'card'].map((k, i) => (
              <span key={k} className={`${boton} bg-[#4e5058]`}>{['🎫', '🛒', '🎵', '🎨'][i]} {p(k)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
