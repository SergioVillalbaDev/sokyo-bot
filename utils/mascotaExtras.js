// Mascota 1.15.0 — todo lo que la hace única (reglas puras, sin BD ni Discord):
// personalidad, entrenamiento (fuerza, defensa, agilidad y energía), tienda (comidas,
// accesorios y hábitats), logros, diario de recuerdos, lo que dice al hablar y los
// eventos sorpresa. Lo usan utils/mascota.js, utils/mascotaNucleo.js (combates) y el
// panel (mismos ids en src/lib/mascota.js). Tests: test/mascotaPlus.test.js.

// ---------------------------------------------------------------------------
// Personalidad: sale al nacer y cambia cómo vive.
// ---------------------------------------------------------------------------
const PERSONALIDADES = {
    glotona: { emoji: '🍩', es: 'Glotona', en: 'Greedy', desc: { es: 'Siempre tiene hambre, pero la comida le da más XP.', en: 'Always hungry, but food gives it more XP.' }, hambre: 1.3, xpComida: 1.6 },
    dormilona: { emoji: '😴', es: 'Dormilona', en: 'Sleepy', desc: { es: 'Recupera la energía el doble de rápido; se aburre menos.', en: 'Recovers energy twice as fast; gets bored less.' }, energia: 2, aburre: 0.7 },
    juguetona: { emoji: '🎾', es: 'Juguetona', en: 'Playful', desc: { es: 'Jugar con ella la alegra muchísimo, pero se aburre antes.', en: 'Playing with it cheers it up a lot, but it gets bored faster.' }, juego: 2, aburre: 1.25 },
    valiente: { emoji: '🦁', es: 'Valiente', en: 'Brave', desc: { es: '+8 % de fuerza en los combates y entrena mejor la fuerza.', en: '+8% combat power and trains strength better.' }, combate: 1.08, entrena: 'fuerza' },
    presumida: { emoji: '💅', es: 'Presumida', en: 'Vain', desc: { es: 'Con un accesorio puesto está más contenta.', en: 'Happier when it’s wearing an accessory.' }, accesorio: 8 },
    carinosa: { emoji: '💞', es: 'Cariñosa', en: 'Affectionate', desc: { es: 'Las caricias la alegran el doble.', en: 'Petting cheers it up twice as much.' }, caricia: 2 },
    lista: { emoji: '🧠', es: 'Lista', en: 'Smart', desc: { es: '+10 % de XP en todo y entrena mejor la agilidad.', en: '+10% XP on everything and trains agility better.' }, xp: 1.1, entrena: 'agilidad' },
    tozuda: { emoji: '🐏', es: 'Tozuda', en: 'Stubborn', desc: { es: 'Aguanta mejor la toxicidad y entrena mejor la defensa.', en: 'Handles toxicity better and trains defense better.' }, toxicidad: 0.5, entrena: 'defensa' },
};
const pers = (m) => PERSONALIDADES[m && m.personalidad] || {};
function personalidadAlAzar(azar = Math.random) {
    const ids = Object.keys(PERSONALIDADES);
    return ids[Math.floor(azar() * ids.length) % ids.length];
}

