// 🏠 Casa del compañero (1.33.0) — reglas puras (test/casa.test.js). Muebles que se compran con oro y se colocan
// en los huecos de la habitación (suelo, pared, alfombra y techo), papel pintado y «me gusta» de las visitas.
// La comodidad (confort) de lo colocado sube la producción de la granja: +BONUS_POR_CONFORT por punto, hasta BONUS_MAX.
const SLOTS = { suelo: 4, pared: 3, alfombra: 1, techo: 1 };
const MUEBLES = {
    planta: { slot: 'suelo', precio: 300, confort: 2, emoji: '🪴', es: 'Planta', en: 'Plant' },
    mesa: { slot: 'suelo', precio: 500, confort: 2, emoji: '☕', es: 'Mesita con taza', en: 'Little table' },
    cama: { slot: 'suelo', precio: 600, confort: 4, emoji: '🛏️', es: 'Camita mullida', en: 'Fluffy pet bed' },
    juguetes: { slot: 'suelo', precio: 700, confort: 4, emoji: '🧸', es: 'Caja de juguetes', en: 'Toy box' },
    estanteria: { slot: 'suelo', precio: 900, confort: 3, emoji: '📚', es: 'Estantería', en: 'Bookshelf' },
    sofa: { slot: 'suelo', precio: 1200, confort: 6, emoji: '🛋️', es: 'Sofá', en: 'Sofa' },
    acuario: { slot: 'suelo', precio: 2500, confort: 6, emoji: '🐠', es: 'Acuario', en: 'Aquarium' },
    consola: { slot: 'suelo', precio: 3000, confort: 7, emoji: '🎮', es: 'Tele y consola', en: 'TV and console' },
    chimenea: { slot: 'suelo', precio: 5000, confort: 9, emoji: '🔥', es: 'Chimenea', en: 'Fireplace' },
    trono: { slot: 'suelo', precio: 12000, confort: 12, emoji: '👑', es: 'Trono de peluche', en: 'Plush throne' },
    cuadro: { slot: 'pared', precio: 400, confort: 2, emoji: '🖼️', es: 'Cuadro', en: 'Painting' },
    reloj: { slot: 'pared', precio: 600, confort: 2, emoji: '🕰️', es: 'Reloj', en: 'Clock' },
    guirnalda: { slot: 'pared', precio: 800, confort: 3, emoji: '✨', es: 'Guirnalda de luces', en: 'Fairy lights' },
    trofeos: { slot: 'pared', precio: 2000, confort: 5, emoji: '🏆', es: 'Estante de trofeos', en: 'Trophy shelf' },
    alfombra: { slot: 'alfombra', precio: 500, confort: 2, emoji: '🟠', es: 'Alfombra redonda', en: 'Round rug' },
    arcoiris: { slot: 'alfombra', precio: 1800, confort: 4, emoji: '🌈', es: 'Alfombra arcoíris', en: 'Rainbow rug' },
    lampara: { slot: 'techo', precio: 700, confort: 2, emoji: '💡', es: 'Lámpara', en: 'Lamp' },
    arana: { slot: 'techo', precio: 4000, confort: 6, emoji: '🕯️', es: 'Lámpara de araña', en: 'Chandelier' },
};
const PAPELES = {
    crema: { precio: 0, confort: 0, pared: ['#fde68a', '#fcd34d'], suelo: ['#b45309', '#78350f'], dibujo: 'rayas', emoji: '🟨', es: 'Crema', en: 'Cream' },
    menta: { precio: 300, confort: 1, pared: ['#a7f3d0', '#6ee7b7'], suelo: ['#a16207', '#713f12'], dibujo: 'puntos', emoji: '🟩', es: 'Menta', en: 'Mint' },
    lavanda: { precio: 300, confort: 1, pared: ['#ddd6fe', '#c4b5fd'], suelo: ['#92400e', '#451a03'], dibujo: 'rayas', emoji: '🟪', es: 'Lavanda', en: 'Lavender' },
    rosa: { precio: 300, confort: 1, pared: ['#fbcfe8', '#f9a8d4'], suelo: ['#9a3412', '#431407'], dibujo: 'corazones', emoji: '🩷', es: 'Rosa', en: 'Pink' },
    cielo: { precio: 500, confort: 2, pared: ['#bae6fd', '#7dd3fc'], suelo: ['#64748b', '#334155'], dibujo: 'nubes', emoji: '🟦', es: 'Cielo', en: 'Sky' },
    madera: { precio: 800, confort: 2, pared: ['#d6a06a', '#b07845'], suelo: ['#57534e', '#292524'], dibujo: 'tablas', emoji: '🟫', es: 'Cabaña', en: 'Log cabin' },
    noche: { precio: 1200, confort: 3, pared: ['#312e81', '#1e1b4b'], suelo: ['#3f3f46', '#18181b'], dibujo: 'estrellas', emoji: '🌌', es: 'Noche estrellada', en: 'Starry night' },
};
const BONUS_POR_CONFORT = 0.01;
const BONUS_MAX = 0.25;
const LIKES_DIA = 1; // «me gusta» por visitante, casa y día

const clavesSlot = (slot) => [...Array(SLOTS[slot])].map((_, i) => `${slot}${i}`);
// Confort de lo colocado (y del papel).
function confort(casa = {}) {
    const puestos = Object.values(casa.puestos || {}).filter((id) => MUEBLES[id]);
    return puestos.reduce((a, id) => a + MUEBLES[id].confort, 0) + (PAPELES[casa.papel]?.confort || 0);
}
const bonusGranja = (casa) => Math.min(BONUS_MAX, confort(casa) * BONUS_POR_CONFORT);
// Coloca (o quita, si ya está puesto) un mueble que se tiene. Si su tipo de hueco está lleno, sustituye al
// primero. Devuelve los puestos nuevos o { fallo }.
function colocar(casa = {}, id) {
    const d = MUEBLES[id];
    if (!d) return { fallo: 'mueble' };
    if (!(casa.muebles || []).includes(id)) return { fallo: 'noTiene' };
    const puestos = { ...(casa.puestos || {}) };
    const donde = Object.keys(puestos).find((k) => puestos[k] === id);
    if (donde) { delete puestos[donde]; return { puestos, quitado: true }; }
    const libre = clavesSlot(d.slot).find((k) => !puestos[k]);
    const k = libre || clavesSlot(d.slot)[0];
    const sustituido = libre ? null : puestos[k];
    puestos[k] = id;
    return { puestos, quitado: false, sustituido, hueco: k };
}
const puedeDarLike = (casa = {}, visitante, dueno, dia) => visitante !== dueno && (casa.likeDe?.[visitante] !== dia);

module.exports = { SLOTS, MUEBLES, PAPELES, BONUS_POR_CONFORT, BONUS_MAX, LIKES_DIA, clavesSlot, confort, bonusGranja, colocar, puedeDarLike };
