// Compañeros tipo tamagotchi (1.20.0) — reglas puras, sin base de datos ni Discord.
// Cada compañero de tu colección (utils/cofresNucleo.js) tiene hambre, alegría y
// energía, que cambian con el tiempo; afinidad (sube al cuidarlo) que da nivel; puede
// irse de expedición y volver con oro y recuerdos; y hay misiones del día y racha.
// Sin castigos: si no lo cuidas no le pasa nada malo, solo deja de dar el extra de
// «feliz». El oro de aquí es modesto y con tope diario (no es para farmear).
const K = require('./cofresNucleo.js');
const { GENERAL, VOCES, EXTRA } = require('./compisFrases.js');

const HORA = 3600000;
const LLENO = 80;                 // cómo empieza un compañero nuevo
const RITMO = { hambre: -3, alegria: -2, energia: 6 }; // por hora
const lim = (v) => Math.max(0, Math.min(100, Math.round(v)));

// Cómo está ahora (lo guardado + el tiempo que ha pasado). Si está de expedición, no gasta.
function estado(m, ahora = Date.now()) {
    const desde = m.actualizado ? new Date(m.actualizado).getTime() : ahora;
    const h = Math.max(0, (ahora - desde) / HORA);
    const base = (k) => (typeof m[k] === 'number' ? m[k] : LLENO);
    const fuera = expedicionActiva(m, ahora);
    // Habilidades exclusivas (1.24.0): comer menos, alegrarse más, descansar más rápido.
    const hab = K.habilidad(m.id);
    const k = (tipo) => (hab && hab.tipo === tipo ? hab.valor : 0);
    return {
        hambre: lim(base('hambre') + (fuera ? 0 : RITMO.hambre * (1 - k('gloton')) * h)),
        alegria: lim(base('alegria') + (fuera ? 0 : RITMO.alegria * (1 - k('alegre')) * h)),
        energia: lim(base('energia') + (fuera ? 0 : RITMO.energia * (1 + k('incansable')) * h)),
    };
}
// Afinidad que gana de verdad (con la habilidad «afin», más).
function conAfinidad(m, n) {
    const hab = K.habilidad(m.id);
    return Math.round(n * (1 + (hab && hab.tipo === 'afin' ? hab.valor : 0)));
}
// Qué le pasa, de lo más urgente a lo mejor.
function humor(e) {
    if (e.hambre < 25) return 'hambre';
    if (e.energia < 20) return 'cansado';
    if (e.alegria < 25) return 'aburrido';
    if (e.hambre >= 60 && e.alegria >= 60 && e.energia >= 40) return 'feliz';
    return 'normal';
}
const HUMOR = {
    hambre: { emoji: '🍖', es: 'Tiene hambre', en: 'Hungry' },
    cansado: { emoji: '😴', es: 'Está cansado', en: 'Tired' },
    aburrido: { emoji: '🥱', es: 'Se aburre', en: 'Bored' },
    feliz: { emoji: '💖', es: '¡Feliz!', en: 'Happy!' },
    normal: { emoji: '🙂', es: 'Tranquilo', en: 'Calm' },
    fuera: { emoji: '🧭', es: 'De expedición', en: 'On an expedition' },
};

// Afinidad → nivel (1..30). Para el nivel n hacen falta 10·(n-1)² puntos.
const NIVEL_MAX = 30;
const umbral = (n) => 10 * (n - 1) * (n - 1);
function nivel(afinidad = 0) {
    let n = 1;
    while (n < NIVEL_MAX && afinidad >= umbral(n + 1)) n++;
    return n;
}
function progresoNivel(afinidad = 0) {
    const n = nivel(afinidad);
    if (n >= NIVEL_MAX) return { nivel: n, actual: 1, total: 1, max: true };
    return { nivel: n, actual: afinidad - umbral(n), total: umbral(n + 1) - umbral(n), max: false };
}
// Lo que suma el cuidado a sus ventajas: +1 % por nivel y +10 % si está feliz.
function extraCuidado(m, ahora = Date.now()) {
    const n = nivel(m.afinidad || 0);
    const feliz = humor(estado(m, ahora)) === 'feliz';
    return Math.round(((n - 1) * 0.01 + (feliz ? 0.10 : 0)) * 1000) / 1000;
}