// ---------------------------------------------------------------------------
// Entrenamiento: tres atributos (0-100) y la energía que gasta entrenar.
// ---------------------------------------------------------------------------
const STATS = {
    fuerza: { emoji: '⚔️', es: 'Fuerza', en: 'Strength' },
    defensa: { emoji: '🛡️', es: 'Defensa', en: 'Defense' },
    agilidad: { emoji: '💨', es: 'Agilidad', en: 'Agility' },
};
const STAT_MAX = 100;
const ENERGIA_ENTRENO = 15;
const HORAS_ENTRENO = 1; // por persona
// Cuánto sube un entreno: más difícil cuanto más alto (+1 si es el de su personalidad
// y, a veces, +1 por un entreno «perfecto»).
function subidaEntreno(m, stat, azar = Math.random) {
    const actual = (m.stats && m.stats[stat]) || 5;
    if (actual >= STAT_MAX) return { sube: 0, perfecto: false };
    const base = (actual < 30 ? 3 : actual < 60 ? 2 : 1) + (pers(m).entrena === stat ? 1 : 0);
    const perfecto = azar() < 0.15;
    return { sube: Math.min(STAT_MAX - actual, base + (perfecto ? 1 : 0)), perfecto };
}
function entrenar(m, stat, azar = Math.random) {
    if (!STATS[stat]) return { fallo: 'stat' };
    if ((m.energia ?? 100) < ENERGIA_ENTRENO) return { fallo: 'energia' };
    const { sube, perfecto } = subidaEntreno(m, stat, azar);
    if (!sube) return { fallo: 'maximo' };
    const actual = (m.stats && m.stats[stat]) || 5;
    return { stat, sube, perfecto, nuevo: actual + sube, energia: Math.max(0, (m.energia ?? 100) - ENERGIA_ENTRENO) };
}

// ---------------------------------------------------------------------------
// Tienda de la mascota. Las comidas se usan al momento; accesorios y hábitats se
// quedan para siempre (los ve todo el servidor) y se pueden cambiar.
// `slot` dice dónde va el accesorio (cabeza, cara o cuello).
// ---------------------------------------------------------------------------
const COMIDAS = {
    filete: { emoji: '🍖', svg: '1f356', precio: 150, es: 'Filete', en: 'Steak', efecto: { hambre: 25 } },
    fresas: { emoji: '🍓', svg: '1f353', precio: 120, es: 'Fresas', en: 'Strawberries', efecto: { hambre: 10, alegria: 12 } },
    tarta: { emoji: '🍰', svg: '1f370', precio: 300, es: 'Tarta', en: 'Cake', efecto: { hambre: 15, alegria: 30 } },
    medicina: { emoji: '💊', svg: '1f48a', precio: 250, es: 'Medicina', en: 'Medicine', efecto: { salud: 35 } },
    batido: { emoji: '⚡', svg: '26a1', precio: 200, es: 'Batido de energía', en: 'Energy shake', efecto: { energia: 40 } },
    festin: { emoji: '🍱', svg: '1f371', precio: 700, es: 'Festín', en: 'Feast', efecto: { hambre: 60, alegria: 20, salud: 15, energia: 20 } },
};
const ACCESORIOS = {
    chistera: { emoji: '🎩', svg: '1f3a9', precio: 800, slot: 'cabeza', es: 'Chistera', en: 'Top hat' },
    gorra: { emoji: '🧢', svg: '1f9e2', precio: 500, slot: 'cabeza', es: 'Gorra', en: 'Cap' },
    birrete: { emoji: '🎓', svg: '1f393', precio: 900, slot: 'cabeza', es: 'Birrete', en: 'Graduation cap' },
    flor: { emoji: '🌸', svg: '1f338', precio: 400, slot: 'cabeza', es: 'Flor', en: 'Flower' },
    lazo: { emoji: '🎀', svg: '1f380', precio: 450, slot: 'cabeza', es: 'Lazo', en: 'Bow' },
    gafas: { emoji: '🕶️', svg: '1f576', precio: 700, slot: 'cara', es: 'Gafas de sol', en: 'Sunglasses' },
    auriculares: { emoji: '🎧', svg: '1f3a7', precio: 750, slot: 'cabeza', es: 'Auriculares', en: 'Headphones' },
    bufanda: { emoji: '🧣', svg: '1f9e3', precio: 600, slot: 'cuello', es: 'Bufanda', en: 'Scarf' },
    corona: { emoji: '👑', svg: '1f451', precio: 0, slot: 'cabeza', es: 'Corona legendaria', en: 'Legendary crown', soloLogro: 'leyenda' },
};
const HABITATS = {
    prado: { precio: 0, es: 'Prado', en: 'Meadow', fondo: ['#14532d', '#1e293b'], decor: ['1f33c', '1f343'] },
    bosque: { precio: 1200, es: 'Bosque', en: 'Forest', fondo: ['#052e16', '#14532d'], decor: ['1f332', '1f344'] },
    volcan: { precio: 1500, es: 'Volcán', en: 'Volcano', fondo: ['#450a0a', '#7c2d12'], decor: ['1f30b', '1f525'] },
    oceano: { precio: 1500, es: 'Océano', en: 'Ocean', fondo: ['#082f49', '#0c4a6e'], decor: ['1f30a', '1f41a'] },
    montana: { precio: 1500, es: 'Montaña nevada', en: 'Snowy mountain', fondo: ['#1e293b', '#334155'], decor: ['1f3d4', '2744'] },
    noche: { precio: 1800, es: 'Cielo estrellado', en: 'Starry sky', fondo: ['#020617', '#1e1b4b'], decor: ['1f319', '2b50'] },
    playa: { precio: 1800, es: 'Playa', en: 'Beach', fondo: ['#0c4a6e', '#a16207'], decor: ['1f334', '2600'] },
    castillo: { precio: 2500, es: 'Castillo', en: 'Castle', fondo: ['#1e1b4b', '#4c1d95'], decor: ['1f3f0', '2728'] },
};
const articulo = (id) => (COMIDAS[id] ? { id, tipo: 'comida', ...COMIDAS[id] } : ACCESORIOS[id] ? { id, tipo: 'accesorio', ...ACCESORIOS[id] } : HABITATS[id] ? { id, tipo: 'habitat', ...HABITATS[id] } : null);

