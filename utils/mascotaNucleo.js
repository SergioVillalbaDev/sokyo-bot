// Reglas puras de la mascota del servidor (1.14.0): especies, niveles y fases,
// cómo cambian sus barras con el tiempo, su forma de adulta, sus ventajas y su
// fuerza en los combates. Sin base de datos ni Discord: lo prueban los tests
// (test/oroSocial.test.js) y lo usan utils/mascota.js y utils/liga.js.

// Especies que se pueden votar al nacer. `svg` = archivo de assets/mascota (Twemoji).
const ESPECIES = {
    dragon: { emoji: '🐉', svg: '1f409', es: 'Dragón', en: 'Dragon', color: '#22c55e', nombre: 'Draco', ataque: { es: 'Llamarada', en: 'Fire Breath' } },
    zorro: { emoji: '🦊', svg: '1f98a', es: 'Zorro', en: 'Fox', color: '#f97316', nombre: 'Kitsu', ataque: { es: 'Zarpazo astuto', en: 'Sly Swipe' } },
    golem: { emoji: '🪨', svg: '1faa8', es: 'Gólem', en: 'Golem', color: '#a8a29e', nombre: 'Roco', ataque: { es: 'Puño de roca', en: 'Rock Fist' } },
    fenix: { emoji: '🔥', svg: '1f426-200d-1f525', es: 'Fénix', en: 'Phoenix', color: '#ef4444', nombre: 'Ignis', ataque: { es: 'Renacer en llamas', en: 'Rebirth Flame' } },
    kraken: { emoji: '🐙', svg: '1f419', es: 'Kraken', en: 'Kraken', color: '#a855f7', nombre: 'Krako', ataque: { es: 'Tentáculos', en: 'Tentacle Grab' } },
};
const SALVAJE = { emoji: '👾', es: 'Sombra salvaje', en: 'Wild Shadow', ataque: { es: 'Zarpa sombría', en: 'Shadow Claw' } };

// Formas de adulta: salen de cómo es el servidor (ver formaDe).
const FORMAS = {
    nocturna: { emoji: '🌙', svg: '1f319', es: 'nocturna', en: 'nocturnal', color: '#6366f1' },
    musical: { emoji: '🎵', svg: '1f3b5', es: 'musical', en: 'musical', color: '#ec4899' },
    guerrera: { emoji: '⚔️', svg: '2694', es: 'guerrera', en: 'warrior', color: '#ef4444' },
    social: { emoji: '💬', svg: '1f4ac', es: 'social', en: 'social', color: '#38bdf8' },
};

// Fases según el nivel.
const FASES = [
    { id: 'huevo', desde: 0, emoji: '🥚', es: 'Huevo', en: 'Egg' },
    { id: 'cria', desde: 1, emoji: '🍼', es: 'Cría', en: 'Baby' },
    { id: 'joven', desde: 5, emoji: '🌱', es: 'Joven', en: 'Young' },
    { id: 'adulta', desde: 15, emoji: '⭐', es: 'Adulta', en: 'Adult' },
    { id: 'legendaria', desde: 30, emoji: '👑', es: 'Legendaria', en: 'Legendary' },
];

// Ventajas para todo el servidor según el nivel (solo si la mascota no hiberna ni está enferma).
const VENTAJAS = [
    { id: 'caricia', nivel: 3, emoji: '🤲', es: 'Acariciarla da 25 de oro', en: 'Petting it gives 25 gold' },
    { id: 'xp5', nivel: 5, emoji: '✨', es: '+5 % de XP para todos', en: '+5% XP for everyone' },
    { id: 'bromas10', nivel: 10, emoji: '🃏', es: 'Bromas un 10 % más baratas', en: 'Pranks 10% cheaper' },
    { id: 'proteger', nivel: 15, emoji: '🛡️', es: 'Protege a alguien de las bromas una vez al día', en: 'Protects someone from pranks once a day' },
    { id: 'xp10', nivel: 20, emoji: '🌟', es: '+10 % de XP para todos', en: '+10% XP for everyone' },
    { id: 'bromas20', nivel: 25, emoji: '🎭', es: 'Bromas un 20 % más baratas', en: 'Pranks 20% cheaper' },
    { id: 'leyenda', nivel: 30, emoji: '👑', es: '+15 % de XP y +10 % de fuerza en combate', en: '+15% XP and +10% combat power' },
];

const NIVEL_MAX = 50;
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

