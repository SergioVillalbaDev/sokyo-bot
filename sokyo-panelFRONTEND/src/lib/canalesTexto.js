// Autocompletar canales al escribir «#» (TextareaCanales.jsx): qué se está
// escribiendo, qué canales encajan y cómo queda el texto al elegir uno.
// El bot convierte luego «#nombre» en el enlace al canal (utils/mencionesCanal.js).
// Tiene test (test/bienvenidas.test.js).

// Solo letras y números, en minúsculas y sin tildes (igual que el bot).
export const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, '');

// ¿Justo antes del cursor hay «#algo» que se está escribiendo? → { inicio, consulta }.
// «#» tiene que ir al principio o detrás de un espacio o un signo de formato.
export function buscarConsultaCanal(texto, cursor) {
  const antes = String(texto || '').slice(0, cursor);
  const m = /(?:^|[\s([{>*_~|])#([^\s#<>@.,;:!?¡¿()"'[\]{}*~|`]*)$/u.exec(antes);
  if (!m) return null;
  return { inicio: cursor - m[1].length - 1, consulta: m[1] };
}

// Canales que encajan con lo escrito: primero los que empiezan así, luego los que lo contienen.
export function filtrarCanales(canales, consulta, max = 8) {
  const lista = Array.isArray(canales) ? canales : [];
  const q = normalizar(consulta);
  if (!q) return lista.slice(0, max);
  const empiezan = [];
  const contienen = [];
  for (const c of lista) {
    const n = normalizar(c.nombre);
    if (n.startsWith(q)) empiezan.push(c);
    else if (n.includes(q)) contienen.push(c);
  }
  return [...empiezan, ...contienen].slice(0, max);
}

// Pone «#nombre » en lugar de lo escrito y devuelve el texto y dónde queda el cursor.
export function insertarCanal(texto, cursor, inicio, nombre) {
  const s = String(texto || '');
  const despues = s.slice(cursor);
  const espacio = /^\s/.test(despues) ? '' : ' ';
  const nuevo = `${s.slice(0, inicio)}#${nombre}${espacio}${despues}`;
  return { texto: nuevo, cursor: inicio + 1 + nombre.length + 1 };
}
