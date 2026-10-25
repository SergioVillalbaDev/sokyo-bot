// Piezas que comparten las secciones de la landing: la ventana del navegador y
// el móvil donde van las capturas reales, y el enlace al panel de control.
import { ANCHO_MOVIL, ALTO_MOVIL } from './capturas';

// Enlace a /panel. Con un clic normal abre el panel sin recargar la página; con
// Ctrl/⌘ o la rueda, el navegador lo abre en otra pestaña como cualquier enlace.
export function EnlacePanel({ onEnterDashboard, onClick, children, ...resto }) {
  const alPulsar = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    onEnterDashboard(e);
  };
  return <a href="/panel" onClick={alPulsar} {...resto}>{children}</a>;
}

// Ventana de cristal con la barra de direcciones (url) y el contenido debajo.
export function Ventana({ url, className = '', children }) {
  return (
    <div className={`lx-card lx-brillo lx-halo lx-ventana relative ${className}`}>
      <div className="lx-barra-url">
        <i className="bg-red-400/80" /><i className="bg-amber-400/80" /><i className="bg-emerald-400/80" />
        <div className="ml-2 flex-1 truncate rounded-lg bg-black/30 px-3 py-1 text-center text-[11px] text-muted">{url}</div>
      </div>
      {children}
    </div>
  );
}

// Móvil con una captura dentro (imagen = { src, srcSet } de capturaMovil; el
// ancho, por className, y `sizes` dice cuánto ocupa para elegir la más ligera).
// `cargar="eager"` para la que se ve nada más entrar (la del hero).
export function Movil({ imagen, sizes, alt = '', className = '', cargar = 'lazy' }) {
  return (
    <div className={`lx-movil ${className}`}>
      <div className="lx-movil-pantalla">
        <img src={imagen.src} srcSet={imagen.srcSet} sizes={sizes} alt={alt} width={ANCHO_MOVIL} height={ALTO_MOVIL} loading={cargar} decoding="async" className="block h-auto w-full" />
      </div>
    </div>
  );
}
