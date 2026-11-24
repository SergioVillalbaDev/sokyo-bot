// Eventos de temporada (1.32.0). Fechas fijas cada año (UTC). Mientras dura uno:
//   · /diario da un `bonusDiario` más de oro
//   · en el 🎀 Armario de /compi se puede comprar su accesorio exclusivo (solo durante el evento)
//   · el jefe de la semana sale «disfrazado» (su nombre lleva el emoji del evento)
// Puro: sin base de datos.
const EVENTOS = [
    { id: 'sanvalentin', desde: [2, 7], hasta: [2, 15], emoji: '💘', color: '#f43f5e', es: 'San Valentín', en: 'Valentine’s', bonusDiario: 0.2, accesorio: 'corazones_amor' },
    { id: 'primavera', desde: [3, 20], hasta: [4, 5], emoji: '🌷', color: '#4ade80', es: 'Fiesta de primavera', en: 'Spring festival', bonusDiario: 0.2, accesorio: 'corona_flores' },
    { id: 'verano', desde: [7, 1], hasta: [8, 31], emoji: '🏖️', color: '#38bdf8', es: 'Verano', en: 'Summer', bonusDiario: 0.15, accesorio: 'gafas_sol_verano' },
    { id: 'halloween', desde: [10, 15], hasta: [11, 2], emoji: '🎃', color: '#f97316', es: 'Halloween', en: 'Halloween', bonusDiario: 0.25, accesorio: 'calabaza' },
    { id: 'otono', desde: [11, 15], hasta: [11, 30], emoji: '🍁', color: '#ea580c', es: 'Festival de otoño', en: 'Autumn festival', bonusDiario: 0.2, accesorio: 'hojas' },
    { id: 'navidad', desde: [12, 15], hasta: [1, 6], emoji: '🎄', color: '#22c55e', es: 'Navidad', en: 'Christmas', bonusDiario: 0.3, accesorio: 'gorro_navidad' },
];
// ¿Está la fecha dentro (incluidos los dos días)? Los que cruzan de año (Navidad) también.
function dentro(ev, d) {
    const m = d.getUTCMonth() + 1; const dia = d.getUTCDate();
    const n = m * 100 + dia; const a = ev.desde[0] * 100 + ev.desde[1]; const b = ev.hasta[0] * 100 + ev.hasta[1];
    return a <= b ? n >= a && n <= b : n >= a || n <= b;
}
function eventoActivo(ahora = Date.now()) {
    const d = new Date(ahora);
    return EVENTOS.find((ev) => dentro(ev, d)) || null;
}
// Cuándo acaba (último segundo del último día, UTC).
function finDe(ev, ahora = Date.now()) {
    const d = new Date(ahora);
    let y = d.getUTCFullYear();
    if (ev.desde[0] > ev.hasta[0] && d.getUTCMonth() + 1 >= ev.desde[0]) y += 1; // cruza de año
    return new Date(Date.UTC(y, ev.hasta[0] - 1, ev.hasta[1], 23, 59, 59));
}
// El próximo evento (para decir «el siguiente es…»).
function proximo(ahora = Date.now()) {
    const d = new Date(ahora);
    let mejor = null;
    for (const ev of EVENTOS) {
        let y = d.getUTCFullYear();
        let ini = Date.UTC(y, ev.desde[0] - 1, ev.desde[1]);
        if (ini <= ahora) ini = Date.UTC(++y, ev.desde[0] - 1, ev.desde[1]);
        if (!mejor || ini < mejor.ini) mejor = { ev, ini: new Date(ini) };
    }
    return mejor;
}
const textoEvento = (ev, idioma = 'es', ahora = Date.now()) => (ev ? (idioma === 'en'
    ? `${ev.emoji} **${ev.en}** until <t:${Math.floor(finDe(ev, ahora).getTime() / 1000)}:D>: +${Math.round(ev.bonusDiario * 100)}% gold on /daily and an exclusive accessory in /companion → 🎀 Wardrobe`
    : `${ev.emoji} **${ev.es}** hasta el <t:${Math.floor(finDe(ev, ahora).getTime() / 1000)}:D>: +${Math.round(ev.bonusDiario * 100)} % de oro en /diario y un accesorio exclusivo en /compi → 🎀 Armario`) : '');

module.exports = { EVENTOS, eventoActivo, finDe, proximo, dentro, textoEvento };
