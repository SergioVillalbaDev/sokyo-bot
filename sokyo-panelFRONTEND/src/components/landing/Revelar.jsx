// Muestra con una animación (CSS: .sk-revelar / .sk-crece en index.css) lo que
// entra en pantalla al hacer scroll. Mucho más ligero en el móvil que una
// librería de animaciones.
import { useEffect, useRef } from 'react';
import { observar } from './observar';

// <Revelar as="article" retraso={0.1}>…</Revelar>: aparece al verse (retraso en segundos).
export default function Revelar({ as: Etiqueta = 'div', retraso = 0, className = '', style, children, ...resto }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; return observar(el, () => el.classList.add('sk-visible')); }, []);
  return (
    <Etiqueta ref={ref} className={`sk-revelar ${className}`} style={{ ...style, '--retraso': `${retraso}s` }} {...resto}>
      {children}
    </Etiqueta>
  );
}
