// Editor del mensaje con botón que el bot deja fijo en un canal («Preséntate»,
// «Nueva sugerencia»…), 1.9.14. Todo se cambia: texto de encima, embed (con
// imágenes/GIF, campos…) y el botón (texto y color), con la vista previa de Discord.
// Empieza con lo de fábrica que manda el bot en su idioma (`tipo` →
// GET /api/config/:g/paneles/:tipo/defecto; utils/panelMensaje.js + utils/comunidad.js).
// El padre guarda `valor` ({ contenido, embed, textoBoton, estiloBoton }) con el resto
// de la sección; el bot reedita el mensaje ya publicado cuando cambia.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Paintbrush, RotateCcw, Check, ExternalLink, Info, AlertTriangle } from 'lucide-react';
import EmbedBuilder from './views/EmbedBuilder';
import { EMBED_VACIO } from './views/embedDefaults';
import EditorBoton from './EditorBoton';
import TextareaCanales from './TextareaCanales';
import AvisoIdiomaBot from './AvisoIdiomaBot';
import { PANEL_VACIO } from '../../lib/panelMensaje';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

export default function EditorMensajePanel({ dash, tipo, valor, onCambio, publicado = null, pendiente = false, ayuda }) {
  const { t } = useTranslation();
  const { canales = [], subirImagen, presetsAnuncio, guardarPresetAnuncio, cargarPanelDefecto, configServidor, guildId } = dash;

  // Lo de fábrica, en el idioma del bot (cambia si cambia el idioma o el color del servidor).
  const idiomaBot = configServidor?.idioma;
  const colorServidor = configServidor?.colorEmbed;
  const [defecto, setDefecto] = useState(null);
  const [cargado, setCargado] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(cargarPanelDefecto?.(tipo)).then((d) => { if (vivo) { setDefecto(d || null); setCargado(true); } });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, tipo, idiomaBot, colorServidor]);

  const v = valor || PANEL_VACIO;
  const estilo = v.estiloBoton || defecto?.estiloBoton || 'azul';
  const textoBoton = v.textoBoton.trim() || defecto?.textoBoton || '';
  const enlace = publicado?.canalId && publicado?.mensajeId && guildId
    ? `https://discord.com/channels/${guildId}/${publicado.canalId}/${publicado.mensajeId}` : null;
  const nombreCanal = publicado?.canalId ? canales.find((c) => c.id === publicado.canalId)?.nombre : '';
  const esDeFabrica = !v.contenido && !v.embed && !v.textoBoton && !v.estiloBoton;

  return (
    <div className={card} data-help={`panelmsg-${tipo}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-fg"><Paintbrush size={18} className="text-brand" /> {t('dashboard.panelMsg.titulo')}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{ayuda || t('dashboard.panelMsg.desc')}</p>
        </div>
        <button type="button" onClick={() => onCambio({ ...PANEL_VACIO })} disabled={esDeFabrica}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:text-fg disabled:opacity-40">
          <RotateCcw size={13} /> {t('dashboard.panelMsg.restaurar')}
        </button>
      </div>

      <AvisoIdiomaBot key={guildId} dash={dash} className="mt-4" />

      {/* Dónde está: el bot lo actualiza solo al guardar (si Discord no le deja, lo dice y reintenta al guardar) */}
      {pendiente ? (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-xs font-semibold text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t('dashboard.panelMsg.pendiente')}
        </p>
      ) : enlace ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm">
          <Check size={16} className="shrink-0 text-success" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-fg">{nombreCanal ? t('dashboard.panelMsg.publicado', { canal: nombreCanal }) : t('dashboard.panelMsg.publicadoSinNombre')}</span>
            <span className="block text-xs text-muted">{t('dashboard.panelMsg.seActualiza')}</span>
          </span>
          <a href={enlace} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-brand hover:underline">
            {t('dashboard.panelMsg.verEnDiscord')} <ExternalLink size={12} />
          </a>
        </div>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-elevated px-3.5 py-2.5 text-xs text-muted">
          <Info size={14} className="mt-0.5 shrink-0 text-brand" /> {t('dashboard.panelMsg.sinPublicar')}
        </p>
      )}

      {!cargado ? (
        <p className="mt-4 text-sm text-muted">{t('dashboard.panelMsg.cargando')}</p>
      ) : (
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.panelMsg.texto')}</span>
            <TextareaCanales canales={canales} value={v.contenido} onChange={(ev) => onCambio({ contenido: ev.target.value })} onValor={(val) => onCambio({ contenido: val })}
              rows={2} maxLength={2000} placeholder={t('dashboard.panelMsg.textoPh')}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none" />
          </label>
          {/* Sin embed propio, se edita a partir del de fábrica: al tocarlo, pasa a ser el suyo. */}
          <EmbedBuilder value={v.embed || defecto?.embed || EMBED_VACIO} onChange={(emb) => onCambio({ embed: emb })} subirImagen={subirImagen}
            presets={presetsAnuncio} onGuardarPreset={guardarPresetAnuncio ? (p) => guardarPresetAnuncio({ ...p, contenido: '' }) : undefined}
            canales={canales} texto={v.contenido} botones={textoBoton ? [{ texto: textoBoton, estilo }] : []} />
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-sm font-semibold text-fg">{t('dashboard.panelMsg.boton')}</p>
            <EditorBoton texto={v.textoBoton} estilo={estilo} onTexto={(val) => onCambio({ textoBoton: val })} onEstilo={(val) => onCambio({ estiloBoton: val })} placeholder={defecto?.textoBoton || ''} />
          </div>
        </div>
      )}
    </div>
  );
}