// Lo que hace una comida. Devuelve el cambio (con tope de 100) o un error si no le hace falta.
function aplicarComida(m, id) {
    const c = COMIDAS[id];
    if (!c) return { fallo: 'articulo' };
    const cambio = {};
    let util = false;
    for (const [k, v] of Object.entries(c.efecto)) {
        const antes = m[k] ?? (k === 'energia' ? 100 : 70);
        const despues = Math.min(100, antes + v);
        if (despues > antes) util = true;
        cambio[k] = despues;
    }
    if (!util) return { fallo: 'llena' };
    return { cambio, xp: Math.round(c.precio / 15 * (pers(m).xpComida || 1)) };
}

// Posición de cada sitio del accesorio sobre cada especie (fracciones del dibujo).
const POSICIONES = {
    dragon: { cabeza: { x: 0.30, y: 0.02 }, cara: { x: 0.33, y: 0.21 }, cuello: { x: 0.40, y: 0.52 } },
    zorro: { cabeza: { x: 0.50, y: -0.05 }, cara: { x: 0.50, y: 0.45 }, cuello: { x: 0.50, y: 0.80 } },
    golem: { cabeza: { x: 0.50, y: 0.05 }, cara: { x: 0.50, y: 0.45 }, cuello: { x: 0.50, y: 0.80 } },
    fenix: { cabeza: { x: 0.43, y: 0.27 }, cara: { x: 0.43, y: 0.43 }, cuello: { x: 0.47, y: 0.58 } },
    kraken: { cabeza: { x: 0.50, y: -0.04 }, cara: { x: 0.50, y: 0.38 }, cuello: { x: 0.50, y: 0.66 } },
};
const TAM_ACCESORIO = { cabeza: 0.46, cara: 0.42, cuello: 0.38 };