// XP que hace falta para pasar del nivel n al n+1.
const xpParaSubir = (nivel) => 60 + nivel * 40;

// Suma XP y sube los niveles que toquen. Devuelve { nivel, xp, subidos }.
function sumarXp(nivel, xp, ganada) {
    let n = Math.max(1, nivel || 1);
    let x = Math.max(0, (xp || 0) + Math.max(0, Math.round(ganada || 0)));
    let subidos = 0;
    while (n < NIVEL_MAX && x >= xpParaSubir(n)) { x -= xpParaSubir(n); n++; subidos++; }
    if (n >= NIVEL_MAX) x = 0;
    return { nivel: n, xp: x, subidos };
}

function faseDe(m) {
    if (!m || m.estado === 'huevo') return FASES[0];
    let f = FASES[1];
    for (const x of FASES) if (x.desde > 0 && (m.nivel || 1) >= x.desde) f = x;
    return f;
}

// Forma de adulta según cómo es el servidor. Se decide una vez, al llegar a adulta.
function formaDe(c = {}) {
    if ((c.victorias || 0) >= 5) return 'guerrera';
    if ((c.musica || 0) >= 60) return 'musical';
    const total = (c.noche || 0) + (c.dia || 0);
    if (total >= 50 && (c.noche || 0) / total >= 0.35) return 'nocturna';
    return 'social';
}

// ¿Funcionan sus ventajas? No si hiberna o está enferma.
const enForma = (m) => !!m && m.estado === 'viva' && !m.hibernando && (m.salud ?? 100) >= 25;

function ventajasDe(m) {
    if (!enForma(m)) return [];
    return VENTAJAS.filter((v) => (m.nivel || 1) >= v.nivel).map((v) => v.id);
}
// Extra de XP para todos (0.05 = +5 %).
function bonusXp(m) {
    const v = ventajasDe(m);
    if (v.includes('leyenda')) return 0.15;
    if (v.includes('xp10')) return 0.10;
    if (v.includes('xp5')) return 0.05;
    return 0;
}
// Descuento de las bromas (0.1 = −10 %).
function descuentoBromas(m) {
    const v = ventajasDe(m);
    if (v.includes('bromas20')) return 0.2;
    if (v.includes('bromas10')) return 0.1;
    return 0;
}

// Cómo está: lo que se enseña y lo que dice en el chat.
function animoDe(m) {
    if (!m || m.estado !== 'viva') return 'huevo';
    if (m.hibernando) return 'hibernando';
    if (m.salud < 25) return 'enferma';
    if (m.hambre < 25) return 'hambrienta';
    if (m.alegria < 25) return 'triste';
    if (m.hambre >= 70 && m.alegria >= 70 && m.salud >= 70) return 'feliz';
    return 'bien';
}

