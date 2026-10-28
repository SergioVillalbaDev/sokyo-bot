// Landing page completa — compone todas las secciones con el estilo cristal
// (src/landing.css): el mismo lenguaje visual que el panel y «Mi cuenta».
// Orden pensado para vender y para que nadie se pierda: qué es (hero, con el
// panel de control al frente), las dos entradas (panel / Mi cuenta), el panel
// por dentro (capturas reales), qué hace, cómo está organizado, cómo entra cada
// miembro a su cuenta, la app del móvil, seguridad, cómo se empieza,
// comparativa, precios, dudas y CTA final.
import { lazy, startTransition, Suspense, useEffect, useRef, useState } from 'react';
import FondoLanding from './FondoLanding';
import Navbar from './Navbar';
import Hero from './Hero';
import Accesos from './Accesos';
import RecargaSiFalla from '../RecargaSiFalla';
import '../../landing.css';

// Lo de más abajo llega en otra descarga (ver LandingResto.jsx); el pie, del mismo archivo.
const LandingResto = lazy(() => import('./LandingResto'));
const Pie = lazy(() => import('./LandingResto').then((m) => ({ default: m.Pie })));

export default function Landing({ onEnterDashboard }) {
  const raiz = useRef(null);
  // Lo de abajo se pide cuando la portada ya está pintada (dos fotogramas
  // después): así no le quita al móvil tiempo de descarga ni de proceso. Y se
  // monta como transición: React lo hace a trozos y no bloquea la página.
  const [resto, setResto] = useState(false);
  useEffect(() => {
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => startTransition(() => setResto(true))); });
    return () => cancelAnimationFrame(id);
  }, []);
  // Las secciones de abajo no se pintan hasta que se acercan (lx-diferido): con
  // ellas sin pintar el navegador calcularía mal dónde cae un enlace interno
  // (#pricing, #mi-cuenta…). Al pulsar uno, se pintan todas antes del salto.
  const alPulsar = (e) => { if (e.target.closest?.('a[href^="#"]')) raiz.current?.classList.add('lx-listo'); };
  // Enlace directo a una sección (p. ej. sokyo.studio/#pricing): cuando el
  // navegador buscó el ancla, la sección aún no existía. Se salta a ella en
  // cuanto llegan las secciones de abajo (LandingResto avisa al montarse).
  const irAlEnlace = () => {
    const seccion = window.location.hash.length > 1 && document.getElementById(window.location.hash.slice(1));
    if (!seccion) return;
    raiz.current?.classList.add('lx-listo');
    setTimeout(() => seccion.scrollIntoView({ block: 'start' }), 50);
  };
  useEffect(() => {
    // Los colores de texto y acento salen del tema Aurora (clave "lima"), el de
    // los colores del avatar; el fondo y el cristal los pone landing.css.
    document.documentElement.setAttribute('data-theme', 'lima');
  }, []);

  return (
    <div ref={raiz} className="lx" onClickCapture={alPulsar}>
      <FondoLanding />
      <Navbar onEnterDashboard={onEnterDashboard} />
      <main>
        <Hero onEnterDashboard={onEnterDashboard} />
        <Accesos onEnterDashboard={onEnterDashboard} />
        {resto && <RecargaSiFalla><Suspense fallback={null}><LandingResto onEnterDashboard={onEnterDashboard} alCargar={irAlEnlace} /></Suspense></RecargaSiFalla>}
      </main>
      {resto && <RecargaSiFalla><Suspense fallback={null}><Pie onEnterDashboard={onEnterDashboard} /></Suspense></RecargaSiFalla>}
    </div>
  );
}