// Cuidados. Devuelven los valores nuevos a guardar y la afinidad ganada. La afinidad
// solo sube si el cuidado hacía falta (no sirve repetir el botón cien veces).
const CUIDADOS = {
    comer: { emoji: '🍖', sube: { hambre: 35 }, afinidad: 5, siHaceFalta: 'hambre' },
    jugar: { emoji: '🎾', sube: { alegria: 30, energia: -15, hambre: -5 }, afinidad: 6, siHaceFalta: 'alegria', energia: 15 },
    mimar: { emoji: '🤗', sube: { alegria: 12 }, afinidad: 3, siHaceFalta: 'alegria', espera: 10 * 60000 },
};
function cuidar(m, accion, ahora = Date.now()) {
    const c = CUIDADOS[accion];
    if (!c) return { fallo: 'accion' };
    if (expedicionActiva(m, ahora)) return { fallo: 'fuera' };
    const e = estado(m, ahora);
    if (c.energia && e.energia < c.energia) return { fallo: 'energia', e };
    if (accion === 'comer' && e.hambre >= 95) return { fallo: 'lleno', e };
    const hacia = e[c.siHaceFalta] < 90;
    const esperaMimo = c.espera && m.ultMimo && ahora - new Date(m.ultMimo).getTime() < c.espera;
    const gana = hacia && !esperaMimo ? conAfinidad(m, c.afinidad) : 0;
    const nuevo = { ...e };
    for (const [k, v] of Object.entries(c.sube)) nuevo[k] = lim(nuevo[k] + v);
    return { ...nuevo, afinidad: gana, antes: e, humor: humor(nuevo) };
}

