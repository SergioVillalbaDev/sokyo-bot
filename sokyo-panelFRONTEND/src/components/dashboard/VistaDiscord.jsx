// Vista previa de un mensaje de Discord para cualquier sección del panel que mande
// uno: se ve como saldrá (avatar y nombre del bot, formato, menciones, embed y botones)
// mientras se escribe, para no tener que probarlo en Discord. Es la misma que ya tenían
// las bienvenidas (EmbedBuilder.jsx), con el formato de MarkdownDiscord.jsx.
//
//   <VistaDiscord texto={form.mensaje} variables={{ mention: '@Alex', level: 5 }} />
//
// - `texto`: el mensaje (con formato de Discord y {variables}); los {marcadores} se cambian
//   por `variables` (los que no estén ahí se dejan tal cual, para que se vea que no existen).
// - `embed`: { autor, titulo, descripcion, color, campos: [{ nombre, valor, inline }], pie, imagen }.
// - `botones`: [{ texto, estilo }] (verde, azul, gris o rojo; lib/estilosBoton.js).
// - `menu`: { placeholder } un desplegable de Discord (cerrado) debajo del mensaje.
// - `vacio`: lo que se enseña si no hay nada escrito.
import { useTranslation } from 'react-i18next';
import { Eye, ChevronDown } from 'lucide-react';
import MarkdownDiscord from './MarkdownDiscord';
import { fondoBoton } from '../../lib/estilosBoton';
import { rellenarEjemplo } from '../../lib/rellenarEjemplo';

// Avatar del bot y «Sokyo APP · Hoy» encima del mensaje (lo comparte la vista previa del
// constructor de embeds, views/EmbedBuilder.jsx).
export function CabeceraBot({ children }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3">
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full bg-black/30 object-cover" />
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-semibold text-white">Sokyo</span>
          <span className="rounded-[3px] bg-[#5865f2] px-1 text-[10px] font-semibold leading-4 text-white">APP</span>
          <span className="text-xs text-white/40">{t('dashboard.vistaDiscord.hoy')}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

// Los botones de debajo del mensaje: [{ texto, estilo }] (colores en lib/estilosBoton.js).
export function BotonesDiscord({ botones }) {
  if (!Array.isArray(botones) || botones.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {botones.map((b, i) => (
        <span key={i} className="inline-flex max-w-full items-center rounded-[4px] px-4 py-1.5 text-sm font-medium text-white" style={{ background: fondoBoton(b.estilo) }}>
          <span className="truncate">{b.texto}</span>
        </span>
      ))}
    </div>
  );
}

export default function VistaDiscord({ texto = '', variables = {}, embed = null, botones = [], menu = null, vacio = '', className = '' }) {
  const { t } = useTranslation();
  const cuerpo = rellenarEjemplo(texto, variables);
  const campos = embed && Array.isArray(embed.campos) ? embed.campos.filter((c) => c && c.nombre && c.valor) : [];
  const hayEmbed = !!(embed && (embed.titulo || embed.descripcion || campos.length || embed.imagen || embed.pie || embed.autor || embed.miniatura));
  const hayTexto = cuerpo.trim() !== '';
  return (
    <div className={`rounded-2xl border border-line bg-[#313338] p-3.5 text-left ${className}`} aria-label={t('dashboard.vistaDiscord.titulo')}>
      <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
        <Eye size={12} /> {t('dashboard.vistaDiscord.titulo')}
      </p>
      <CabeceraBot>
        {hayTexto && <div className="mt-0.5 break-words text-sm leading-[1.4] text-[#dbdee1]"><MarkdownDiscord text={cuerpo} /></div>}
        {hayEmbed && (
          <div className="mt-1.5 max-w-[432px] rounded-md border-l-4 bg-[#2b2d31] p-3" style={{ borderLeftColor: /^#[0-9a-fA-F]{6}$/.test(embed.color || '') ? embed.color : '#5865F2' }}>
            {embed.autor && (
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-white">
                {embed.autorIcono && <img src={embed.autorIcono} alt="" className="h-5 w-5 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                {rellenarEjemplo(embed.autor, variables)}
              </p>
            )}
            {embed.titulo && <p className="mb-1 text-sm font-bold text-white">{rellenarEjemplo(embed.titulo, variables)}</p>}
            {embed.descripcion && <div className="break-words text-sm text-[#dbdee1]"><MarkdownDiscord text={rellenarEjemplo(embed.descripcion, variables)} /></div>}
            {campos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {campos.map((c, i) => (
                  <div key={i} className={c.inline ? 'min-w-[30%] flex-1' : 'w-full'}>
                    <p className="text-xs font-bold text-white">{rellenarEjemplo(c.nombre, variables)}</p>
                    <div className="text-xs text-[#dbdee1]"><MarkdownDiscord text={rellenarEjemplo(c.valor, variables)} /></div>
                  </div>
                ))}
              </div>
            )}
            {embed.imagen && <img src={embed.imagen} alt="" className="mt-2 max-h-40 rounded" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
            {embed.pie && <p className="mt-2 text-xs text-white/50">{rellenarEjemplo(embed.pie, variables)}</p>}
          </div>
        )}
        {!hayTexto && !hayEmbed && <p className="mt-0.5 text-sm italic text-white/40">{vacio || t('dashboard.vistaDiscord.vacio')}</p>}
        <BotonesDiscord botones={botones} />
        {menu && (
          <div className="mt-2 flex max-w-[432px] items-center justify-between gap-2 rounded-[4px] border border-black/30 bg-[#1e1f22] px-3 py-2 text-sm text-[#949ba4]">
            <span className="min-w-0 truncate">{menu.placeholder}</span>
            <ChevronDown size={16} className="shrink-0" aria-hidden="true" />
          </div>
        )}
      </CabeceraBot>
    </div>
  );
}
