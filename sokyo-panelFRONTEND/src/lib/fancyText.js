// ============================================================================
// fancyText — convierte texto normal a "estilos" de letra Unicode.
// OJO: no son fuentes reales; son caracteres Unicode equivalentes (𝗔, 𝓐, ᴀ…)
// que Discord muestra estilizados porque forman parte del propio texto.
// Los alfabetos se generan por código a partir de su punto de inicio Unicode,
// así evitamos teclear cientos de caracteres a mano.
// ============================================================================

// Genera un array de 26 (o 10) caracteres consecutivos desde un code point.
const serie = (inicio, n) => Array.from({ length: n }, (_, i) => String.fromCodePoint(inicio + i));

// Construye un mapa { upper, lower, digits } a partir de los inicios de cada bloque.
const desde = (up, lo, di) => ({ upper: serie(up, 26), lower: serie(lo, 26), digits: di ? serie(di, 10) : null });

// Doble trazo (double-struck): el bloque tiene "huecos" (algunas mayúsculas
// viven en el bloque Letterlike), así que partimos del bloque y corregimos.
const doble = desde(0x1D538, 0x1D552, 0x1D7D8);
Object.entries({ 2: 0x2102, 7: 0x210D, 13: 0x2115, 15: 0x2119, 16: 0x211A, 17: 0x211D, 25: 0x2124 })
  .forEach(([i, cp]) => { doble.upper[Number(i)] = String.fromCodePoint(cp); });

// Versalitas (small caps): no hay bloque contiguo; mapa explícito a-z.
const SC = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ꞯ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
const versalitasArr = 'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => SC[c]);

// Mapas por estilo. (cursiva/manuscrita/gótica no tienen dígitos propios → se dejan normales.)
const MAPAS = {
  negrita: desde(0x1D5D4, 0x1D5EE, 0x1D7EC),     // sans-serif bold
  cursiva: desde(0x1D608, 0x1D622, null),        // sans-serif italic
  manuscrita: desde(0x1D4D0, 0x1D4EA, null),     // script bold
  gotica: desde(0x1D56C, 0x1D586, null),         // fraktur bold
  doble,                                         // double-struck
  monospace: desde(0x1D670, 0x1D68A, 0x1D7F6),   // monospace
  versalitas: { upper: versalitasArr, lower: versalitasArr, digits: null },
};

// Lista de estilos disponibles (el orden es el del selector). 'normal' = sin cambios.
export const ESTILOS_FUENTE = ['normal', 'negrita', 'cursiva', 'manuscrita', 'gotica', 'doble', 'monospace', 'versalitas'];

// Convierte `texto` al estilo indicado. Caracteres no soportados se dejan igual.
export function aplicarEstilo(texto, estiloId) {
  if (!texto || estiloId === 'normal') return texto;
  const m = MAPAS[estiloId];
  if (!m) return texto;
  let out = '';
  for (const ch of texto) {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) out += m.upper[c - 65];
    else if (c >= 97 && c <= 122) out += m.lower[c - 97];
    else if (m.digits && c >= 48 && c <= 57) out += m.digits[c - 48];
    else out += ch;
  }
  return out;
}