// ---------------------------------------------------------------------------
// Logros: se comprueban con la mascota y sus contadores.
// ---------------------------------------------------------------------------
const LOGROS = [
    { id: 'nivel10', emoji: '🔟', es: 'Nivel 10', en: 'Level 10', ok: (m) => m.nivel >= 10 },
    { id: 'adulta', emoji: '⭐', es: 'Adulta', en: 'All grown up', ok: (m) => m.nivel >= 15 },
    { id: 'leyenda', emoji: '👑', es: 'Leyenda', en: 'Legend', ok: (m) => m.nivel >= 30 },
    { id: 'gourmet', emoji: '🍽️', es: 'Gourmet: 10.000 de oro en comida', en: 'Gourmet: 10,000 gold of food', ok: (m) => (m.contadores?.comida || 0) >= 10000 },
    { id: 'mimada', emoji: '🤲', es: 'Mimada: 100 caricias', en: 'Pampered: 100 pets', ok: (m) => (m.contadores?.caricias || 0) >= 100 },
    { id: 'atleta', emoji: '🏋️', es: 'Atleta: los 3 atributos en 30', en: 'Athlete: all 3 stats at 30', ok: (m) => Object.keys(STATS).every((s) => (m.stats?.[s] || 0) >= 30) },
    { id: 'campeona', emoji: '🏆', es: '25 combates ganados', en: '25 battles won', ok: (m) => (m.contadores?.victorias || 0) >= 25 },
    { id: 'imparable', emoji: '🔥', es: 'Racha de 5 victorias', en: '5-win streak', ok: (m) => (m.contadores?.mejorRacha || m.contadores?.racha || 0) >= 5 },
    { id: 'coqueta', emoji: '🎀', es: '5 accesorios', en: '5 accessories', ok: (m) => (m.accesorios || []).length >= 5 },
    { id: 'viajera', emoji: '🗺️', es: '3 hábitats', en: '3 habitats', ok: (m) => (m.habitats || []).length >= 3 },
    { id: 'aventurera', emoji: '🧭', es: '20 sorpresas resueltas', en: '20 surprises solved', ok: (m) => (m.contadores?.eventos || 0) >= 20 },
    { id: 'superviviente', emoji: '🌅', es: 'Despertó de una hibernación', en: 'Woke up from hibernation', ok: (m) => (m.contadores?.despertares || 0) >= 1 },
];
function logrosNuevos(m) {
    const tiene = new Set(m.logros || []);
    return LOGROS.filter((l) => !tiene.has(l.id) && l.ok(m)).map((l) => l.id);
}

// ---------------------------------------------------------------------------
// Diario de recuerdos: { tipo, fecha, datos }. Aquí, cómo se cuenta cada uno.
// ---------------------------------------------------------------------------
const MAX_DIARIO = 60;
function textoRecuerdo(r, idioma) {
    const d = r.datos || {};
    const es = idioma === 'es' || (idioma && idioma.idioma === 'es');
    const T = {
        nacio: [`🐣 Nació del huevo y la llamaron ${d.nombre}.`, `🐣 Hatched from the egg and was named ${d.nombre}.`],
        nivel: [`⬆️ Llegó al nivel ${d.nivel}.`, `⬆️ Reached level ${d.nivel}.`],
        fase: [`🌱 Creció: ahora es ${d.fase_es}.`, `🌱 Grew up: it’s now ${d.fase_en}.`],
        forma: [`✨ Se hizo adulta en su forma ${d.forma_es}.`, `✨ Became an adult in its ${d.forma_en} form.`],
        hiberna: ['💤 Se fue a hibernar: nadie la cuidaba.', '💤 Went into hibernation: nobody looked after it.'],
        despierta: [`☀️ ${d.quien || 'Alguien'} la despertó dándole de comer.`, `☀️ ${d.quien || 'Someone'} woke it up by feeding it.`],
        combate: [d.gana ? `⚔️ Ganó a ${d.rival}.` : `⚔️ Perdió contra ${d.rival}.`, d.gana ? `⚔️ Beat ${d.rival}.` : `⚔️ Lost to ${d.rival}.`],
        racha: [`🔥 ¡${d.n} victorias seguidas!`, `🔥 ${d.n} wins in a row!`],
        cuidador: [`🏅 ${d.quien} fue el Cuidador del mes.`, `🏅 ${d.quien} was Carer of the month.`],
        accesorio: [`🛍️ ${d.quien} le regaló: ${d.es}.`, `🛍️ ${d.quien} gave it: ${d.en}.`],
        habitat: [`🏞️ Se mudó a: ${d.es}.`, `🏞️ Moved to: ${d.en}.`],
        logro: [`🏆 Logro: ${d.es}.`, `🏆 Achievement: ${d.en}.`],
        evento: [`${d.es}`, `${d.en}`],
    };
    const x = T[r.tipo];
    return x ? (es ? x[0] : x[1]) : '';
}