// Expediciones: se va un rato y vuelve con oro (y a veces un recuerdo). Gasta energía.
const EXPEDICIONES = {
    paseo: { emoji: '🌳', horas: 1, energia: 20, oro: [20, 40], afinidad: 8, recuerdo: 0.25, es: 'Paseo por el bosque', en: 'Forest walk' },
    aventura: { emoji: '⛰️', horas: 4, energia: 40, oro: [70, 130], afinidad: 20, recuerdo: 0.5, es: 'Aventura en la montaña', en: 'Mountain adventure' },
    viaje: { emoji: '🏝️', horas: 8, energia: 60, oro: [140, 240], afinidad: 40, recuerdo: 0.8, es: 'Gran viaje a la isla', en: 'Big island trip' },
};
const EXPEDICIONES_DIA = 4;
const RECUERDOS = [
    ['🐚', 'Concha brillante', 'Shiny shell'], ['🍄', 'Seta saltarina', 'Bouncy mushroom'], ['🪶', 'Pluma dorada', 'Golden feather'],
    ['💎', 'Cristal de cueva', 'Cave crystal'], ['🗝️', 'Llave misteriosa', 'Mysterious key'], ['📜', 'Mapa antiguo', 'Ancient map'],
    ['🌸', 'Flor de cerezo', 'Cherry blossom'], ['⭐', 'Estrella caída', 'Fallen star'], ['🪨', 'Piedra con forma de corazón', 'Heart-shaped stone'],
    ['🍀', 'Trébol de cuatro hojas', 'Four-leaf clover'], ['🧭', 'Brújula rota', 'Broken compass'], ['🎐', 'Campanilla de viento', 'Wind chime'],
    ['🦴', 'Hueso de dinosaurio', 'Dinosaur bone'], ['🍯', 'Tarro de miel', 'Jar of honey'], ['🏮', 'Farolillo de papel', 'Paper lantern'],
    ['🪀', 'Yoyó perdido', 'Lost yo-yo'], ['🧸', 'Peluche viejo', 'Old plushie'], ['🎴', 'Carta rara', 'Rare card'],
    ['🌙', 'Trocito de luna', 'Piece of the moon'], ['🫧', 'Burbuja que no explota', 'Bubble that never pops'], ['🪐', 'Mini planeta', 'Tiny planet'],
    ['🎀', 'Lazo de princesa', 'Princess ribbon'], ['⚔️', 'Espada de madera', 'Wooden sword'], ['🔮', 'Bola de cristal', 'Crystal ball'],
];
function expedicionActiva(m, ahora = Date.now()) {
    return !!(m.exp && m.exp.hasta && new Date(m.exp.hasta).getTime() > ahora);
}
function expedicionLista(m, ahora = Date.now()) {
    return !!(m.exp && m.exp.hasta && new Date(m.exp.hasta).getTime() <= ahora);
}
// ¿Puede salir? `hoy` = { dia, n } de la colección.
function salir(m, tipo, hoy, dia, ahora = Date.now()) {
    const x = EXPEDICIONES[tipo];
    if (!x) return { fallo: 'tipo' };
    if (m.exp && m.exp.hasta) return { fallo: expedicionActiva(m, ahora) ? 'fuera' : 'recoger' };
    const usadas = hoy && hoy.dia === dia ? hoy.n || 0 : 0;
    if (usadas >= EXPEDICIONES_DIA) return { fallo: 'tope' };
    const e = estado(m, ahora);
    if (e.energia < x.energia) return { fallo: 'energia', e };
    const hab = K.habilidad(m.id);
    const horas = x.horas * (1 - (hab && hab.tipo === 'rapido' ? hab.valor : 0));
    return { ...e, energia: lim(e.energia - x.energia), exp: { tipo, desde: new Date(ahora), hasta: new Date(ahora + horas * HORA) }, usadas: usadas + 1 };
}
// Lo que trae al volver. Más rareza y más nivel → algo más de oro.
function botin(m, azar = Math.random) {
    const x = EXPEDICIONES[m.exp?.tipo];
    if (!x) return { oro: 0, afinidad: 0, recuerdo: null };
    // Más oro según su rareza y estrellas (ventaja «expedicion») y su nivel de afinidad.
    const k = 1 + K.ventajas(m.id, m.estrellas || 1).expedicion + 0.01 * (nivel(m.afinidad || 0) - 1);
    // Una carta (p. ej. 🍀 suerte) puede haber dejado el botín multiplicado (m.botinX).
    const oro = Math.round((x.oro[0] + azar() * (x.oro[1] - x.oro[0])) * k * Math.max(1, m.botinX || 1));
    const hab = K.habilidad(m.id);
    const tesoro = hab && hab.tipo === 'tesoro';
    const recuerdo = tesoro || azar() < x.recuerdo ? Math.floor(azar() * RECUERDOS.length) : null;
    return { oro, afinidad: conAfinidad(m, x.afinidad), recuerdo };
}

