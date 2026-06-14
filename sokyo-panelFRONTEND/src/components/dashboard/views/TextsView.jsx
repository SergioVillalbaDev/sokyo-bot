// Vista de marca blanca — formulario + vista previa del Embed de Discord en vivo.
import { Save, Pencil, Eye } from 'lucide-react';
import { Card } from '../../ui/primitives';

export default function TextsView({ dash }) {
  const {
    configServidor, tituloMensaje, setTituloMensaje,
    descripcionMensaje, setDescripcionMensaje, footerMensaje, setFooterMensaje,
    guardarTextosConfig,
  } = dash;

  if (!configServidor) {
    return <p className="text-sm text-muted">Cargando configuración del servidor...</p>;
  }

  const field = 'w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-brand/40';

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera con botón guardar */}
      <Card className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-fg">Marca Blanca</h2>
          <p className="mt-1 text-sm text-muted">Personaliza los textos del mensaje incrustado (Embed).</p>
        </div>
        <button
          onClick={guardarTextosConfig}
          className="flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-on-brand glow-brand transition-transform hover:scale-[1.03]"
        >
          <Save size={16} /> Guardar Textos
        </button>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card className="flex flex-col gap-5 p-6">
          <h3 className="flex items-center gap-2 font-bold text-fg"><Pencil size={17} className="text-brand" /> Editar Contenido</h3>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted">Título del Mensaje</label>
            <input type="text" value={tituloMensaje} onChange={(e) => setTituloMensaje(e.target.value)} placeholder="Ej: 🎫 Soporte Técnico Activo" className={field} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted">Descripción / Instrucciones</label>
            <textarea value={descripcionMensaje} onChange={(e) => setDescripcionMensaje(e.target.value)} placeholder="Escribe las instrucciones..." className={`${field} min-h-[120px] resize-y`} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted">Pie de Página (Footer)</label>
            <input type="text" value={footerMensaje} onChange={(e) => setFooterMensaje(e.target.value)} placeholder="Ej: Sistema de Gestión" className={field} />
          </div>
        </Card>

        {/* Vista previa estilo Discord */}
        <Card className="flex flex-col p-6">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-fg"><Eye size={17} className="text-brand" /> Vista Previa (Discord)</h3>

          {/* Simulación del Embed de Discord */}
          <div className="rounded bg-[#2f3136] p-4 text-[#dcddde] shadow-xl" style={{ borderLeft: '4px solid #5865F2' }}>
            <div className="mb-2 text-[1.05rem] font-bold text-white">{tituloMensaje || 'Título del panel'}</div>
            <div className="mb-3 whitespace-pre-wrap text-sm text-[#b9bbbe]">{descripcionMensaje || 'Aquí aparecerán las instrucciones...'}</div>
            <div className="text-xs text-[#72767d]">{footerMensaje || 'Pie de página'}</div>
          </div>
          <div className="mt-4 w-fit select-none rounded bg-[#4f545c] px-4 py-2.5 text-sm font-semibold text-white opacity-80">
            📩 Abrir Ticket
          </div>
          <p className="mt-4 text-xs italic text-muted">Así se verá el panel cuando ejecutes <code className="rounded bg-bg px-1.5 py-0.5">!sokyo</code> en Discord.</p>
        </Card>
      </div>
    </div>
  );
}