// Lo que pasa con el tiempo. `act` = lo que ha hecho el servidor en ese rato:
// { mensajes, vozMin, incidentes, noche } (noche = mensajes de madrugada).
// `horas` puede ser decimal. Devuelve el cambio para guardar y los avisos.
function pasarTiempo(m, act = {}, horas = 1, ahora = new Date()) {
    const h = Math.max(0, horas);
    const mensajes = Math.max(0, act.mensajes || 0);
    const vozMin = Math.max(0, act.vozMin || 0);
    const incidentes = Math.max(0, act.incidentes || 0);
    const P = require('./mascotaExtras.js').pers(m); // personalidad (1.15.0)
    let hambre = (m.hambre ?? 80) - 3 * h * (P.hambre || 1);
    // El servidor vivo la alegra; si está callado, se aburre.
    const animacion = Math.min(15 * Math.max(1, h), mensajes / 4 + vozMin / 15);
    let alegria = (m.alegria ?? 70) + animacion - 3 * h * (P.aburre || 1);
    if (P.accesorio && m.accesorio) alegria += (P.accesorio / 8) * h; // presumida y arreglada
    // Toxicidad (automod, sanciones) la pone mala; bien comida se recupera.
    let salud = (m.salud ?? 100) - incidentes * 4 * (P.toxicidad || 1);
    if (hambre > 30) salud += 2 * h;
    if (hambre <= 0) salud -= 3 * h;
    // Energía para entrenar: se recupera sola (más rápido si es dormilona).
    const energia = clamp((m.energia ?? 100) + 6 * h * (P.energia || 1));
    hambre = clamp(hambre); alegria = clamp(alegria); salud = clamp(salud);

    const cambio = { hambre, alegria, salud, energia };
    const avisos = [];
    // XP por lo vivo que está el servidor (no si hiberna).
    if (!m.hibernando) {
        const xp = Math.min(25 * Math.max(1, h), mensajes / 8 + vozMin / 30) * (P.xp || 1);
        const r = sumarXp(m.nivel, m.xp, xp);
        cambio.nivel = r.nivel; cambio.xp = r.xp;
        if (r.subidos) avisos.push({ tipo: 'nivel', nivel: r.nivel, antes: m.nivel });
    }
    // Contadores para su forma de adulta.
    cambio['contadores.noche'] = (m.contadores?.noche || 0) + (act.noche || 0);
    cambio['contadores.dia'] = (m.contadores?.dia || 0) + Math.max(0, mensajes - (act.noche || 0));
    // Hibernar: sin comida y sin alegría se va a dormir.
    if (!m.hibernando && hambre <= 0 && alegria <= 10) {
        cambio.hibernando = true; cambio.hibernaDesde = ahora;
        avisos.push({ tipo: 'hiberna' });
    } else if (m.hibernando && m.hibernaDesde) {
        // Cada día hibernando pierde un nivel (nunca baja de 1).
        const dias = Math.floor((ahora - new Date(m.hibernaDesde)) / 86400000);
        if (dias >= 1 && (m.nivel || 1) > 1) {
            cambio.nivel = Math.max(1, (m.nivel || 1) - 1); cambio.xp = 0;
            cambio.hibernaDesde = new Date(new Date(m.hibernaDesde).getTime() + 86400000);
            avisos.push({ tipo: 'pierde', nivel: cambio.nivel });
        }
    }
    // Al hacerse adulta, su forma.
    const nivelNuevo = cambio.nivel ?? m.nivel;
    if (!m.forma && nivelNuevo >= 15) {
        cambio.forma = formaDe({ ...(m.contadores || {}), noche: cambio['contadores.noche'], dia: cambio['contadores.dia'] });
        avisos.push({ tipo: 'forma', forma: cambio.forma });
    }
    return { cambio, avisos };
}

// Comer: cada 10 de oro llena 1 punto de hambre. No se cobra lo que no cabe.
function comida(m, oro) {
    const cabe = Math.max(0, 100 - (m.hambre ?? 0)) * 10;
    const usado = Math.max(0, Math.min(Math.floor(oro || 0), cabe));
    const puntos = Math.floor(usado / 10);
    return { usado: puntos * 10, hambre: clamp((m.hambre ?? 0) + puntos), xp: Math.floor(puntos * 1.5), cuidado: puntos };
}

// Despierta al comer si ya tiene algo en el estómago.
const despierta = (m, hambreNueva) => !!m.hibernando && hambreNueva >= 30;

// Fuerza en combate: nivel, cómo está, lo entrenada que está, su forma y su
// personalidad. Los ánimos suman hasta un 30 % (en combatir).
function poderDe(m) {
    if (!m) return 0;
    const st = m.stats || {};
    let p = (m.nivel || 1) * 10 + (m.salud ?? 100) / 2 + (m.alegria ?? 70) / 2 + (m.hambre ?? 80) / 4
        + (m.energia ?? 100) / 5 + (st.fuerza || 5) * 2 + (st.defensa || 5) + (st.agilidad || 5);
    if (m.forma === 'guerrera') p *= 1.15;
    if (ventajasDe(m).includes('leyenda')) p *= 1.10;
    p *= require('./mascotaExtras.js').pers(m).combate || 1;
    return Math.round(p);
}
const extraAnimos = (n) => Math.min(0.3, Math.max(0, n || 0) * 0.02);