// Interacciones que se desbloquean con la rareza (1.21.0). `rareza` = orden mínimo
// (1 rara … 5 divina). `espera` en minutos: hasta que pasa no se puede repetir.
const INTERACCIONES = {
    banar: { emoji: '🛁', rareza: 1, cambia: { alegria: 8 }, afinidad: 3, espera: 30, es: 'Darle un baño', en: 'Give it a bath' },
    foto: { emoji: '📸', rareza: 1, cambia: { alegria: 4 }, afinidad: 2, espera: 30, es: 'Hacerle una foto', en: 'Take its photo' },
    entrenar: { emoji: '💪', rareza: 2, cambia: { energia: -20, hambre: -8 }, afinidad: 8, espera: 60, energia: 20, es: 'Entrenar juntos', en: 'Train together' },
    bailar: { emoji: '💃', rareza: 2, cambia: { alegria: 15, energia: -10 }, afinidad: 5, espera: 30, energia: 10, es: 'Bailar', en: 'Dance' },
    regalo: { emoji: '🎁', rareza: 3, cambia: { alegria: 5 }, afinidad: 5, espera: 20 * 60, oro: [60, 150], recuerdo: 0.3, es: 'Pedirle su regalo del día', en: 'Ask for its daily gift' },
    historia: { emoji: '📖', rareza: 3, cambia: { alegria: 10 }, afinidad: 4, espera: 60, es: 'Que te cuente una historia', en: 'Hear a story' },
    meditar: { emoji: '🧘', rareza: 4, cambia: { energia: 40 }, afinidad: 4, espera: 6 * 60, es: 'Meditar juntos', en: 'Meditate together' },
    confidencia: { emoji: '💌', rareza: 4, cambia: { alegria: 12 }, afinidad: 6, espera: 120, es: 'Contaros secretos', en: 'Share secrets' },
    milagro: { emoji: '🌈', rareza: 5, cambia: { hambre: 30, alegria: 30, energia: 30 }, afinidad: 10, espera: 12 * 60, es: 'Pedirle un milagro', en: 'Ask for a miracle' },
};
const ordenDe = (m) => K.RAREZAS[K.def(m.id).rareza]?.orden || 0;
const interaccionesDe = (m) => Object.keys(INTERACCIONES).filter((id) => ordenDe(m) >= INTERACCIONES[id].rareza);
const MIN = 60000;
// Minutos que faltan para poder repetirla (0 = ya se puede).
function falta(m, id, ahora = Date.now()) {
    const x = INTERACCIONES[id];
    const ult = m.cds && m.cds[id] ? new Date(m.cds[id]).getTime() : 0;
    return Math.max(0, Math.ceil((ult + x.espera * MIN - ahora) / MIN));
}
function interactuar(m, id, ahora = Date.now(), azar = Math.random) {
    const x = INTERACCIONES[id];
    if (!x) return { fallo: 'accion' };
    if (ordenDe(m) < x.rareza) return { fallo: 'rareza', rareza: x.rareza };
    if (expedicionActiva(m, ahora)) return { fallo: 'fuera' };
    const f = falta(m, id, ahora);
    if (f) return { fallo: 'espera', min: f };
    const e = estado(m, ahora);
    if (x.energia && e.energia < x.energia) return { fallo: 'energia', e };
    const nuevo = { ...e };
    for (const [k, v] of Object.entries(x.cambia)) nuevo[k] = lim(nuevo[k] + v);
    const oro = x.oro ? Math.round(x.oro[0] + azar() * (x.oro[1] - x.oro[0])) : 0;
    const recuerdo = x.recuerdo && azar() < x.recuerdo ? Math.floor(azar() * RECUERDOS.length) : null;
    return { ...nuevo, afinidad: conAfinidad(m, x.afinidad), oro, recuerdo, cds: { ...(m.cds || {}), [id]: new Date(ahora) }, humor: humor(nuevo) };
}

