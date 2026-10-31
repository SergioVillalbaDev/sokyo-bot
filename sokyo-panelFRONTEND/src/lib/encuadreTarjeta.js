// Vista previa en la web del fondo de un diseño de tarjeta de nivel con su encuadre
// (lo que se movió, amplió y giró al subirlo; components/dashboard/RecortarImagen.jsx,
// forma «tarjeta»). Es el mismo cálculo con el que el bot la dibuja (utils/rankCard.js).
// Devuelve el estilo de un <img> dentro de una caja con la forma de la tarjeta
// (900 × 270) con `position: relative; overflow: hidden`.
export const PROPORCION_TARJETA = 900 / 270;

export function estiloFondoTarjeta(encuadre) {
  const e = encuadre || {};
  if (!(Number(e.escala) > 0) || !(Number(e.ancho) > 0)) {
    return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', maxWidth: 'none' };
  }
  return {
    position: 'absolute',
    left: `${50 + (Number(e.x) || 0) * 100}%`,
    // `y` va en anchos de tarjeta: en alto son PROPORCION_TARJETA veces más.
    top: `${50 + (Number(e.y) || 0) * PROPORCION_TARJETA * 100}%`,
    width: `${Number(e.ancho) * Number(e.escala) * 100}%`,
    height: 'auto',
    maxWidth: 'none',
    transform: `translate(-50%, -50%) rotate(${Number(e.giro) || 0}deg)`,
  };
}
