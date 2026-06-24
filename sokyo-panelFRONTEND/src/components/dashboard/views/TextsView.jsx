// Vista de marca blanca / personalización — formulario + vista previa del Embed.
import { useTranslation } from 'react-i18next';
import { Save, Pencil, Eye, Palette, Terminal } from 'lucide-react';
import { Card } from '../../ui/primitives';

export default function TextsView({ dash }) {
  const { t } = useTranslation();
  const {
    configServidor, tituloMensaje, setTituloMensaje,
    descripcionMensaje, setDescripcionMensaje, footerMensaje, setFooterMensaje,
    colorEmbed, setColorEmbed, textoBoton, setTextoBoton,
    mensajeBienvenida, setMensajeBienvenida, prefijo, setPrefijo,
    categoriaArchivados, setCategoriaArchivados, guardarTextosConfig,
    esPremium,
  } = dash;

  if (!configServidor) {
    return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  }

  const field = 'w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-brand/40';
  const label = 'text-xs font-bold uppercase tracking-wide text-muted';

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera con botón guardar */}
      <Card data-help="texts-guardar" className="flex flex-col items-start justify-between gap-4 p-6 shadow-soft sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-fg">{t('dashboard.texts_v.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dashboard.texts_v.subtitle')}</p>
        </div>
        <button
          onClick={guardarTextosConfig}
          className="flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-on-brand glow-brand transition-transform hover:scale-[1.03]"
        >
          <Save size={16} /> {t('dashboard.texts_v.save')}
        </button>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card data-help="texts-form" className="flex flex-col gap-5 p-6 shadow-soft">
          <h3 className="flex items-center gap-2 font-bold text-fg"><Pencil size={17} className="text-brand" /> {t('dashboard.texts_v.content')}</h3>

          <div className="flex flex-col gap-2">
            <label className={label}>{t('dashboard.texts_v.msgTitle')}</label>
            <input type="text" value={tituloMensaje} onChange={(e) => setTituloMensaje(e.target.value)} placeholder="🎫 Soporte Técnico Activo" className={field} />
          </div>

          <div className="flex flex-col gap-2">
            <label className={label}>{t('dashboard.texts_v.msgDesc')}</label>
            <textarea value={descripcionMensaje} onChange={(e) => setDescripcionMensaje(e.target.value)} className={`${field} min-h-[100px] resize-y`} />
          </div>

          <div className="flex flex-col gap-2">
            <label className={label}>{t('dashboard.texts_v.footer')}</label>
            <input type="text" value={footerMensaje} onChange={(e) => setFooterMensaje(e.target.value)} className={field} />
            <p className={`text-xs ${esPremium ? 'text-success' : 'text-muted'}`}>
              {esPremium ? t('dashboard.texts_v.wlPro') : t('dashboard.texts_v.wlFree')}
            </p>
          </div>

          {/* Color + botón */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className={label}>{t('dashboard.texts_v.color')}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={colorEmbed} onChange={(e) => setColorEmbed(e.target.value)} className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                <input type="text" value={colorEmbed} onChange={(e) => setColorEmbed(e.target.value)} className={field} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={label}>{t('dashboard.texts_v.btnText')}</label>
              <input type="text" value={textoBoton} onChange={(e) => setTextoBoton(e.target.value)} placeholder="📩 Abrir Ticket" className={field} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className={label}>{t('dashboard.texts_v.welcome')}</label>
            <input type="text" value={mensajeBienvenida} onChange={(e) => setMensajeBienvenida(e.target.value)} className={field} />
          </div>
        </Card>

        {/* Vista previa estilo Discord */}
        <Card className="flex flex-col p-6 shadow-soft">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-fg"><Eye size={17} className="text-brand" /> {t('dashboard.texts_v.preview')}</h3>

          <div className="rounded bg-[#2f3136] p-4 text-[#dcddde] shadow-xl" style={{ borderLeft: `4px solid ${colorEmbed || '#5865F2'}` }}>
            <div className="mb-2 text-[1.05rem] font-bold text-white">{tituloMensaje || t('dashboard.texts_v.previewTitle')}</div>
            <div className="mb-3 whitespace-pre-wrap text-sm text-[#b9bbbe]">{descripcionMensaje || t('dashboard.texts_v.previewDesc')}</div>
            <div className="text-xs text-[#72767d]">{footerMensaje || t('dashboard.texts_v.previewFooter')}</div>
          </div>
          <div
            className="mt-4 w-fit select-none rounded px-4 py-2.5 text-sm font-semibold text-white shadow-md"
            style={{ backgroundColor: colorEmbed || '#5865F2' }}
          >
            {textoBoton || '📩 Abrir Ticket'}
          </div>
          <p className="mt-4 text-xs italic text-muted">{t('dashboard.texts_v.previewNote', { prefix: prefijo || '!' })}</p>
        </Card>
      </div>

      {/* Avanzado: prefijo + categoría de archivados */}
      <Card data-help="texts-avanzado" className="flex flex-col gap-5 p-6 shadow-soft">
        <h3 className="flex items-center gap-2 font-bold text-fg"><Terminal size={17} className="text-brand" /> {t('dashboard.texts_v.advanced')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className={label}>{t('dashboard.texts_v.prefix')}</label>
            <input type="text" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} maxLength={5} placeholder="!" className={field} />
            <p className="text-xs text-muted">{t('dashboard.texts_v.prefixHint', { prefix: prefijo || '!' })}</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className={label}>{t('dashboard.texts_v.archiveCat')}</label>
            <input type="text" value={categoriaArchivados} onChange={(e) => setCategoriaArchivados(e.target.value)} placeholder="🗄️ Tickets Archivados" className={field} />
            <p className="text-xs text-muted">{t('dashboard.texts_v.archiveHint')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-3 text-xs text-muted">
          <Palette size={15} className="text-brand" /> {t('dashboard.texts_v.reminder', { prefix: prefijo || '!' })}
        </div>
      </Card>
    </div>
  );
}
