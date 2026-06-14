// Pie de página de la landing — enlaces legales y redes.
// Nota: lucide-react eliminó los iconos de marca (Github/Twitter/Discord) en
// versiones recientes. Usamos iconos genéricos. // TODO: DESIGN TEAM — si
// queréis logos de marca reales, importadlos de 'simple-icons' o como SVG.
import { Send, AtSign, MessageCircle } from 'lucide-react';

export default function Footer() {
  const cols = [
    { title: 'Producto', links: ['Funciones', 'Precios', 'Panel', 'Estado del servicio'] },
    { title: 'Recursos', links: ['Documentación', 'Guía de inicio', 'Comandos', 'Soporte'] },
    { title: 'Legal', links: ['Términos de servicio', 'Política de privacidad', 'Cookies', 'Aviso legal'] },
  ];

  return (
    <footer className="border-t border-line bg-sidebar">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              {/* // TODO: DESIGN TEAM — logo oficial */}
              <img src="/assets/logo-placeholder.svg" alt="Sokyo" className="h-9 w-9" />
              <span className="text-lg font-extrabold text-fg">Sokyo Bot</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted">
              El sistema de soporte definitivo para tu comunidad de Discord. Profesional, rápido y personalizable.
            </p>
            <div className="mt-5 flex gap-3">
              {/* // TODO: DESIGN TEAM — URLs reales de redes sociales */}
              {[MessageCircle, AtSign, Send].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card text-muted transition-colors hover:text-fg"
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-fg">{col.title}</h4>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-muted transition-colors hover:text-fg">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <p className="text-sm text-muted">© {new Date().getFullYear()} Sokyo Bot. Todos los derechos reservados.</p>
          <p className="text-xs text-muted">Hecho con 💜 para la comunidad de Discord.</p>
        </div>
      </div>
    </footer>
  );
}