// Generador de números a partir de una semilla (combates repetibles en los tests).
function azarCon(semilla) {
    let s = 0;
    for (const ch of String(semilla)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let x = s;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

// Al mejor de 3 rondas. a/b: { poder, animos, stats?, especie? }.
// En cada ronda: la agilidad da golpes críticos (×1,5) y esquivas (el golpe del otro
// se queda en ×0,6), la defensa quita hasta un 25 % del golpe del otro, y cada especie
// usa una vez su habilidad especial cuando va perdiendo (mascotaExtras.ESPECIALES).
// Devuelve { ganador: 'a'|'b', rondas: [{ a, b, eventoA, eventoB }] }.
function combatir(a, b, azar = Math.random) {
    const { ESPECIALES } = require('./mascotaExtras.js');
    const st = (l, k) => (l.stats && l.stats[k]) || 5;
    const base = (l) => l.poder * (1 + extraAnimos(l.animos));
    const usada = { a: false, b: false };
    const rondas = [];
    let va = 0; let vb = 0;
    while (va < 2 && vb < 2) {
        const tirada = (yo, lado, perdiendo) => {
            let v = base(yo) * (0.7 + azar() * 0.6);
            let ev = null;
            if (azar() < st(yo, 'agilidad') / 250) { v *= 1.5; ev = 'critico'; }
            const esp = ESPECIALES[yo.especie];
            if (esp && !usada[lado] && perdiendo) { usada[lado] = true; v *= esp.mult || 1; ev = 'especial'; }
            return { v, ev };
        };
        const ta = tirada(a, 'a', vb > va);
        const tb = tirada(b, 'b', va > vb);
        let ra = ta.v * (1 - Math.min(0.25, st(b, 'defensa') / 400));
        let rb = tb.v * (1 - Math.min(0.25, st(a, 'defensa') / 400));
        if (ta.ev === 'especial' && ESPECIALES[a.especie]?.reduceRival) rb *= ESPECIALES[a.especie].reduceRival;
        if (tb.ev === 'especial' && ESPECIALES[b.especie]?.reduceRival) ra *= ESPECIALES[b.especie].reduceRival;
        let eventoA = ta.ev; let eventoB = tb.ev;
        if (azar() < st(b, 'agilidad') / 350) { ra *= 0.6; eventoB = eventoB || 'esquiva'; }
        if (azar() < st(a, 'agilidad') / 350) { rb *= 0.6; eventoA = eventoA || 'esquiva'; }
        ra = Math.round(ra); rb = Math.round(rb);
        rondas.push({ a: ra, b: rb, eventoA, eventoB });
        if (ra >= rb) va++; else vb++;
    }
    return { ganador: va > vb ? 'a' : 'b', rondas };
}

// Empareja las mascotas del día por fuerza parecida. `lista`: [{ guildId, poder }].
// Devuelve [[a, b|null], …] (null = contra una criatura salvaje).
function emparejar(lista, azar = Math.random) {
    const orden = [...lista].sort((x, y) => (y.poder - x.poder) || (azar() - 0.5));
    const parejas = [];
    for (let i = 0; i < orden.length; i += 2) parejas.push([orden[i], orden[i + 1] || null]);
    return parejas;
}

// Criatura salvaje para quien no tiene rival: más o menos igual de fuerte.
function salvajePara(poder, azar = Math.random) {
    return { poder: Math.max(20, Math.round(poder * (0.8 + azar() * 0.35))), nivel: null };
}

// Clave de mes y día en UTC.
const mesClave = (d = new Date()) => d.toISOString().slice(0, 7);
const diaClave = (d = new Date()) => d.toISOString().slice(0, 10);

// Nombre válido para la mascota: 2-20 letras, sin menciones ni enlaces.
function nombreValido(n) {
    const s = String(n || '').trim();
    return s.length >= 2 && s.length <= 20 && !/[<>@#`*_~|]|https?:|discord\.gg/i.test(s);
}

// Recuento de la votación del huevo. Devuelve { especie, nombre }.
function ganadoresVotacion(v = {}, azar = Math.random) {
    const cuenta = {};
    for (const x of v.especies || []) if (ESPECIES[x.especie]) cuenta[x.especie] = (cuenta[x.especie] || 0) + 1;
    const ids = Object.keys(ESPECIES);
    const max = Math.max(0, ...Object.values(cuenta));
    const empatadas = max ? ids.filter((id) => cuenta[id] === max) : ids;
    const especie = empatadas[Math.floor(azar() * empatadas.length) % empatadas.length];
    const nombres = [...(v.nombres || [])].filter((n) => nombreValido(n.nombre))
        .sort((x, y) => (y.votos || []).length - (x.votos || []).length);
    const nombre = nombres.length && (nombres[0].votos || []).length ? nombres[0].nombre : ESPECIES[especie].nombre;
    return { especie, nombre, votos: cuenta };
}

module.exports = {
    ESPECIES, SALVAJE, FORMAS, FASES, VENTAJAS, NIVEL_MAX,
    xpParaSubir, sumarXp, faseDe, formaDe, enForma, ventajasDe, bonusXp, descuentoBromas, animoDe,
    pasarTiempo, comida, despierta, poderDe, extraAnimos, azarCon, combatir, emparejar, salvajePara,
    mesClave, diaClave, nombreValido, ganadoresVotacion, clamp,
};
