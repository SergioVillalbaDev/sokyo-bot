// Piezas compartidas por las secciones de la 1.9.0 (cumpleaños, salón de la fama,
// grupos, clanes, confesiones, solicitudes, ausente): una lista vacía bonita y una
// fila con interruptor. Cargar la sección y el autoguardado, en hooks/useModulo.js;
// los campos y tarjetas son los de Crecimiento (crecimientoShared.jsx).

// Lista vacía: icono, título y una línea de ayuda.
export function Vacio({ icono: Icono, titulo, sub }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      {Icono && <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-elevated text-brand"><Icono size={22} /></span>}
      <p className="font-semibold text-fg">{titulo}</p>
      {sub && <p className="max-w-md text-sm text-muted">{sub}</p>}
    </div>
  );
}

// Fila con un interruptor y su explicación.
export function FilaInterruptor({ titulo, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-bg px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-fg">{titulo}</span>
        {desc && <span className="block text-xs text-muted">{desc}</span>}
      </span>
      {children}
    </div>
  );
}

// Fichas para elegir varios elementos de una lista (roles, servidores…).
// `items`: [{ id, nombre }]; `seleccion`: ids marcados.
export function Fichas({ items = [], seleccion = [], onCambio, prefijo = '', vacio = '' }) {
  if (!items.length) return vacio ? <p className="text-sm italic text-muted">{vacio}</p> : null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const activo = seleccion.includes(it.id);
        return (
          <button key={it.id} type="button" aria-pressed={activo}
            onClick={() => onCambio(activo ? seleccion.filter((x) => x !== it.id) : [...seleccion, it.id])}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${activo ? 'border-brand bg-brand/10 text-fg' : 'border-line text-muted hover:text-fg'}`}>
            {prefijo}{it.nombre}
          </button>
        );
      })}
    </div>
  );
}