// ---------------------------------------------------------------------------
// Lo que dice al hablar con ella (/comunidad mascota hablar): según su ánimo y su personalidad,
// y a veces se acuerda de algo del servidor.
// ---------------------------------------------------------------------------
const FRASES = {
    hambrienta: { es: ['¿Alguien tiene algo de comer? Mi barriga ruge…', 'Huelo a filete… ¿es para mí? 🥺', 'Hoy me comería una montaña de fresas.'], en: ['Anyone got food? My tummy is rumbling…', 'I smell steak… is it for me? 🥺', 'I could eat a mountain of strawberries today.'] },
    triste: { es: ['Esto está muy callado… ¿jugamos?', 'Echo de menos cuando hablabais más.', 'Me aburro un montón.'], en: ['It’s so quiet here… shall we play?', 'I miss when you all chatted more.', 'I’m sooo bored.'] },
    enferma: { es: ['No me encuentro muy bien… demasiadas peleas por aquí.', 'Una medicina me vendría genial. 🤒'], en: ['I don’t feel great… too much fighting around here.', 'Some medicine would be lovely. 🤒'] },
    feliz: { es: ['¡Hoy es un día genial! ¡Os quiero!', '¡Estoy llena de energía! ¿Entrenamos?', 'Este es el mejor servidor del mundo. 🥰'], en: ['Today is a great day! Love you all!', 'I’m full of energy! Shall we train?', 'This is the best server in the world. 🥰'] },
    bien: { es: ['Todo bien por aquí. ¿Qué tal tú?', 'Estaba pensando en mi próximo combate…', 'Me gusta este sitio.'], en: ['All good here. How about you?', 'I was thinking about my next battle…', 'I like this place.'] },
    hibernando: { es: ['Zzz… zzz… (está dormida)'], en: ['Zzz… zzz… (it’s asleep)'] },
};
const FRASES_PERS = {
    glotona: { es: ['¿Ya es la hora de comer? ¿Y ahora?', 'Soñé con una tarta gigante.'], en: ['Is it lunchtime yet? And now?', 'I dreamt of a giant cake.'] },
    dormilona: { es: ['*bosteza* … cinco minutitos más.', 'La siesta es sagrada.'], en: ['*yawns* … five more minutes.', 'Naps are sacred.'] },
    juguetona: { es: ['¡Pilla, pilla! ¡Te toca!', '¿Jugamos a los vasos? ¡Esta vez no me encuentras!'], en: ['Tag, you’re it!', 'Cups game? You won’t find me this time!'] },
    valiente: { es: ['¡Que venga quien sea, no tengo miedo!', 'Hoy gano el combate, seguro.'], en: ['Bring it on, I’m not scared!', 'I’m winning today’s battle for sure.'] },
    presumida: { es: ['¿A que hoy estoy guapísima?', 'Me vendría bien un accesorio nuevo… 💅'], en: ['Don’t I look gorgeous today?', 'A new accessory would suit me… 💅'] },
    carinosa: { es: ['¡Abrazo! 🤗', 'Me encanta cuando me acariciáis.'], en: ['Hug! 🤗', 'I love it when you pet me.'] },
    lista: { es: ['¿Sabías que los pulpos tienen tres corazones?', 'He estado leyendo los canales… sois muy graciosos.'], en: ['Did you know octopuses have three hearts?', 'I’ve been reading the channels… you’re all very funny.'] },
    tozuda: { es: ['No pienso moverme de aquí.', 'Lo haré a mi manera, gracias.'], en: ['I’m not moving from here.', 'I’ll do it my way, thanks.'] },
};
function frase(m, idioma, azar = Math.random, recuerdo = null) {
    const es = idioma === 'es' || (idioma && idioma.idioma === 'es');
    const { animoDe } = require('./mascotaNucleo.js');
    const animo = animoDe(m);
    const opciones = [...((FRASES[animo] || FRASES.bien)[es ? 'es' : 'en'])];
    if (animo !== 'hibernando' && FRASES_PERS[m.personalidad]) opciones.push(...FRASES_PERS[m.personalidad][es ? 'es' : 'en']);
    if (animo !== 'hibernando' && recuerdo) opciones.push(es ? `¿Os acordáis? ${recuerdo}` : `Remember? ${recuerdo}`);
    return opciones[Math.floor(azar() * opciones.length) % opciones.length];
}

