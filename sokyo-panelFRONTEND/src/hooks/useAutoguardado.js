// Autoguardado de los ajustes del panel: cuando dejas de tocar algo (1,5 s), se
// guarda solo con el mismo «Guardar» de la sección. Si sales de la sección con
// cambios pendientes, se guardan antes de irte. Se puede apagar en las
// preferencias (cabecera → Preferencias); el botón «Guardar» sigue ahí.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const CLAVE = 'sokyoAutoguardado';
const EVENTO = 'sokyo-autoguardado';

export const autoguardadoActivo = () => { try { return localStorage.getItem(CLAVE) !== '0'; } catch { return true; } };
export function ponerAutoguardado(activo) {
  try { localStorage.setItem(CLAVE, activo ? '1' : '0'); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event(EVENTO));
}
const suscribir = (avisar) => {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener('storage', avisar);
  return () => { window.removeEventListener(EVENTO, avisar); window.removeEventListener('storage', avisar); };
};
export const useAutoguardadoActivo = () => useSyncExternalStore(suscribir, autoguardadoActivo, () => true);

// Cuándo ha tocado algo la persona por última vez (escribir, pulsar, elegir).
// Así un cambio que llega solo (la recarga tras guardar, datos que llegan del
// servidor) no se confunde con uno suyo.
let ultimaInteraccion = 0;
if (typeof document !== 'undefined') {
  for (const ev of ['input', 'change', 'pointerup', 'keyup']) document.addEventListener(ev, () => { ultimaInteraccion = Date.now(); }, true);
}
const MARGEN_INTERACCION = 1500;
// Lo que cambia nada más abrir la sección (los datos del servidor que la
// vista copia a su formulario) tampoco es de la persona.
const ARRANQUE = 1200;

// ¿Ha ido mal el guardado? Las secciones devuelven false, { ok: false } o { error }.
const fallo = (r) => r === false || (r && typeof r === 'object' && (r.ok === false || !!r.error));

// `valor`: lo que se edita en la sección. `guardar`: su función de guardar (que
// devuelva false o { ok: false } si falla). `listo`: ya han llegado los datos.
// Devuelve el estado para pintarlo:
// 'apagado' | 'al-dia' | 'pendiente' | 'guardando' | 'guardado' | 'error'.
export function useAutoguardado(valor, guardar, { listo = true, espera = 1500 } = {}) {
  const activo = useAutoguardadoActivo();
  const firma = listo ? JSON.stringify(valor ?? null) : null;
  const [base, setBase] = useState(null); // lo que hay guardado
  // Lo primero que se ve al estar listo es lo guardado (se fija al pintar).
  if (firma !== null && base === null) setBase(firma);
  const [guardando, setGuardando] = useState(false);
  const [recien, setRecien] = useState(false);
  const [fallos, setFallos] = useState(0); // seguidos: el reintento espera cada vez más
  const guardarRef = useRef(guardar);
  const firmaRef = useRef(firma);
  const pendienteRef = useRef(false);
  const listoDesde = useRef(0);
  useEffect(() => { guardarRef.current = guardar; firmaRef.current = firma; });

  // Un cambio que no viene de tocar algo (o que llega nada más abrir) pasa a ser lo guardado.
  useEffect(() => {
    if (firma === null) return;
    const ahora = Date.now();
    if (!listoDesde.current) listoDesde.current = ahora;
    const alAbrir = ahora - listoDesde.current < ARRANQUE;
    if (alAbrir || ahora - ultimaInteraccion > MARGEN_INTERACCION) setBase(firma);
  }, [firma]);

  const pendiente = activo && firma !== null && base !== null && firma !== base;
  useEffect(() => { pendienteRef.current = pendiente; }, [pendiente]);

  const guardandoRef = useRef(false);
  const guardarAhora = useRef(null);
  guardarAhora.current ??= async () => {
    if (guardandoRef.current || firmaRef.current === null) return;
    const guardada = firmaRef.current;
    guardandoRef.current = true;
    setGuardando(true);
    let ok;
    try { ok = !fallo(await guardarRef.current?.()); } catch { ok = false; }
    guardandoRef.current = false;
    setGuardando(false);
    if (!ok) { setFallos((n) => n + 1); return; } // sigue pendiente: se reintenta
    setFallos(0);
    setBase(guardada);
    setRecien(true);
    setTimeout(() => setRecien(false), 2500);
  };

  // Tras un fallo se reintenta solo, cada vez más espaciado (hasta 1 min).
  useEffect(() => {
    if (!pendiente || guardando) return undefined;
    const id = setTimeout(() => guardarAhora.current(), fallos ? Math.min(60000, espera * 2 ** (fallos + 1)) : espera);
    return () => clearTimeout(id);
  }, [firma, pendiente, guardando, espera, fallos]);

  // Ctrl + S (lo avisa el panel con el evento sokyo-guardar): guardar ya.
  useEffect(() => {
    const ya = () => guardarAhora.current();
    window.addEventListener('sokyo-guardar', ya);
    return () => window.removeEventListener('sokyo-guardar', ya);
  }, []);

  // Cerrar la pestaña con cambios sin guardar: el navegador pregunta antes.
  useEffect(() => {
    if (!pendiente) return undefined;
    const avisar = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [pendiente]);

  // Al salir de la sección con algo sin guardar: se guarda antes de irse.
  useEffect(() => () => { if (pendienteRef.current) guardarRef.current?.(); }, []);

  if (!activo) return 'apagado';
  if (guardando) return 'guardando';
  if (pendiente) return fallos ? 'error' : 'pendiente';
  return recien ? 'guardado' : 'al-dia';
}
