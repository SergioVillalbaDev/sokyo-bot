// Autoguardado de los ajustes del panel: cuando dejas de tocar algo (1,5 s), se
// guarda solo con el mismo «Guardar» de la sección. Si sales de la sección con
// cambios pendientes, se guardan antes de irte. Se puede apagar en las
// preferencias (cabecera → Preferencias); el botón «Guardar» sigue ahí.
//
// Que no se pierda nada al recargar (1.9.10): antes, si la página se recargaba o
// se cerraba antes de ese 1,5 s (o el guardado fallaba, o el autoguardado estaba
// apagado), lo que se había cambiado desaparecía. Ahora:
//   · Lo que no está guardado se copia al momento en este navegador (borrador en
//     localStorage, por servidor y sección). Al volver a la sección se recupera y
//     se avisa con «Descartar» (AvisoBorrador.jsx).
//   · Al ocultar o cerrar la página (cambiar de app en el móvil, recargar) se
//     intenta guardar ya, sin esperar.
//   · Con el autoguardado apagado también se avisa antes de cerrar con cambios.
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
// servidor) no se confunde con uno suyo. keydown y click: un interruptor que se
// pulsa con Enter cambia antes del keyup.
let ultimaInteraccion = 0;
if (typeof document !== 'undefined') {
  for (const ev of ['input', 'change', 'pointerup', 'keydown', 'keyup', 'click']) document.addEventListener(ev, () => { ultimaInteraccion = Date.now(); }, true);
}
const MARGEN_INTERACCION = 1500;
// Lo que termina más tarde que el toque (subir un GIF, convertir un enlace de Tenor…)
// llama a esto justo antes de cambiar el formulario: si no, ese cambio llegaba pasado
// el margen, se tomaba por algo del servidor y no se guardaba.
export function marcarInteraccion() { ultimaInteraccion = Date.now(); }
// Secciones con `manual`: su botón «Guardar» avisa con esto cuando ha ido bien, y el
// formulario de ese momento (ya con lo que devuelva el servidor) pasa a ser lo guardado.
export function avisarGuardado() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('sokyo-guardado')); }
// Lo que cambia nada más abrir la sección (los datos del servidor que la
// vista copia a su formulario) tampoco es de la persona.
const ARRANQUE = 1200;

// ¿Ha ido mal el guardado? Las secciones devuelven false, { ok: false } o { error }.
const fallo = (r) => r === false || (r && typeof r === 'object' && (r.ok === false || !!r.error));

// --- Borradores: lo que aún no está guardado, en este navegador -------------
const PREFIJO_BORRADOR = 'sokyoBorrador:';
const DURA_BORRADOR = 7 * 24 * 60 * 60 * 1000; // uno más viejo ya no se recupera
// Si lo guardado ha cambiado desde que se empezó el borrador (otra persona, otro
// dispositivo), solo se recupera si es de hace poco: es casi seguro una recarga y no
// se quiere pisar lo nuevo con algo viejo.
const BORRADOR_RECIENTE = 10 * 60 * 1000;
const claveBorrador = (seccion) => {
  let servidor = '';
  try { servidor = localStorage.getItem('sokyoGuild') || ''; } catch { /* sin almacenamiento */ }
  return `${PREFIJO_BORRADOR}${servidor}:${seccion}`;
};
function leerBorrador(clave) {
  try {
    const b = JSON.parse(localStorage.getItem(clave) || 'null');
    if (!b || typeof b.v !== 'string') return null;
    if (Date.now() - (Number(b.t) || 0) > DURA_BORRADOR) { localStorage.removeItem(clave); return null; }
    return b;
  } catch { return null; }
}
// v: lo que hay en el formulario; b: lo guardado cuando se escribió (para ver si cambió).
function escribirBorrador(clave, v, b) { try { localStorage.setItem(clave, JSON.stringify({ v, b, t: Date.now() })); } catch { /* lleno o sin almacenamiento */ } }
function quitarBorrador(clave) { try { localStorage.removeItem(clave); } catch { /* sin almacenamiento */ } }
// Al cerrar sesión se borran todos (App.jsx: logout), para que otra persona en este
// navegador no recupere lo de antes.
// Quita el borrador de una sección cuando ya se ha guardado de otra forma (p. ej. un
// panel de roles que se guarda y se cierra su ventana).
export function borrarBorrador(seccion) { quitarBorrador(claveBorrador(seccion)); }