// Poder del día: uno por persona cada 20 h, según la rareza del compañero.
const PODER_ESPERA_H = 20;
const PODERES = [
    { id: 'olfato', emoji: '👃', oro: [20, 50], es: 'Olfato: encuentra algo de oro', en: 'Sniff: finds some gold' },
    { id: 'olfato', emoji: '👃', oro: [40, 90], es: 'Olfato: encuentra oro', en: 'Sniff: finds gold' },
    { id: 'inspiracion', emoji: '💡', xp: 0.3, horas: 1, es: 'Inspiración: +30 % de XP durante 1 h', en: 'Inspiration: +30% XP for 1 h' },
    { id: 'escudo', emoji: '🛡️', horas: 6, es: 'Escudo: nadie te gasta bromas en 6 h (o +30 % de XP 2 h si no hay bromas)', en: 'Shield: no pranks on you for 6 h (or +30% XP for 2 h if pranks are off)' },
    { id: 'prisa', emoji: '⚡', es: 'Prisa: vuelve ya de la expedición (o lo deja todo al 100)', en: 'Rush: comes back from the expedition now (or fills everything to 100)' },
    { id: 'bendicion', emoji: '🌈', xp: 1, horas: 2, es: 'Bendición: +100 % de XP 2 h y todo al 100', en: 'Blessing: +100% XP for 2 h and everything to 100' },
];
// Cartas de anime (1.24.0): cada personaje del Pack anime es una CARTA con su poder según su
// personalidad (data/animePoderes.txt). Al usarla sobre tu mascota hace lo de su tipo; la fuerza
// la dan la rareza de la carta (FUERZA), sus estrellas (+10 % cada una) y la habilidad de la
// mascota («cartas»/«divino»). Efectos: potencia (+% a las ventajas de ESA mascota un rato),
// botin (su próxima expedición trae ×N oro), volver, lleno, energia, alegria, afinidad, recuerdo,
// xp (para ti), oro, escudo (anti-bromas), caos (uno al azar).
const ARQUETIPOS = {
    tiempo: { emoji: '🕰️', efecto: { volver: true, lleno: true } },
    fuerza: { emoji: '💪', efecto: { potencia: 0.40, min: 60, energia: true } },
    velocidad: { emoji: '⚡', efecto: { volver: true, energia: true, xp: 0.10, min: 60 } },
    fuego: { emoji: '🔥', efecto: { xp: 0.35, min: 45, potencia: 0.15 } },
    hielo: { emoji: '❄️', efecto: { escudo: 4, alegria: true } },
    mente: { emoji: '🧠', efecto: { oro: [40, 90], xp: 0.10, min: 60 } },
    curar: { emoji: '💚', efecto: { lleno: true, afinidad: 10 } },
    sombra: { emoji: '🥷', efecto: { escudo: 3, oro: [20, 40] } },
    suerte: { emoji: '🍀', efecto: { botin: 2, oro: [30, 60] } },
    lider: { emoji: '👑', efecto: { potencia: 0.60, min: 120 } },
    espada: { emoji: '⚔️', efecto: { potencia: 0.35, min: 60, xp: 0.15 } },
    magia: { emoji: '🔮', efecto: { potencia: 0.30, min: 60, lleno: true } },
    comida: { emoji: '🍙', efecto: { lleno: true, afinidad: 8 } },
    musica: { emoji: '🎤', efecto: { afinidad: 15, alegria: true, potencia: 0.15, min: 60 } },
    defensa: { emoji: '🛡️', efecto: { escudo: 6, energia: true } },
    oscuro: { emoji: '🌑', efecto: { xp: 0.40, min: 30, escudo: 2 } },
    tecno: { emoji: '🤖', efecto: { oro: [60, 110], botin: 1.5 } },
    bestia: { emoji: '🐾', efecto: { potencia: 0.45, min: 45, energia: true } },
    detective: { emoji: '🔍', efecto: { recuerdo: true, botin: 1.5, oro: [20, 40] } },
    vago: { emoji: '😴', efecto: { energia: true, lleno: true, xp: 0.10, min: 120 } },
    amistad: { emoji: '🤝', efecto: { afinidad: 20, lleno: true, potencia: 0.20, min: 60 } },
    caos: { emoji: '🃏', efecto: { caos: true } },
    deporte: { emoji: '🏐', efecto: { xp: 0.20, min: 90, energia: true } },
    amor: { emoji: '💘', efecto: { afinidad: 25, alegria: true } },
    vampiro: { emoji: '🦇', efecto: { xp: 0.30, min: 60, escudo: 2 } },
};
const FUERZA = [0.6, 0.8, 1, 1.25, 1.6, 2.2];
// Lo que hace la carta `cartaId` con `estrellas`, usada en la mascota `mascotaId` (o null).
function efectoCarta(cartaId, estrellas = 1, mascotaId = null) {
    const d = K.def(cartaId);
    if (!d.poder || !ARQUETIPOS[d.poder.tipo]) return null;
    const orden = K.RAREZAS[d.rareza]?.orden || 0;
    const hab = mascotaId ? K.habilidad(mascotaId) : null;
    const extraMascota = hab && (hab.tipo === 'cartas' || hab.tipo === 'divino') ? hab.valor : 0;
    const f = (FUERZA[orden] || 1) * (1 + 0.1 * (Math.max(1, Math.min(5, estrellas)) - 1)) * (1 + extraMascota);
    const e = { ...ARQUETIPOS[d.poder.tipo].efecto };
    if (e.oro) e.oro = e.oro.map((x) => Math.round(x * f));
    if (e.xp) e.xp = Math.min(1.5, Math.round(e.xp * f * 100) / 100);
    if (e.potencia) e.potencia = Math.min(2, Math.round(e.potencia * f * 100) / 100);
    if (e.botin) e.botin = Math.min(4, Math.round(e.botin * Math.sqrt(f) * 10) / 10);
    if (e.escudo) e.escudo = Math.round(e.escudo * f * 10) / 10;
    if (e.afinidad) e.afinidad = Math.round(e.afinidad * f);
    if (e.caos) e.f = f;
    if (orden >= 5) { e.xp = 1; e.min = 120; e.lleno = true; e.potencia = 1; } // la divina (Kurumi): todo
    return e;
}
const efectoAnime = (m) => efectoCarta(m.id, m.estrellas || 1, null);
// Convierte un efecto en lo que pasa (sin guardar nada). `m` = la mascota que lo recibe.
function aplicarEfecto(e, m, { ahora = Date.now(), bromas = false, azar = Math.random } = {}) {
    const r = {};
    if (e.caos) { // 🃏 caos: una de tres cosas, a la suerte
        const f = e.f || 1; const x = azar();
        e = x < 0.34 ? { oro: [Math.round(40 * f), Math.round(140 * f)] } : x < 0.67 ? { xp: Math.min(1.5, Math.round(0.4 * f * 100) / 100), min: 45 } : { potencia: Math.min(2, Math.round(0.5 * f * 100) / 100), min: 60 };
    }
    if (e.oro) r.oro = Math.round(e.oro[0] + azar() * (e.oro[1] - e.oro[0]));
    if (e.xp) r.buff = { xp: e.xp, hasta: new Date(ahora + (e.min || 60) * MIN) };
    if (e.potencia) r.potencia = { valor: e.potencia, hasta: new Date(ahora + (e.min || 60) * MIN), mascota: m.id };
    if (e.botin) r.botinX = e.botin;
    if (e.escudo) {
        if (bromas) r.escudoHasta = new Date(ahora + e.escudo * HORA);
        else if (!r.buff) r.buff = { xp: Math.round(0.05 * e.escudo * 100) / 100, hasta: new Date(ahora + HORA) };
    }
    if (e.volver && expedicionActiva(m, ahora)) r.volver = true;
    else if (e.volver && !e.lleno) r.energia = true;
    if (e.lleno) r.lleno = true;
    if (e.energia) r.energia = true;
    if (e.alegria) r.alegria = true;
    if (e.afinidad) r.afinidad = e.afinidad;
    if (e.recuerdo) r.recuerdo = Math.floor(azar() * RECUERDOS.length);
    return r;
}
// Texto corto de lo que hace (para la carta, el pie y el panel).
function textoEfecto(e, idioma = 'es') {
    const es = idioma !== 'en'; const l = [];
    const dur = (min) => (min >= 60 ? `${Math.round(min / 6) / 10} h` : `${min} min`);
    if (e.caos) l.push(es ? 'algo al azar: oro, +XP o potencia' : 'something random: gold, +XP or power');
    if (e.potencia) l.push(es ? `mascota +${Math.round(e.potencia * 100)} % ${dur(e.min || 60)}` : `pet +${Math.round(e.potencia * 100)}% ${dur(e.min || 60)}`);
    if (e.volver) l.push(es ? 'vuelve ya de la expedición' : 'back from the expedition now');
    if (e.botin) l.push(es ? `próxima expedición ×${String(e.botin).replace('.', ',')} oro` : `next expedition ×${e.botin} gold`);
    if (e.xp) l.push(es ? `+${Math.round(e.xp * 100)} % XP ${dur(e.min || 60)}` : `+${Math.round(e.xp * 100)}% XP ${dur(e.min || 60)}`);
    if (e.oro) l.push(`🪙 ${e.oro[0]}-${e.oro[1]}`);
    if (e.escudo) l.push(es ? `escudo anti-bromas ${String(e.escudo).replace('.', ',')} h` : `prank shield ${e.escudo} h`);
    if (e.lleno) l.push(es ? 'todo al 100' : 'everything to 100');
    else {
        if (e.energia) l.push(es ? 'energía al 100' : 'energy to 100');
        if (e.alegria) l.push(es ? 'alegría al 100' : 'joy to 100');
    }
    if (e.afinidad) l.push(es ? `+${e.afinidad} de afinidad` : `+${e.afinidad} affinity`);
    if (e.recuerdo) l.push(es ? 'trae un recuerdo' : 'brings a souvenir');
    return l.join(' · ');
}
const poderDe = (m) => {
    const d = K.def(m.id);
    const e = efectoAnime(m);
    if (e) return { id: 'anime', emoji: ARQUETIPOS[d.poder.tipo].emoji, tipo: d.poder.tipo, nombre: { es: d.poder.es, en: d.poder.en }, es: `${d.poder.es} (${textoEfecto(e, 'es')})`, en: `${d.poder.en} (${textoEfecto(e, 'en')})`, efecto: e };
    return PODERES[Math.min(PODERES.length - 1, ordenDe(m))];
};
function faltaPoder(col, ahora = Date.now()) {
    const ult = col && col.poderUsado ? new Date(col.poderUsado).getTime() : 0;
    return Math.max(0, Math.ceil((ult + PODER_ESPERA_H * HORA - ahora) / MIN));
}
// Qué hace el poder. `bromas`: si en este servidor hay bromas. Devuelve los efectos (sin guardar).
function usarPoder(m, col, { ahora = Date.now(), bromas = false, azar = Math.random } = {}) {
    const f = faltaPoder(col, ahora);
    if (f) return { fallo: 'espera', min: f };
    const p = poderDe(m);
    const r = { id: p.id, emoji: p.emoji };
    if (p.id === 'anime') return { ...r, ...aplicarEfecto(p.efecto, m, { ahora, bromas, azar }), nombre: p.nombre };
    if (p.id === 'olfato') r.oro = Math.round(p.oro[0] + azar() * (p.oro[1] - p.oro[0]));
    else if (p.id === 'inspiracion') r.buff = { xp: p.xp, hasta: new Date(ahora + p.horas * HORA) };
    else if (p.id === 'escudo') {
        if (bromas) r.escudoHasta = new Date(ahora + p.horas * HORA);
        else { r.id = 'inspiracion'; r.buff = { xp: 0.3, hasta: new Date(ahora + 2 * HORA) }; }
    } else if (p.id === 'prisa') {
        if (expedicionActiva(m, ahora)) r.volver = true; else r.lleno = true;
    } else if (p.id === 'bendicion') { r.buff = { xp: p.xp, hasta: new Date(ahora + p.horas * HORA) }; r.lleno = true; }
    return r;
}
// XP extra de un poder activo (o 0).
const buffXp = (col, ahora = Date.now()) => (col && col.buff && col.buff.hasta && new Date(col.buff.hasta).getTime() > ahora ? col.buff.xp || 0 : 0);

