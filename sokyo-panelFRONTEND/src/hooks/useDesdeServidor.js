// Copia a una sección del panel lo que hay guardado en el servidor: al abrirla y
// cada vez que cambia por otra cosa (Deshacer, cambiar de servidor, recargar…).
//
// La respuesta de SU PROPIO guardado no se copia: el formulario ya tiene eso y
// a veces algo más que el servidor no guarda todavía —la fila recién añadida que
// aún no tiene rol (multiplicadores, recompensas), la pregunta vacía, el título que
// se acaba de borrar para escribir otro (el servidor ponía el de fábrica) o lo que
// se ha escrito mientras se guardaba—. Copiarla lo borraba con el autoguardado.
// useDashboard marca esas respuestas con `marcarEco`.
import { useEffect, useRef } from 'react';

const ecos = new WeakSet();

// Marca la configuración que devuelve un guardado (la recibe setConfigServidor).
export function marcarEco(config) {
  if (config && typeof config === 'object') ecos.add(config);
  return config;
}

// `fuente`: configServidor. `copiar(fuente)`: pasa los datos al formulario de la sección.
export function useDesdeServidor(fuente, copiar) {
  const copiarRef = useRef(copiar);
  useEffect(() => { copiarRef.current = copiar; });
  const servidor = useRef(undefined); // de qué servidor es lo último copiado
  useEffect(() => {
    if (!fuente) return;
    const id = fuente.guildId ?? null;
    if (servidor.current === id && ecos.has(fuente)) return; // su propio guardado
    servidor.current = id;
    copiarRef.current(fuente);
  }, [fuente]);
}