// ---------------------------------------------------------------------------
// Sorpresas en el canal (como mucho unas pocas al día):
//   tesoro   → «¡Cógelo!»: el primero se lleva oro
//   perdida  → «Buscarla»: el primero la encuentra (puntos de cuidado y oro)
//   adivina  → piensa un número del 1 al 5: el primero que acierta gana
// ---------------------------------------------------------------------------
const EVENTOS = ['tesoro', 'perdida', 'adivina'];
const MIN_EVENTO = { tesoro: 10, perdida: 30, adivina: 15 };
function eventoAlAzar(azar = Math.random) {
    const tipo = EVENTOS[Math.floor(azar() * EVENTOS.length) % EVENTOS.length];
    return { tipo, premio: 60 + Math.floor(azar() * 5) * 30, respuesta: tipo === 'adivina' ? 1 + Math.floor(azar() * 5) % 5 : null };
}
// ¿Toca una sorpresa ahora? Entre las 10 y las 22 UTC, separadas al menos 24/porDía horas.
function tocaEvento(m, porDia, ahora = new Date(), azar = Math.random) {
    if (!porDia || m.hibernando || m.estado !== 'viva') return false;
    if (m.evento && m.evento.id && !m.evento.resuelto) return false;
    const h = ahora.getUTCHours();
    if (h < 10 || h >= 22) return false;
    const separacion = (12 / Math.max(1, Math.min(4, porDia))) * 3600000;
    if (m.ultimoEvento && ahora - new Date(m.ultimoEvento) < separacion) return false;
    return azar() < 0.25; // la pasada es cada 5 min: sale en algún momento, no a una hora fija
}

// ---------------------------------------------------------------------------
// Habilidad especial de cada especie en combate (se usa una vez, cuando va perdiendo).
// ---------------------------------------------------------------------------
const ESPECIALES = {
    dragon: { es: 'Aliento de dragón', en: 'Dragon’s Breath', mult: 1.45 },
    zorro: { es: 'Ilusión de zorro', en: 'Fox Illusion', reduceRival: 0.6 },
    golem: { es: 'Muro de piedra', en: 'Stone Wall', reduceRival: 0.7, mult: 1.1 },
    fenix: { es: 'Renacer', en: 'Rebirth', mult: 1.6 },
    kraken: { es: 'Abrazo del abismo', en: 'Abyss Embrace', mult: 1.25, reduceRival: 0.85 },
};

module.exports = {
    PERSONALIDADES, personalidadAlAzar, pers,
    STATS, STAT_MAX, ENERGIA_ENTRENO, HORAS_ENTRENO, subidaEntreno, entrenar,
    COMIDAS, ACCESORIOS, HABITATS, articulo, aplicarComida, POSICIONES, TAM_ACCESORIO,
    LOGROS, logrosNuevos, MAX_DIARIO, textoRecuerdo, frase,
    EVENTOS, MIN_EVENTO, eventoAlAzar, tocaEvento, ESPECIALES,
};
