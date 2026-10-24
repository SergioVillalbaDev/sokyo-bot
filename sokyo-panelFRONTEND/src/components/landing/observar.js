// Un solo IntersectionObserver para toda la landing: avisa (una vez) cuando un
// elemento entra en pantalla. Sin IntersectionObserver, avisa enseguida.
let observador = null;
const avisos = new Map();

export function observar(el, alVerse) {
  if (!el) return () => {};
  if (typeof IntersectionObserver === 'undefined') { alVerse(); return () => {}; }
  observador ||= new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      observador.unobserve(e.target); // solo la primera vez
      avisos.get(e.target)?.();
      avisos.delete(e.target);
    }
  }, { rootMargin: '0px 0px -60px 0px' });
  avisos.set(el, alVerse);
  observador.observe(el);
  return () => { avisos.delete(el); observador.unobserve(el); };
}