// Misiones del día: 3 de esta lista, las mismas para todos ese día.
const MISIONES = {
    comer: { emoji: '🍖', n: 2, es: 'Dale de comer 2 veces', en: 'Feed it 2 times' },
    jugar: { emoji: '🎾', n: 2, es: 'Juega con él 2 veces', en: 'Play with it 2 times' },
    mimar: { emoji: '🤗', n: 3, es: 'Dale 3 mimos', en: 'Cuddle it 3 times' },
    hablar: { emoji: '💬', n: 2, es: 'Habla con él 2 veces', en: 'Talk to it 2 times' },
    expedicion: { emoji: '🧭', n: 1, es: 'Mándalo de expedición', en: 'Send it on an expedition' },
    feliz: { emoji: '💖', n: 1, es: 'Déjalo feliz', en: 'Make it happy' },
};
const PREMIO_MISION = { oro: 50, afinidad: 15 };
const PREMIO_TODAS = 100;
const diaDe = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 10);
function misionesDelDia(dia) {
    let h = 0;
    for (const ch of String(dia)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const ids = Object.keys(MISIONES);
    const elegidas = [];
    while (elegidas.length < 3) {
        h = (h * 1103515245 + 12345) >>> 0;
        const id = ids[h % ids.length];
        if (!elegidas.includes(id)) elegidas.push(id);
    }
    return elegidas;
}
// Suma un paso a una misión. Devuelve el estado nuevo de las misiones y si se acaba de cumplir alguna.
function avanzarMision(mis, accion, dia) {
    const hoy = misionesDelDia(dia);
    const m = mis && mis.dia === dia ? { dia, prog: { ...(mis.prog || {}) }, hechas: [...(mis.hechas || [])], todas: !!mis.todas } : { dia, prog: {}, hechas: [], todas: false };
    if (!hoy.includes(accion) || m.hechas.includes(accion)) return { mis: m, cumplida: null, todas: false };
    m.prog[accion] = (m.prog[accion] || 0) + 1;
    let cumplida = null; let todas = false;
    if (m.prog[accion] >= MISIONES[accion].n) {
        m.hechas.push(accion); cumplida = accion;
        if (!m.todas && hoy.every((x) => m.hechas.includes(x))) { m.todas = true; todas = true; }
    }
    return { mis: m, cumplida, todas };
}

// Racha: días seguidos cuidando a tus compañeros. Premios al llegar a 3, 7, 14 y 30.
const PREMIOS_RACHA = { 3: 150, 7: 400, 14: 800, 30: 2000 };
function avanzarRacha(col, dia) {
    if (col.ultimoDiaCuidado === dia) return { racha: col.racha || 0, nueva: false, premio: 0 };
    const ayer = new Date(new Date(`${dia}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
    const racha = col.ultimoDiaCuidado === ayer ? (col.racha || 0) + 1 : 1;
    return { racha, nueva: true, premio: PREMIOS_RACHA[racha] || 0 };
}

// Frases. `voz` del compañero (los animales sin voz → tierno). {d} = nombre del dueño.
function frase(m, momento, { idioma = 'es', dueno = '', azar = Math.random, ahora = Date.now() } = {}) {
    const d = K.def(m.id);
    const i = idioma === 'en' ? 1 : 0;
    const pon = (par) => String(par[i] || par[0]).replace(/\{d\}/g, dueno || (idioma === 'en' ? 'friend' : 'amigo'));
    const al = (lista) => lista[Math.floor(azar() * lista.length) % lista.length];
    // Los de un servidor pueden traer sus frases propias (en un idioma).
    // Los de un servidor traen frases propias (texto en un idioma); algunos del Pack anime, [es, en].
    if (d.frases?.length && azar() < 0.5) { const f = al(d.frases); return Array.isArray(f) ? pon(f) : String(f).replace(/\{d\}/g, dueno || ''); }
    if (EXTRA[momento]) return pon(al(EXTRA[momento]));
    if (momento === 'hablar') {
        const h = humor(estado(m, ahora));
        if (h === 'hambre' || h === 'cansado' || h === 'aburrido') return pon(al(GENERAL[h]));
        const n = nivel(m.afinidad || 0);
        const r = azar();
        if (n >= 5 && r < 0.2) return pon(al(GENERAL.confianza));
        if (r < 0.65) return pon(al(VOCES[d.voz] || VOCES.tierno));
        return pon(al(h === 'feliz' ? GENERAL.feliz : GENERAL.saludo));
    }
    return pon(al(GENERAL[momento] || GENERAL.saludo));
}
const totalFrases = () => [GENERAL, VOCES, EXTRA].reduce((t, g) => t + Object.values(g).reduce((a, l) => a + l.length, 0), 0);

module.exports = {
    LLENO, RITMO, HUMOR, NIVEL_MAX, CUIDADOS, EXPEDICIONES, EXPEDICIONES_DIA, RECUERDOS, MISIONES, PREMIO_MISION, PREMIO_TODAS, PREMIOS_RACHA,
    conAfinidad, estado, humor, nivel, umbral, progresoNivel, extraCuidado, cuidar, expedicionActiva, expedicionLista, salir, botin,
    ARQUETIPOS, FUERZA, efectoAnime, efectoCarta, aplicarEfecto, textoEfecto, INTERACCIONES, interaccionesDe, falta, interactuar, PODERES, PODER_ESPERA_H, poderDe, faltaPoder, usarPoder, buffXp, ordenDe,
    diaDe, misionesDelDia, avanzarMision, avanzarRacha, frase, totalFrases,
};
