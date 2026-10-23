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

// Parchea letras sueltas que viven fuera del bloque contiguo (huecos del Unicode).
// `parches` = { upper: {indice: codePoint}, lower: {...} }.
const parchear = (mapa, parches = {}) => {
  for (const [caso, dict] of Object.entries(parches)) {
    for (const [i, cp] of Object.entries(dict)) mapa[caso][Number(i)] = String.fromCodePoint(cp);
  }
  return mapa;
};

// Doble trazo (double-struck): algunas mayúsculas viven en el bloque Letterlike.
const doble = parchear(desde(0x1D538, 0x1D552, 0x1D7D8), {
  upper: { 2: 0x2102, 7: 0x210D, 13: 0x2115, 15: 0x2119, 16: 0x211A, 17: 0x211D, 25: 0x2124 },
});

// Cursiva serif: la 'h' minúscula está en el bloque Letterlike (ℎ).
const cursivaSerif = parchear(desde(0x1D434, 0x1D44E, null), { lower: { 7: 0x210E } });

// Manuscrita (script regular): bastantes huecos en mayúsculas y minúsculas.
const script = parchear(desde(0x1D49C, 0x1D4B6, null), {
  upper: { 1: 0x212C, 4: 0x2130, 5: 0x2131, 7: 0x210B, 8: 0x2110, 11: 0x2112, 12: 0x2133, 17: 0x211B },
  lower: { 4: 0x212F, 6: 0x210A, 14: 0x2134 },
});

// Gótica (fraktur regular): huecos en C, H, I, R, Z.
const fraktur = parchear(desde(0x1D504, 0x1D51E, null), {
  upper: { 2: 0x212D, 7: 0x210C, 8: 0x2111, 17: 0x211C, 25: 0x2128 },
});

// Círculo: letras contiguas, pero los dígitos van aparte (⓪ ① …).
const circulo = desde(0x24B6, 0x24D0, null);
circulo.digits = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];

// Versalitas (small caps): no hay bloque contiguo; mapa explícito a-z.
const SC = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ꞯ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
const versalitasArr = 'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => SC[c]);

// Mapas por estilo. (los que no tienen dígitos propios dejan los números normales.)
const MAPAS = {
  negrita: desde(0x1D5D4, 0x1D5EE, 0x1D7EC),          // sans-serif bold
  cursiva: desde(0x1D608, 0x1D622, null),             // sans-serif italic
  manuscrita: desde(0x1D4D0, 0x1D4EA, null),          // script bold
  gotica: desde(0x1D56C, 0x1D586, null),              // fraktur bold
  doble,                                              // double-struck
  monospace: desde(0x1D670, 0x1D68A, 0x1D7F6),        // monospace
  versalitas: { upper: versalitasArr, lower: versalitasArr, digits: null },
  // --- Estilos extra (constructor de embeds) ---
  negritaserif: desde(0x1D400, 0x1D41A, 0x1D7CE),     // serif bold
  cursivaserif: cursivaSerif,                          // serif italic
  negritacursiva: desde(0x1D468, 0x1D482, null),       // serif bold italic
  script,                                              // script regular
  fraktur,                                             // fraktur regular
  ancho: desde(0xFF21, 0xFF41, 0xFF10),                // fullwidth
  circulo,                                             // circled
};

// Lista de estilos del selector de ROLES (no tocar: tiene i18n propia en roles_v.fonts).
export const ESTILOS_FUENTE = ['normal', 'negrita', 'cursiva', 'manuscrita', 'gotica', 'doble', 'monospace', 'versalitas'];

// Lista ampliada para el constructor de EMBEDS (las opciones se muestran con su
// propia tipografía, así que no necesitan traducción).
export const ESTILOS_FUENTE_EMBED = [
  'normal', 'negrita', 'negritaserif', 'cursiva', 'cursivaserif', 'negritacursiva',
  'manuscrita', 'script', 'gotica', 'fraktur', 'doble', 'monospace', 'ancho', 'versalitas', 'circulo',
];

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

// Mapa inverso (carácter de fantasía → carácter normal), construido una vez.
// Minúsculas primero: en estilos sin distinción de caja (versalitas) el revertir
// devuelve minúsculas, que queda más natural que dejarlo TODO EN MAYÚSCULAS.
const INVERSO = {};
for (const m of Object.values(MAPAS)) {
  m.lower.forEach((ch, i) => { if (INVERSO[ch] === undefined) INVERSO[ch] = String.fromCodePoint(97 + i); });
  m.upper.forEach((ch, i) => { if (INVERSO[ch] === undefined) INVERSO[ch] = String.fromCodePoint(65 + i); });
  if (m.digits) m.digits.forEach((ch, i) => { if (INVERSO[ch] === undefined) INVERSO[ch] = String(i); });
}

// Devuelve el texto sin estilos de fantasía (a caracteres normales).
export function quitarEstilo(texto) {
  if (!texto) return texto;
  let out = '';
  for (const ch of texto) out += INVERSO[ch] !== undefined ? INVERSO[ch] : ch;
  return out;
}

// Aplica un estilo normalizando primero (permite cambiar de un estilo a otro).
export function estilizar(texto, estiloId) {
  return aplicarEstilo(quitarEstilo(texto), estiloId);
}
