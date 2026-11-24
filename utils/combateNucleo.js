// Combates de compañeros (1.32.0) — reglas puras, sin base de datos ni Discord.
//
// Tu compañero equipado es tu luchador. Sus estadísticas salen de su rareza, sus estrellas,
// su nivel de afinidad (cuidarlo hace que pelee mejor) y de cómo está ahora (con hambre pelea
// peor). Cada compañero tiene un ELEMENTO con ventajas y desventajas, y las cartas de anime
// son TÉCNICAS: llevas un mazo de hasta 3 y cada una se usa una vez por combate.
//
// Cada ronda, los dos eligen a la vez (atacar, defender, especial o una carta) y se resuelve:
// primero las defensas, luego actúa el más rápido. Gana quien deja al otro sin vida; si se llega
// a MAX_RONDAS, gana quien tenga más vida (en %).
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');

// ---------------------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------------------
const ELEMENTOS = {
    fuego: { emoji: '🔥', color: '#f97316', es: 'Fuego', en: 'Fire' },
    agua: { emoji: '💧', color: '#38bdf8', es: 'Agua', en: 'Water' },
    planta: { emoji: '🌿', color: '#4ade80', es: 'Planta', en: 'Plant' },
    rayo: { emoji: '⚡', color: '#facc15', es: 'Rayo', en: 'Thunder' },
    tierra: { emoji: '🪨', color: '#a16207', es: 'Tierra', en: 'Earth' },
    luz: { emoji: '✨', color: '#fde68a', es: 'Luz', en: 'Light' },
    sombra: { emoji: '🌙', color: '#a78bfa', es: 'Sombra', en: 'Shadow' },
};
// A quién gana cada uno (×VENTAJA al atacarle; él te devuelve ×DESVENTAJA).
const GANA_A = { fuego: ['planta'], planta: ['agua', 'tierra'], agua: ['fuego'], rayo: ['agua'], tierra: ['rayo', 'fuego'], luz: ['sombra'], sombra: ['luz'] };
const VENTAJA = 1.15;
const DESVENTAJA = 0.87;
function factorElemento(ataca, defiende) {
    if (!ataca || !defiende) return 1;
    if ((GANA_A[ataca] || []).includes(defiende)) return VENTAJA;
    if ((GANA_A[defiende] || []).includes(ataca)) return DESVENTAJA;
    return 1;
}
const ELEMENTO_DE = {
    fuego: ['dragon', 'fenix', 'leon', 'tigre', 'oni', 'tomo'],
    agua: ['pinguino', 'tiburon', 'ballena', 'kraken', 'nutria', 'pato', 'marina', 'rana'],
    planta: ['tortuga', 'koala', 'perezoso', 'mariposa', 'sylva', 'conejo', 'hamster'],
    rayo: ['pixel', 'nova', 'zim', 'leopardo', 'raton', 'loro', 'yuki', 'ren', 'aguila'],
    tierra: ['perro', 'oso', 'erizo', 'mono', 'trex', 'mapache', 'panda', 'cerdito'],
    luz: ['unicornio', 'pollito', 'aurora', 'lumi', 'hikari', 'celestial', 'flamenco', 'pavo', 'mika'],
    sombra: ['boo', 'kuro', 'vlad', 'nyx', 'kaede', 'lobo', 'buho', 'zorro', 'gato', 'djinn'],
};
const ELEMENTO_ID = {};
for (const [el, ids] of Object.entries(ELEMENTO_DE)) for (const id of ids) ELEMENTO_ID[id] = el;
const ORDEN_EL = Object.keys(ELEMENTOS);
// Elemento de cualquier compañero (los del servidor y el pack anime: uno fijo según su id).
function elementoDe(id) {
    if (ELEMENTO_ID[id]) return ELEMENTO_ID[id];
    let h = 0;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return ORDEN_EL[h % ORDEN_EL.length];
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------
const BASE = { hp: 90, atk: 24, def: 14, vel: 14 };
const MULT_RAREZA = [1, 1.12, 1.26, 1.42, 1.62, 2.0];
// Cada elemento tiene su estilo (suma 0 en total).
const ESTILO = {
    fuego: { hp: 0, atk: 0.06, def: -0.03, vel: -0.01 },
    agua: { hp: 0.06, atk: -0.02, def: 0, vel: -0.02 },
    planta: { hp: 0.03, atk: -0.03, def: 0.04, vel: -0.03 },
    rayo: { hp: -0.03, atk: 0.02, def: -0.03, vel: 0.07 },
    tierra: { hp: 0.02, atk: 0, def: 0.06, vel: -0.06 },
    luz: { hp: 0.02, atk: 0.01, def: 0.01, vel: 0 },
    sombra: { hp: -0.02, atk: 0.03, def: -0.03, vel: 0.03 },
};
// `m` = el compañero tal y como está guardado (id, estrellas, afinidad, hambre…).
function stats(m, ahora = Date.now()) {
    const d = K.def(m.id);
    const orden = K.RAREZAS[d.rareza]?.orden || 0;
    const el = elementoDe(m.id);
    const nivel = P.nivel(m.afinidad || 0);
    const est = Math.max(1, Math.min(5, m.estrellas || 1));
    // Cómo está ahora: feliz pelea un poco mejor; con hambre o sin energía, peor.
    const e = m.hambre === undefined && m.actualizado === undefined ? null : P.estado(m, ahora);
    const humor = e ? P.humor(e) : 'normal';
    const animo = humor === 'feliz' ? 1.05 : humor === 'hambre' || humor === 'cansado' ? 0.9 : 1;
    const k = MULT_RAREZA[orden] * (1 + 0.06 * (est - 1)) * (1 + 0.015 * (nivel - 1)) * animo;
    const s = ESTILO[el];
    const r = (v) => Math.max(1, Math.round(v));
    return {
        id: m.id, elemento: el, nivel, estrellas: est, humor, animo,
        hp: r(BASE.hp * k * (1 + s.hp)), atk: r(BASE.atk * k * (1 + s.atk)), def: r(BASE.def * k * (1 + s.def)), vel: r(BASE.vel * k * (1 + s.vel)),
    };
}
// Un número para comparar de un vistazo (y emparejar).
const poder = (s) => Math.round(s.hp * 0.5 + s.atk * 3 + s.def * 2 + s.vel * 2);

// ---------------------------------------------------------------------------
// Especiales (uno por elemento, cuesta ENERGIA_ESPECIAL)
// ---------------------------------------------------------------------------
const ENERGIA_MAX = 5;
const ENERGIA_INICIO = 1;
const ENERGIA_ESPECIAL = 3;
const ESPECIALES = {
    fuego: { emoji: '🔥', es: 'Llamarada', en: 'Blaze', golpe: 1.85, quemar: 3 },
    agua: { emoji: '🌊', es: 'Maremoto', en: 'Tidal wave', golpe: 1.55, cura: 0.15 },
    planta: { emoji: '🌿', es: 'Raíces', en: 'Roots', golpe: 1.4, regenera: 3 },
    rayo: { emoji: '⚡', es: 'Relámpago', en: 'Thunderbolt', golpe: 1.7, aturdir: 0.35 },
    tierra: { emoji: '🪨', es: 'Terremoto', en: 'Earthquake', golpe: 1.5, escudo: 0.25 },
    luz: { emoji: '✨', es: 'Destello', en: 'Flash', golpe: 1.5, cura: 0.1, limpiar: true },
    sombra: { emoji: '🌙', es: 'Golpe sombrío', en: 'Shadow strike', golpe: 1.75, perforar: true },
};

// ---------------------------------------------------------------------------
// Cartas = técnicas (por el tipo de poder de cada personaje, data/animePoderes.txt)
// ---------------------------------------------------------------------------
const TECNICAS = {
    fuerza: { es: 'Golpe demoledor', en: 'Crushing blow', golpe: 1.6 },
    espada: { es: 'Tajo certero', en: 'True slash', golpe: 1.5, critico: 0.5 },
    bestia: { es: 'Zarpazo doble', en: 'Double claw', golpes: 2, golpe: 0.8 },
    velocidad: { es: 'Ráfaga', en: 'Flurry', golpes: 2, golpe: 0.75, primero: true },
    fuego: { es: 'Bola de fuego', en: 'Fireball', golpe: 1.35, quemar: 3 },
    hielo: { es: 'Congelar', en: 'Freeze', golpe: 0.8, aturdir: 0.6 },
    tiempo: { es: 'Retroceder el tiempo', en: 'Rewind time', cura: 0.12, energia: 2 },
    mente: { es: 'Confusión', en: 'Confusion', golpe: 0.7, confundir: 0.5 },
    curar: { es: 'Curación', en: 'Heal', cura: 0.3 },
    comida: { es: 'Banquete', en: 'Feast', cura: 0.2, energia: 1 },
    vago: { es: 'Siesta', en: 'Nap', cura: 0.15, energia: 2 },
    defensa: { es: 'Muralla', en: 'Wall', escudo: 0.3 },
    sombra: { es: 'Paso sombrío', en: 'Shadow step', golpe: 0.8, esquivar: true },
    suerte: { es: 'Golpe de suerte', en: 'Lucky hit', golpe: 1.3, critico: 1 },
    lider: { es: 'Grito de guerra', en: 'War cry', ataque: 0.3 },
    musica: { es: 'Canción de ánimo', en: 'Rally song', ataque: 0.2, defensa: 0.2 },
    amistad: { es: 'Lazos de amistad', en: 'Friendship bond', cura: 0.15, ataque: 0.15 },
    magia: { es: 'Hechizo arcano', en: 'Arcane spell', golpe: 1.45, perforar: true },
    tecno: { es: 'Láser', en: 'Laser', golpe: 1.3, romper: 0.3 },
    oscuro: { es: 'Maldición', en: 'Curse', golpe: 0.6, maldecir: 3 },
    vampiro: { es: 'Mordisco vampírico', en: 'Vampire bite', golpe: 1.2, robar: 0.6 },
    detective: { es: 'Deducción', en: 'Deduction', golpe: 1.1, seguro: true, lento: 0.25 },
    deporte: { es: 'Calentamiento', en: 'Warm-up', energia: 2, veloz: 0.3 },
    amor: { es: 'Encanto', en: 'Charm', debilitar: 0.3 },
    caos: { es: 'Caos', en: 'Chaos', caos: true },
};
const MAZO_MAX = 3;
const FUERZA_CARTA = [0.6, 0.8, 1, 1.25, 1.6, 2.2]; // por rareza (como compisNucleo.FUERZA)
const SINERGIA_MAZO = 0.15; // dos o más cartas de la misma serie en el mazo: +15 % cada una
// Fuerza de una carta (0,6 la común con 1 ★ … 2,2+ la divina).
function fuerzaCarta(cartaId, estrellas = 1, extra = 0) {
    const d = K.def(cartaId);
    const orden = K.RAREZAS[d.rareza]?.orden || 0;
    return Math.round(FUERZA_CARTA[orden] * (1 + 0.1 * (Math.max(1, Math.min(5, estrellas)) - 1)) * (1 + Math.max(0, extra)) * 100) / 100;
}
// La técnica de una carta, ya escalada con su fuerza `f`.
function tecnicaDe(cartaId, f = 1) {
    const d = K.def(cartaId);
    const tipo = d.poder?.tipo && TECNICAS[d.poder.tipo] ? d.poder.tipo : 'fuerza';
    return { tipo, es: TECNICAS[tipo].es, en: TECNICAS[tipo].en, f, ...escalar(TECNICAS[tipo], f) };
}
// Lo que hace una técnica, en pocas palabras.
function textoTecnica(t, idioma = 'es') {
    const es = idioma !== 'en';
    const pc = (v) => `${Math.round(v * 100)} %`;
    const x = (v) => `×${String(v).replace('.', es ? ',' : '.')}`;
    const l = [];
    if (t.caos) l.push(es ? 'una técnica al azar' : 'a random technique');
    if (t.golpe) l.push(t.golpes ? (es ? `${t.golpes} golpes de ${x(t.golpe)}` : `${t.golpes} hits of ${x(t.golpe)}`) : (es ? `golpe ${x(t.golpe)}` : `${x(t.golpe)} hit`));
    if (t.perforar) l.push(es ? 'ignora la defensa' : 'ignores defense');
    if (t.seguro) l.push(es ? 'no se esquiva' : 'can’t be dodged');
    if (t.primero) l.push(es ? 'va primero' : 'goes first');
    if (t.critico) l.push(es ? `+${pc(t.critico)} de crítico` : `+${pc(t.critico)} crit`);
    if (t.quemar) l.push(es ? `quema ${t.quemar} rondas` : `burns ${t.quemar} rounds`);
    if (t.aturdir) l.push(es ? `${pc(t.aturdir)} de congelar` : `${pc(t.aturdir)} to freeze`);
    if (t.confundir) l.push(es ? 'confunde' : 'confuses');
    if (t.maldecir) l.push(es ? `maldice ${t.maldecir} rondas` : `curses ${t.maldecir} rounds`);
    if (t.robar) l.push(es ? `roba ${pc(t.robar)} del daño` : `steals ${pc(t.robar)} of damage`);
    if (t.cura) l.push(es ? `cura ${pc(t.cura)}` : `heals ${pc(t.cura)}`);
    if (t.escudo) l.push(es ? `escudo de ${pc(t.escudo)}` : `${pc(t.escudo)} shield`);
    if (t.ataque) l.push(es ? `+${pc(t.ataque)} de ataque` : `+${pc(t.ataque)} attack`);
    if (t.defensa) l.push(es ? `+${pc(t.defensa)} de defensa` : `+${pc(t.defensa)} defense`);
    if (t.veloz) l.push(es ? `+${pc(t.veloz)} de velocidad` : `+${pc(t.veloz)} speed`);
    if (t.energia) l.push(es ? `+${t.energia} de energía` : `+${t.energia} energy`);
    if (t.esquivar) l.push(es ? 'esquiva el siguiente golpe' : 'dodges the next hit');
    if (t.debilitar) l.push(es ? `rival −${pc(t.debilitar)} de ataque` : `foe −${pc(t.debilitar)} attack`);
    if (t.romper) l.push(es ? `rival −${pc(t.romper)} de defensa` : `foe −${pc(t.romper)} defense`);
    if (t.lento) l.push(es ? `rival −${pc(t.lento)} de velocidad` : `foe −${pc(t.lento)} speed`);
    return l.join(' · ');
}
// Las cartas del mazo con su técnica (mazo = ids; cartas = las de la colección; holos = las holográficas).
function prepararMazo(mazo = [], cartas = [], seriesCompletas = [], holos = []) {
    const tengo = new Map(cartas.map((c) => [c.id, c]));
    const ids = [...new Set(mazo)].filter((id) => tengo.has(id)).slice(0, MAZO_MAX);
    const series = ids.map((id) => K.def(id).serie);
    return ids.map((id) => {
        const serie = K.def(id).serie;
        const extra = (series.filter((s) => s && s === serie).length >= 2 ? SINERGIA_MAZO : 0) + (seriesCompletas.includes(serie) ? 0.25 : 0) + (holos.includes(id) ? 0.05 : 0);
        return { id, usada: false, tecnica: tecnicaDe(id, fuerzaCarta(id, tengo.get(id).estrellas || 1, extra)) };
    });
}

// ---------------------------------------------------------------------------
// Luchadores y combate
// ---------------------------------------------------------------------------
// Prepara un luchador: { nombre, id, stats, mazo, ia }. `s` = stats() o unas a mano (criaturas).
function luchador({ nombre, id, s, mazo = [], ia = false, dueno = null }) {
    return {
        nombre, id, dueno, ia, el: s.elemento, max: s.hp, hp: s.hp, atk: s.atk, def: s.def, vel: s.vel,
        energia: ENERGIA_INICIO, mazo: mazo.map((c) => ({ ...c })), efectos: {}, escudo: 0,
    };
}
const MAX_RONDAS = 15;
function nuevoCombate(a, b, { semilla = null } = {}) {
    return { a, b, ronda: 0, log: [], fin: null, semilla };
}
// Valor de un efecto con duración (mejoras y estados).
const activo = (l, k) => (l.efectos[k] && l.efectos[k].rondas > 0 ? l.efectos[k] : null);
const atkDe = (l) => l.atk * (1 + (activo(l, 'ataque')?.v || 0)) * (1 - (activo(l, 'debil')?.v || 0));
const defDe = (l) => l.def * (1 + (activo(l, 'defensa')?.v || 0)) * (1 - (activo(l, 'roto')?.v || 0));
const velDe = (l) => l.vel * (1 + (activo(l, 'veloz')?.v || 0)) * (1 - (activo(l, 'lento')?.v || 0));
// Qué puede hacer ahora: { atacar, defender, especial, cartas: [indices] }.
function opciones(l) {
    return { atacar: true, defender: true, especial: l.energia >= ENERGIA_ESPECIAL, cartas: l.mazo.map((c, i) => (c.usada ? null : i)).filter((i) => i !== null) };
}
// ¿Es válida la acción? 'atacar' | 'defender' | 'especial' | 'carta:<i>'
function valida(l, accion) {
    if (accion === 'atacar' || accion === 'defender') return true;
    if (accion === 'especial') return l.energia >= ENERGIA_ESPECIAL;
    const m = /^carta:(\d+)$/.exec(String(accion));
    return !!(m && l.mazo[Number(m[1])] && !l.mazo[Number(m[1])].usada);
}
// La IA (criaturas, jefes, práctica y quien no elige a tiempo).
function eleccionIA(yo, otro, azar = Math.random) {
    const o = opciones(yo);
    const vida = yo.hp / yo.max;
    const cartas = o.cartas.map((i) => ({ i, t: yo.mazo[i].tecnica }));
    const cura = cartas.find((c) => c.t.cura);
    if (vida < 0.35 && cura) return `carta:${cura.i}`;
    if (vida < 0.22 && azar() < 0.35) return 'defender';
    if (o.especial && azar() < 0.65) return 'especial';
    const ofensiva = cartas.filter((c) => c.t.golpe || c.t.ataque || c.t.quemar || c.t.maldecir || c.t.debilitar);
    if (ofensiva.length && azar() < 0.35) return `carta:${ofensiva[Math.floor(azar() * ofensiva.length) % ofensiva.length].i}`;
    if (otro.energia >= ENERGIA_ESPECIAL && azar() < 0.2) return 'defender';
    return 'atacar';
}
// Daño de un golpe de `de` a `a` con multiplicador `mult`.
function danio(de, a, mult, { perforar = false, critico = 0, seguro = false, azar = Math.random } = {}) {
    const def = perforar ? defDe(a) * 0.4 : defDe(a);
    const fe = factorElemento(de.el, a.el);
    let v = atkDe(de) * mult * fe * (1 - def / (def + 40)) * (0.6 + azar() * 0.8);
    const pCrit = Math.min(1, 0.14 + (de.el === 'sombra' ? 0.05 : 0) + critico);
    const crit = azar() < pCrit;
    if (crit) v *= 1.8;
    // Esquiva: más fácil si eres más rápido. «seguro» (deducción) no se esquiva; «esquivar» sí siempre.
    let esquiva = false;
    if (activo(a, 'esquivar')) esquiva = true;
    else if (!seguro) esquiva = azar() < Math.min(0.2, 0.08 + Math.max(0, velDe(a) - velDe(de)) * 0.005);
    if (esquiva) v = 0;
    return { v: Math.max(esquiva ? 0 : 1, Math.round(v)), crit: crit && !esquiva, esquiva, fe };
}
function recibir(l, v) {
    let resto = v;
    if (l.escudo > 0) { const q = Math.min(l.escudo, resto); l.escudo -= q; resto -= q; }
    l.hp = Math.max(0, l.hp - Math.round(resto));
    return resto;
}
const curar = (l, frac) => { const antes = l.hp; l.hp = Math.min(l.max, l.hp + Math.round(l.max * frac)); return l.hp - antes; };
const poner = (l, k, v, rondas) => { l.efectos[k] = { v, rondas }; };

// Resuelve una ronda. `acciones` = { a: 'atacar'|…, b: … }. Devuelve los sucesos (para dibujar y contar).
function ronda(c, acciones, azar = Math.random) {
    if (c.fin) return [];
    c.ronda += 1;
    const ev = [];
    const lados = { a: c.a, b: c.b };
    const otroDe = (k) => (k === 'a' ? 'b' : 'a');
    for (const k of ['a', 'b']) if (!valida(lados[k], acciones[k])) acciones[k] = 'atacar';
    // Aturdido: pierde la acción (una vez).
    for (const k of ['a', 'b']) {
        if (activo(lados[k], 'aturdido')) { acciones[k] = 'aturdido'; ev.push({ lado: k, tipo: 'aturdido' }); lados[k].efectos.aturdido = null; }
    }
    // Defender va primero (y recarga un poco).
    const defiende = { a: acciones.a === 'defender', b: acciones.b === 'defender' };
    for (const k of ['a', 'b']) {
        if (defiende[k]) { const cur = curar(lados[k], 0.04); lados[k].energia = Math.min(ENERGIA_MAX, lados[k].energia + 1); ev.push({ lado: k, tipo: 'defender', cura: cur }); }
    }
    // Orden: el más rápido (las técnicas «primero» se adelantan).
    const prisa = (k) => velDe(lados[k]) + (String(acciones[k]).startsWith('carta:') && lados[k].mazo[Number(acciones[k].slice(6))]?.tecnica.primero ? 1000 : 0);
    const orden = prisa('a') === prisa('b') ? (azar() < 0.5 ? ['a', 'b'] : ['b', 'a']) : prisa('a') > prisa('b') ? ['a', 'b'] : ['b', 'a'];
    for (const k of orden) {
        const yo = lados[k]; const el = lados[otroDe(k)];
        if (yo.hp <= 0 || el.hp <= 0) break;
        const acc = acciones[k];
        if (acc === 'defender' || acc === 'aturdido') continue;
        // Confusión: puede golpearse a sí mismo.
        const conf = activo(yo, 'confuso');
        if (conf && azar() < conf.v) {
            const d = Math.max(1, Math.round(atkDe(yo) * 0.5 * (1 - defDe(yo) / (defDe(yo) + 40))));
            recibir(yo, d); yo.efectos.confuso = null;
            ev.push({ lado: k, tipo: 'confuso', danio: d });
            continue;
        }
        const reduce = defiende[otroDe(k)] ? 0.45 : 1;
        const golpear = (mult, op = {}) => {
            const r = danio(yo, el, mult, { ...op, azar });
            const real = r.esquiva ? 0 : recibir(el, Math.round(r.v * reduce));
            return { ...r, real };
        };
        if (acc === 'atacar') {
            yo.energia = Math.min(ENERGIA_MAX, yo.energia + 1);
            const r = golpear(1);
            ev.push({ lado: k, tipo: 'atacar', danio: r.real, crit: r.crit, esquiva: r.esquiva, fe: r.fe });
        } else if (acc === 'especial') {
            yo.energia -= ENERGIA_ESPECIAL;
            const e = ESPECIALES[yo.el];
            const r = golpear(e.golpe, { perforar: !!e.perforar });
            const x = { lado: k, tipo: 'especial', nombre: { es: e.es, en: e.en }, emoji: e.emoji, danio: r.real, crit: r.crit, esquiva: r.esquiva, fe: r.fe };
            if (!r.esquiva) {
                if (e.quemar) { poner(el, 'quema', 0.05, e.quemar); x.quema = true; }
                if (e.aturdir && azar() < e.aturdir) { poner(el, 'aturdido', 1, 1); x.aturde = true; }
            }
            if (e.cura) x.cura = curar(yo, e.cura);
            if (e.regenera) { poner(yo, 'regenera', 0.06, e.regenera); x.regenera = true; }
            if (e.escudo) { yo.escudo += Math.round(yo.max * e.escudo); x.escudo = true; }
            if (e.limpiar) { for (const m of ['quema', 'maldito', 'debil', 'lento', 'roto', 'confuso']) yo.efectos[m] = null; }
            ev.push(x);
        } else {
            const i = Number(String(acc).slice(6));
            const carta = yo.mazo[i];
            carta.usada = true;
            let t = carta.tecnica;
            if (t.caos) { const tipos = Object.keys(TECNICAS).filter((x) => x !== 'caos'); const tipo = tipos[Math.floor(azar() * tipos.length) % tipos.length]; t = { tipo, es: `🃏 ${TECNICAS[tipo].es}`, en: `🃏 ${TECNICAS[tipo].en}`, f: t.f, ...escalar(TECNICAS[tipo], t.f) }; }
            const x = { lado: k, tipo: 'carta', carta: carta.id, tecnica: { es: t.es, en: t.en, tipo: t.tipo }, danio: 0 };
            if (t.golpe) {
                const n = t.golpes || 1;
                for (let g = 0; g < n && el.hp > 0; g++) {
                    const r = golpear(t.golpe, { perforar: !!t.perforar, critico: t.critico || 0, seguro: !!t.seguro });
                    x.danio += r.real; x.crit = x.crit || r.crit; x.esquiva = r.esquiva && !x.danio; x.fe = r.fe;
                }
                if (t.robar && x.danio) x.cura = curar(yo, (x.danio * t.robar) / yo.max);
                if (!x.esquiva) {
                    if (t.quemar) { poner(el, 'quema', 0.05, t.quemar); x.quema = true; }
                    if (t.aturdir && azar() < t.aturdir) { poner(el, 'aturdido', 1, 1); x.aturde = true; }
                    if (t.confundir) { poner(el, 'confuso', t.confundir, 2); x.confunde = true; }
                    if (t.maldecir) { poner(el, 'maldito', 0.07, t.maldecir); x.maldice = true; }
                    if (t.romper) { poner(el, 'roto', t.romper, 3); }
                    if (t.lento) { poner(el, 'lento', t.lento, 3); }
                }
            }
            if (t.cura && !t.robar) x.cura = curar(yo, t.cura);
            if (t.escudo) { yo.escudo += Math.round(yo.max * t.escudo); x.escudo = true; }
            if (t.ataque) poner(yo, 'ataque', t.ataque, 3);
            if (t.defensa) poner(yo, 'defensa', t.defensa, 3);
            if (t.veloz) poner(yo, 'veloz', t.veloz, 3);
            if (t.energia) yo.energia = Math.min(ENERGIA_MAX, yo.energia + t.energia);
            if (t.esquivar) poner(yo, 'esquivar', 1, 2); // esta ronda (si va primero) y la siguiente
            if (t.debilitar) { poner(el, 'debil', t.debilitar, 3); x.debilita = true; }
            ev.push(x);
        }
    }
    // Final de ronda: quemaduras, maldiciones, regeneración y duración de efectos.
    for (const k of ['a', 'b']) {
        const l = lados[k];
        if (l.hp <= 0) continue;
        const q = activo(l, 'quema'); const m = activo(l, 'maldito'); const r = activo(l, 'regenera');
        if (q) { const d = Math.max(1, Math.round(l.max * q.v)); l.hp = Math.max(0, l.hp - d); ev.push({ lado: k, tipo: 'quema', danio: d }); }
        if (m && l.hp > 0) { const d = Math.max(1, Math.round(l.max * m.v)); l.hp = Math.max(0, l.hp - d); ev.push({ lado: k, tipo: 'maldicion', danio: d }); }
        if (r && l.hp > 0) ev.push({ lado: k, tipo: 'regenera', cura: curar(l, r.v) });
        for (const [ef, v] of Object.entries(l.efectos)) {
            if (!v || ef === 'aturdido') continue;
            v.rondas -= 1;
            if (v.rondas <= 0) l.efectos[ef] = null;
        }
    }
    c.log.push({ ronda: c.ronda, acciones: { ...acciones }, ev });
    if (c.a.hp <= 0 || c.b.hp <= 0) c.fin = { ganador: c.a.hp <= 0 && c.b.hp <= 0 ? (c.a.hp / c.a.max >= c.b.hp / c.b.max ? 'a' : 'b') : c.a.hp <= 0 ? 'b' : 'a', motivo: 'ko' };
    else if (c.ronda >= MAX_RONDAS) c.fin = { ganador: c.a.hp / c.a.max >= c.b.hp / c.b.max ? 'a' : 'b', motivo: 'rondas' };
    return ev;
}
function escalar(base, f) {
    const t = {};
    if (base.golpe) t.golpe = base.golpe >= 1 ? Math.round((1 + (base.golpe - 1) * f) * 100) / 100 : Math.round(base.golpe * Math.sqrt(f) * 100) / 100;
    for (const k of ['cura', 'escudo', 'ataque', 'defensa', 'robar', 'debilitar', 'romper', 'lento', 'veloz']) if (base[k]) t[k] = Math.min(0.6, Math.round(base[k] * f * 100) / 100);
    for (const k of ['aturdir', 'confundir', 'critico']) if (base[k]) t[k] = Math.min(1, Math.round(base[k] * Math.sqrt(f) * 100) / 100);
    for (const k of ['quemar', 'maldecir', 'energia', 'golpes']) if (base[k]) t[k] = base[k];
    for (const k of ['esquivar', 'perforar', 'primero', 'seguro']) if (base[k]) t[k] = true;
    return t;
}
// Combate entero entre dos IA (para la Liga, simular y los tests).
function simular(a, b, azar = Math.random) {
    const c = nuevoCombate(a, b);
    while (!c.fin) ronda(c, { a: eleccionIA(c.a, c.b, azar), b: eleccionIA(c.b, c.a, azar) }, azar);
    return c;
}

// ---------------------------------------------------------------------------
// Clasificación (ELO) y rangos
// ---------------------------------------------------------------------------
const ELO_INICIO = 1000;
const ELO_K = 32;
const RANGOS = [
    { id: 'bronce', desde: 0, emoji: '🥉', color: '#b45309', es: 'Bronce', en: 'Bronze' },
    { id: 'plata', desde: 1100, emoji: '🥈', color: '#94a3b8', es: 'Plata', en: 'Silver' },
    { id: 'oro', desde: 1250, emoji: '🥇', color: '#facc15', es: 'Oro', en: 'Gold' },
    { id: 'platino', desde: 1400, emoji: '💠', color: '#22d3ee', es: 'Platino', en: 'Platinum' },
    { id: 'diamante', desde: 1550, emoji: '💎', color: '#818cf8', es: 'Diamante', en: 'Diamond' },
    { id: 'maestro', desde: 1700, emoji: '👑', color: '#f472b6', es: 'Maestro', en: 'Master' },
];
const rangoDe = (elo = ELO_INICIO) => [...RANGOS].reverse().find((r) => elo >= r.desde) || RANGOS[0];
// Nuevo ELO de los dos (gana = 'a' | 'b'). Nadie baja de 0.
function elo(ea = ELO_INICIO, eb = ELO_INICIO, gana = 'a') {
    const esperadoA = 1 / (1 + 10 ** ((eb - ea) / 400));
    const sa = gana === 'a' ? 1 : 0;
    const da = Math.round(ELO_K * (sa - esperadoA));
    return { a: Math.max(0, ea + da), b: Math.max(0, eb - da), cambio: Math.abs(da) };
}
const ELO_MISMA_PAREJA_DIA = 3; // contra la misma persona, solo 3 combates al día cuentan para la clasificación
const PREMIO_VICTORIA = 120;     // oro por victoria (las 3 primeras del día)
const VICTORIAS_PREMIADAS = 3;
const COMISION_APUESTA = 0.05;   // de una apuesta entre dos, la casa se queda un 5 %

// ---------------------------------------------------------------------------
// Torre (pisos contra criaturas; se reinicia cada mes)
// ---------------------------------------------------------------------------
const TORRE_INTENTOS_DIA = 5;
const CRIATURAS = ['gato', 'lobo', 'tiburon', 'trex', 'kraken', 'dragon', 'fenix', 'oni', 'vlad', 'nyx', 'golem', 'boo', 'tigre', 'aguila', 'leopardo'];
const JEFES_TORRE = ['jefe:sombra', 'jefe:golem_lava', 'jefe:kraken_abismo', 'jefe:dragon_negro', 'jefe:rey_slime'];
const ELEMENTO_JEFE = { 'jefe:sombra': 'sombra', 'jefe:golem_lava': 'fuego', 'jefe:kraken_abismo': 'agua', 'jefe:dragon_negro': 'sombra', 'jefe:rey_slime': 'planta' };
function semillaNum(x) { let h = 2166136261; for (const ch of String(x)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
// La criatura del piso `p` (la misma para todos este mes).
function enemigoTorre(p, temporada = '') {
    const jefe = p % 10 === 0;
    const h = semillaNum(`${temporada}:${p}`);
    const id = jefe ? JEFES_TORRE[(p / 10 - 1) % JEFES_TORRE.length] : CRIATURAS[h % CRIATURAS.length];
    const el = jefe ? ELEMENTO_JEFE[id] : ORDEN_EL[(h >>> 8) % ORDEN_EL.length];
    const k = (0.72 + 0.04 * (p - 1)) * (jefe ? 1.15 : 1);
    const s = { elemento: el, hp: Math.round(BASE.hp * k * 1.05), atk: Math.round(BASE.atk * k), def: Math.round(BASE.def * k), vel: Math.round(BASE.vel * k) };
    // Las criaturas también llevan alguna técnica a partir del piso 6.
    const tipos = ['fuerza', 'curar', 'hielo', 'fuego', 'defensa', 'vampiro', 'mente', 'oscuro'];
    const tecnicas = p >= 6 ? [tipos[h % tipos.length], tipos[(h >>> 4) % tipos.length]].slice(0, p >= 20 ? 2 : 1) : [];
    const mazo = tecnicas.map((tipo) => ({ id: `t:${tipo}`, usada: false, tecnica: { tipo, es: TECNICAS[tipo].es, en: TECNICAS[tipo].en, f: Math.min(2, 0.7 + p * 0.03), ...escalar(TECNICAS[tipo], Math.min(2, 0.7 + p * 0.03)) } }));
    return { id, jefe, s, mazo };
}
// Premio por subir el piso `p` la primera vez este mes.
function premioPiso(p) {
    const r = { oro: 25 + p * 12, tickets: {} };
    if (p % 5 === 0) r.tickets.sobre_normal = 1;
    if (p % 10 === 0) { r.oro += 300; r.tickets.cofre_basico = 1; }
    if (p % 25 === 0) r.tickets.sobre_brillante = 1;
    if (p === 50) r.tickets.cofre_epico = 1;
    return r;
}

// ---------------------------------------------------------------------------
// Jefe semanal del servidor (todos le pegan; 3 ataques al día por persona)
// ---------------------------------------------------------------------------
const JEFES = {
    sombra: { id: 'jefe:sombra', el: 'sombra', es: 'Sombra Devoradora', en: 'Devouring Shadow' },
    golem_lava: { id: 'jefe:golem_lava', el: 'fuego', es: 'Gólem de Lava', en: 'Lava Golem' },
    kraken_abismo: { id: 'jefe:kraken_abismo', el: 'agua', es: 'Kraken del Abismo', en: 'Abyss Kraken' },
    dragon_negro: { id: 'jefe:dragon_negro', el: 'sombra', es: 'Dragón Negro', en: 'Black Dragon' },
    rey_slime: { id: 'jefe:rey_slime', el: 'planta', es: 'Rey Slime', en: 'Slime King' },
};
const ATAQUES_JEFE_DIA = 3;
const semanaDe = (ahora = Date.now()) => {
    const d = new Date(ahora); const dia = (d.getUTCDay() + 6) % 7; // lunes = 0
    const lunes = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia));
    return lunes.toISOString().slice(0, 10);
};
// El jefe de esta semana (rota) y su vida según cuánta gente juega en el servidor.
function jefeDeSemana(semana, jugadores = 10) {
    const ids = Object.keys(JEFES);
    const j = JEFES[ids[semillaNum(semana) % ids.length]];
    const vida = Math.round(Math.min(300000, Math.max(5000, 900 * Math.max(5, jugadores))));
    const def = 22 + Math.min(40, Math.round(jugadores / 2));
    return { clave: ids[semillaNum(semana) % ids.length], ...j, vida, def };
}
// Un ataque al jefe: tu luchador pega 3 veces (ataque, especial si toca y tu mejor carta del mazo).
// Devuelve los golpes y el total. El jefe no te puede matar (es cooperativo).
function atacarJefe(s, mazo = [], jefe, azar = Math.random) {
    const yo = luchador({ nombre: '', id: s.id, s, mazo });
    yo.energia = ENERGIA_ESPECIAL;
    const el = luchador({ nombre: '', id: jefe.id, s: { elemento: jefe.el, hp: 1e9, atk: 1, def: jefe.def, vel: 1 } });
    const golpes = [];
    const pegar = (mult, op = {}, etiqueta = 'atacar') => {
        const r = danio(yo, el, mult, { ...op, azar });
        golpes.push({ tipo: etiqueta, danio: r.esquiva ? 0 : r.v, crit: r.crit, fe: r.fe, ...(op.extra || {}) });
    };
    pegar(1);
    const e = ESPECIALES[s.elemento];
    pegar(e.golpe, { perforar: !!e.perforar, extra: { nombre: { es: e.es, en: e.en }, emoji: e.emoji } }, 'especial');
    const ofensivas = mazo.filter((c) => c.tecnica.golpe).sort((a, b) => b.tecnica.golpe * (b.tecnica.golpes || 1) - a.tecnica.golpe * (a.tecnica.golpes || 1));
    if (ofensivas[0]) {
        const t = ofensivas[0].tecnica;
        for (let g = 0; g < (t.golpes || 1); g++) pegar(t.golpe, { perforar: !!t.perforar, critico: t.critico || 0, seguro: true, extra: { carta: ofensivas[0].id, nombre: { es: t.es, en: t.en } } }, 'carta');
    } else pegar(1.2, {}, 'atacar');
    return { golpes, total: golpes.reduce((a, g) => a + g.danio, 0) };
}
// Reparto de premios al acabar la semana. `ranking` = [{ userId, danio }] ordenado; `muerto` = si cayó.
// La bolsa de oro crece con la vida del jefe (que crece con la gente que juega): ~0,8 de oro por punto de vida si cae.
function premiosJefe(ranking, muerto, vidaMax = 10000) {
    const total = ranking.reduce((a, r) => a + r.danio, 0) || 1;
    const bolsa = Math.round(vidaMax * (muerto ? 0.8 : 0.3));
    return ranking.filter((r) => r.danio > 0).map((r, i) => {
        const oro = Math.round((muerto ? 250 : 100) + bolsa * (r.danio / total));
        const tickets = {};
        if (muerto) tickets.sobre_normal = 1;
        if (i === 0) tickets[muerto ? 'cofre_epico' : 'sobre_brillante'] = 1;
        else if (i < 3) tickets[muerto ? 'sobre_brillante' : 'sobre_normal'] = (tickets[muerto ? 'sobre_brillante' : 'sobre_normal'] || 0) + 1;
        return { userId: r.userId, puesto: i + 1, oro, tickets };
    });
}

module.exports = {
    ELEMENTOS, GANA_A, VENTAJA, DESVENTAJA, factorElemento, elementoDe, ELEMENTO_DE,
    BASE, MULT_RAREZA, ESTILO, stats, poder,
    textoTecnica, ENERGIA_MAX, ENERGIA_INICIO, ENERGIA_ESPECIAL, ESPECIALES, TECNICAS, MAZO_MAX, SINERGIA_MAZO, fuerzaCarta, tecnicaDe, prepararMazo,
    luchador, nuevoCombate, opciones, valida, eleccionIA, ronda, simular, MAX_RONDAS, danio,
    ELO_INICIO, ELO_K, RANGOS, rangoDe, elo, ELO_MISMA_PAREJA_DIA, PREMIO_VICTORIA, VICTORIAS_PREMIADAS, COMISION_APUESTA,
    TORRE_INTENTOS_DIA, enemigoTorre, premioPiso, semillaNum,
    JEFES, ATAQUES_JEFE_DIA, semanaDe, jefeDeSemana, atacarJefe, premiosJefe,
};