// `valor`: lo que se edita en la sección. `guardar`: su función de guardar (que
// devuelva false o { ok: false } si falla). `listo`: ya han llegado los datos.
// `borrador` + `restaurar`: nombre de la sección y cómo volver a poner un `valor`
// en su formulario (lo contrario de armar `valor`); con ellos, lo que no se ha
// guardado se recupera tras recargar.
// Sin `guardar` (null), solo borrador: lo que se está escribiendo se copia en este
// navegador y se recupera al volver, sin guardar nada en el servidor (Creador de
// mensajes: un mensaje que se manda una vez).
// Devuelve el estado para pintarlo:
// 'apagado' | 'sin-guardar' | 'borrador' | 'al-dia' | 'pendiente' | 'guardando' | 'guardado' | 'error'.
// `manual`: la sección se guarda solo con su botón (p. ej. porque al guardar toca
// Discord): borrador, aviso al salir y «Cambios sin guardar», como con el
// autoguardado apagado. Lo guardado se da por bueno cuando la API avisa de que ha
// cambiado la configuración (sokyo-cambio).
export function useAutoguardado(valor, guardar, { listo = true, espera = 1500, borrador = null, restaurar = null, manual = false } = {}) {
  const soloBorrador = !manual && typeof guardar !== 'function';
  const activo = useAutoguardadoActivo() && !soloBorrador && !manual;
  const firma = listo ? JSON.stringify(valor ?? null) : null;
  const [base, setBase] = useState(null); // lo que hay guardado
  // Lo primero que se ve al estar listo es lo guardado (se fija al pintar).
  if (firma !== null && base === null) setBase(firma);
  const [guardando, setGuardando] = useState(false);
  const [recien, setRecien] = useState(false);
  const [fallos, setFallos] = useState(0); // seguidos: el reintento espera cada vez más
  // La clave se fija al abrir: la vista se vuelve a montar al cambiar de servidor.
  const [clave] = useState(() => (borrador && restaurar ? claveBorrador(borrador) : null));
  const guardarRef = useRef(guardar);
  const restaurarRef = useRef(restaurar);
  const firmaRef = useRef(firma);
  const baseRef = useRef(base);
  const pendienteRef = useRef(false);
  const cambiadoRef = useRef(false);
  const listoDesde = useRef(0);
  const revisado = useRef(!clave);      // ¿ya se ha mirado si había un borrador?
  const restaurando = useRef(false);    // el próximo cambio es el borrador recuperado
  useEffect(() => { guardarRef.current = guardar; restaurarRef.current = restaurar; firmaRef.current = firma; baseRef.current = base; });

  // Un cambio que no viene de tocar algo (o que llega nada más abrir) pasa a ser lo guardado.
  useEffect(() => {
    if (firma === null) return;
    const ahora = Date.now();
    if (!listoDesde.current) listoDesde.current = ahora;
    // Lo recuperado del borrador no está guardado: cuenta como un cambio de la persona.
    if (restaurando.current) { restaurando.current = false; return; }
    const alAbrir = ahora - listoDesde.current < ARRANQUE;
    // Solo borrador: no llega nada del servidor después de abrir; todo es de la persona,
    // también lo que escribe nada más abrir (si no, «Cancelar» no preguntaba).
    if (soloBorrador) { if (alAbrir && ultimaInteraccion <= listoDesde.current) setBase(firma); return; }
    if (alAbrir || ahora - ultimaInteraccion > MARGEN_INTERACCION) setBase(firma);
  }, [firma, soloBorrador]);

  const cambiado = firma !== null && base !== null && firma !== base;
  const pendiente = activo && cambiado;
  useEffect(() => { pendienteRef.current = pendiente; cambiadoRef.current = cambiado; }, [pendiente, cambiado]);

  // Recuperar el borrador: un momento después de abrir, cuando la sección ya ha
  // copiado lo del servidor. Si ya se ha empezado a tocar algo, manda lo nuevo.
  useEffect(() => {
    if (revisado.current || base === null) return undefined;
    const id = setTimeout(() => {
      revisado.current = true;
      const b = leerBorrador(clave);
      if (!b) return;
      if (b.v === firmaRef.current) { quitarBorrador(clave); return; } // ya está así
      if (firmaRef.current !== baseRef.current) return;
      if (b.b !== baseRef.current && Date.now() - (Number(b.t) || 0) > BORRADOR_RECIENTE) { quitarBorrador(clave); return; }
      let datos;
      try { datos = JSON.parse(b.v); } catch { quitarBorrador(clave); return; }
      const delServidor = baseRef.current;
      restaurando.current = true;
      restaurarRef.current(datos);
      window.dispatchEvent(new CustomEvent('sokyo-borrador', {
        detail: {
          desde: b.t,
          // «Descartar»: vuelve a lo que había en el servidor (si ya se guardó lo recuperado, se guarda esto otra vez).
          descartar: () => { quitarBorrador(clave); try { restaurarRef.current?.(JSON.parse(delServidor)); } catch { /* nada que volver a poner */ } },
        },
      }));
    }, ARRANQUE + 150);
    return () => clearTimeout(id);
  }, [base, clave]);

  // Copiar al borrador lo que no está guardado (y quitarlo cuando ya lo está).
  useEffect(() => {
    if (!clave || !revisado.current || firma === null || base === null) return;
    if (firma === base) quitarBorrador(clave); else escribirBorrador(clave, firma, base);
  }, [clave, firma, base]);

  const guardandoRef = useRef(false);
  const guardarAhora = useRef(null);
  guardarAhora.current ??= async () => {
    if (guardandoRef.current || firmaRef.current === null || typeof guardarRef.current !== 'function') return;
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

  // Al ocultar la página (cambiar de app o de pestaña en el móvil) o al cerrarla o
  // recargarla: guardar ya, sin esperar. Si no da tiempo, queda el borrador.
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden' && pendienteRef.current) guardarAhora.current(); };
    const alSalir = () => { if (pendienteRef.current) guardarAhora.current(); };
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', alSalir);
    return () => { document.removeEventListener('visibilitychange', alOcultar); window.removeEventListener('pagehide', alSalir); };
  }, []);

  // Con el autoguardado apagado, «Guardar» llama directo a la sección: cuando la API
  // dice que ha cambiado la configuración (sokyo-cambio), lo de ahora ya está guardado.
  useEffect(() => {
    if (activo || soloBorrador) return undefined;
    // Un momento después: el formulario ya lleva lo que haya devuelto el servidor.
    const guardado = () => setTimeout(() => { if (firmaRef.current !== null) setBase(firmaRef.current); }, 60);
    window.addEventListener('sokyo-cambio', guardado);
    window.addEventListener('sokyo-guardado', guardado);
    return () => { window.removeEventListener('sokyo-cambio', guardado); window.removeEventListener('sokyo-guardado', guardado); };
  }, [activo, soloBorrador]);

  // Cerrar la pestaña con cambios sin guardar: el navegador pregunta antes
  // (también con el autoguardado apagado: ahí no se guarda nada solo). Con solo
  // borrador no hace falta: se recupera al volver.
  useEffect(() => {
    if (!cambiado || soloBorrador) return undefined;
    const avisar = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [cambiado, soloBorrador]);

  // Al salir de la sección con algo sin guardar: se guarda antes de irse (y, si sale
  // bien, el borrador sobra).
  useEffect(() => () => {
    if (!pendienteRef.current) return;
    Promise.resolve(guardarRef.current?.()).then((r) => { if (clave && !fallo(r)) quitarBorrador(clave); }, () => {});
  }, [clave]);

  if (soloBorrador) return cambiado ? 'borrador' : 'apagado';
  if (!activo) return cambiado ? 'sin-guardar' : 'apagado';
  if (guardando) return 'guardando';
  if (pendiente) return fallos ? 'error' : 'pendiente';
  return recien ? 'guardado' : 'al-dia';
}

// Formularios para crear algo (anuncio programado, encuesta, evento, sorteo…): solo
// borrador. Lo que se está escribiendo se recupera tras recargar, con «Descartar».
// `vacio`: el formulario está como al abrirlo (entonces no hay borrador: al crear y
// vaciarse, desaparece solo). `restaurar(v)` pone `v` en el formulario; con null, lo vacía.
export function useBorrador(seccion, valor, vacio, restaurar) {
  return useAutoguardado(vacio ? null : valor, null, { borrador: seccion, restaurar: (v) => restaurar(v || null) });
}
