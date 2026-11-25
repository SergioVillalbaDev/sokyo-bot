// Combates de compañeros en Discord (1.32.0). Reglas en utils/combateNucleo.js; dibujos en
// utils/combateArte.js. Comando /jugar combate (slash/fight.js):
//   · retar @alguien [apuesta] → reto con Aceptar/Rechazar; al aceptar se cobra la apuesta a los dos
//   · torre → el siguiente piso del mes (5 intentos al día); premios la primera vez que subes
//   · practica → contra una criatura de tu nivel, sin premios ni riesgo
//   · perfil / ranking / mazo / jefe / ayuda
// Cada combate es UN mensaje en el canal que se va editando ronda a ronda (GIF de la ronda). Los dos
// eligen a la vez con botones (cbt_a:<id>:<acción>); quien no elige en 40 s hace lo que haría la IA.
// Las cartas se eligen en un mensaje privado (cbt_m:<id>). Las partidas viven en memoria; si el bot se
// reinicia, las apuestas se devuelven (devolverPendientes, al arrancar).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const PerfilCombate = require('../models/PerfilCombate.js');
const CombatePvP = require('../models/CombatePvP.js');
const C = require('./combateNucleo.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const { t } = require('./i18n.js');

const ESPERA_RONDA = 40 * 1000;
const ESPERA_RETO = 2 * 60 * 1000;
const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const nuevoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const diaDe = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 10);
const mesDe = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 7);

const partidas = new Map();   // id → partida en curso
const enJuego = new Map();    // `${guildId}:${userId}` → id de la partida (nadie puede estar en dos)
const retos = new Map();      // id → reto pendiente

// ¿Están los combates disponibles aquí? (necesitan el casino activo, que es de donde salen las mascotas)
const activos = (cfg) => !!(cfg?.casino?.activo && cfg?.combate?.activo !== false);
const textoApagado = (idioma) => t(idioma, '⚔️ Los combates no están activados en este servidor (panel → Diversión → Casino: actívalo para tener mascotas y combates).', '⚔️ Battles aren’t turned on on this server (panel → Fun → Casino: turn it on to get pets and battles).');
const apuestaMax = (cfg) => Math.max(0, cfg?.combate?.apuestaMax ?? 5000);

// ---------------------------------------------------------------------------
// Luchadores
// ---------------------------------------------------------------------------
// El luchador de alguien: su compañero equipado (o el más fuerte), con su mazo. null si no tiene.
async function luchadorDe(guildId, userId, nombre, cfg) {
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    if (!col || !(col.mascotas || []).length) return null;
    const ahora = Date.now();
    let m = (col.mascotas || []).find((x) => x.id === col.equipada);
    if (!m) m = [...col.mascotas].sort((a, b) => C.poder(C.stats(b, ahora)) - C.poder(C.stats(a, ahora)))[0];
    const s = C.stats(m, ahora);
    const mazo = cfg?.compis?.anime ? C.prepararMazo(col.mazo || [], col.cartas || [], col.seriesCompletas || [], col.holos || []) : [];
    const l = C.luchador({ nombre, id: m.id, s, mazo, dueno: userId });
    l.nivel = s.nivel; l.variante = m.variante || null; l.mascota = m.apodo || K.def(m.id).es;
    return { l, col, m, s };
}
const nombreDe = (member, user) => member?.displayName || user?.globalName || user?.username || '???';

// ---------------------------------------------------------------------------
// Mensaje del combate
// ---------------------------------------------------------------------------
function botones(p, idioma) {
    const id = p.id;
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cbt_a:${id}:atacar`).setEmoji('⚔️').setStyle(ButtonStyle.Danger).setLabel(t(idioma, 'Atacar', 'Attack')),
        new ButtonBuilder().setCustomId(`cbt_a:${id}:defender`).setEmoji('🛡️').setStyle(ButtonStyle.Primary).setLabel(t(idioma, 'Defender', 'Defend')),
        new ButtonBuilder().setCustomId(`cbt_a:${id}:especial`).setEmoji('✨').setStyle(ButtonStyle.Success).setLabel(t(idioma, `Especial (${C.ENERGIA_ESPECIAL}⚡)`, `Special (${C.ENERGIA_ESPECIAL}⚡)`)),
        new ButtonBuilder().setCustomId(`cbt_m:${id}`).setEmoji('🃏').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Cartas', 'Cards')),
        new ButtonBuilder().setCustomId(`cbt_r:${id}`).setEmoji('🏳️').setStyle(ButtonStyle.Secondary),
    )];
}
const etiquetaAccion = (acc, l, idioma) => {
    if (acc === 'atacar') return t(idioma, '⚔️ atacar', '⚔️ attack');
    if (acc === 'defender') return t(idioma, '🛡️ defenderse', '🛡️ defend');
    if (acc === 'especial') { const e = C.ESPECIALES[l.el]; return `${e.emoji} ${t(idioma, e.es, e.en)}`; }
    const c = l.mazo[Number(String(acc).slice(6))];
    return c ? `🃏 ${t(idioma, c.tecnica.es, c.tecnica.en)}` : '?';
};
// Lo que ha pasado en la ronda, en pocas líneas.
function textoRonda(p, ev, idioma) {
    const nom = (k) => `**${p.c[k].nombre}**`;
    const l = [];
    for (const e of ev) {
        const x = nom(e.lado);
        const extra = [e.crit ? t(idioma, '¡crítico!', 'critical!') : '', e.fe > 1 ? t(idioma, 'muy eficaz', 'super effective') : e.fe < 1 ? t(idioma, 'poco eficaz', 'not very effective') : ''].filter(Boolean).join(', ');
        const golpe = e.esquiva ? t(idioma, 'pero lo esquivan', 'but it’s dodged') : e.danio ? `**-${e.danio}**${extra ? ` (${extra})` : ''}` : '';
        if (e.tipo === 'atacar') l.push(`⚔️ ${x} ${t(idioma, 'ataca', 'attacks')}: ${golpe}`);
        else if (e.tipo === 'especial') l.push(`${e.emoji} ${x} ${t(idioma, 'usa', 'uses')} **${t(idioma, e.nombre.es, e.nombre.en)}**: ${golpe}${e.quema ? ' 🔥' : ''}${e.aturde ? ' ❄️' : ''}${e.cura ? ` 💚+${e.cura}` : ''}${e.escudo ? ' 🛡️' : ''}`);
        else if (e.tipo === 'carta') l.push(`🃏 ${x} ${t(idioma, 'juega', 'plays')} **${K.def(e.carta).es}** → ${t(idioma, e.tecnica.es, e.tecnica.en)}${golpe ? `: ${golpe}` : ''}${e.cura ? ` 💚+${e.cura}` : ''}${e.escudo ? ' 🛡️' : ''}${e.aturde ? ' ❄️' : ''}${e.confunde ? ' 💫' : ''}${e.maldice ? ' 💀' : ''}${e.debilita ? ' 🥀' : ''}`);
        else if (e.tipo === 'defender') l.push(`🛡️ ${x} ${t(idioma, 'se defiende', 'defends')}${e.cura ? ` 💚+${e.cura}` : ''}`);
        else if (e.tipo === 'quema') l.push(`🔥 ${x} ${t(idioma, 'se quema', 'burns')}: -${e.danio}`);
        else if (e.tipo === 'maldicion') l.push(`💀 ${x} ${t(idioma, 'sufre la maldición', 'suffers the curse')}: -${e.danio}`);
        else if (e.tipo === 'regenera') l.push(`🌿 ${x} +${e.cura}`);
        else if (e.tipo === 'confuso') l.push(`💫 ${x} ${t(idioma, 'se hace un lío y se golpea', 'is confused and hits itself')}: -${e.danio}`);
        else if (e.tipo === 'aturdido') l.push(`❄️ ${x} ${t(idioma, 'está congelado y no se mueve', 'is frozen and can’t move')}`);
    }
    return l.join('\n');
}
function estadoElecciones(p, idioma) {
    if (p.tipo !== 'pvp') return t(idioma, 'Elige tu jugada · 40 s', 'Pick your move · 40 s');
    return ['a', 'b'].map((k) => `${p.elecciones[k] ? '✅' : '⏳'} ${p.c[k].nombre}`).join('  ·  ') + t(idioma, '  ·  40 s por ronda', '  ·  40 s per round');
}
function embedPartida(p, idioma, { log = '', fin = false } = {}) {
    const tit = p.tipo === 'torre' ? t(idioma, `🗼 Torre · piso ${p.piso}`, `🗼 Tower · floor ${p.piso}`) : p.tipo === 'practica' ? t(idioma, '🎯 Práctica', '🎯 Practice') : `⚔️ ${p.c.a.nombre} vs ${p.c.b.nombre}${p.apuesta ? ` · 🪙 ${fmt(p.apuesta, idioma)}` : ''}`;
    const e = new EmbedBuilder().setColor(fin ? '#f59e0b' : '#7c3aed').setTitle(`${tit}${fin ? '' : ` · ${t(idioma, 'Ronda', 'Round')} ${p.c.ronda + 1}`}`);
    if (log) e.setDescription(log.slice(0, 4000));
    if (!fin) e.setFooter({ text: estadoElecciones(p, idioma) });
    return e;
}
// Todas las ediciones del mensaje de una partida, en fila (una no adelanta a otra).
function editar(p, payload) {
    p.cola = (p.cola || Promise.resolve()).then(() => p.msg.edit(payload)).catch((e) => console.warn('Combate (editar):', e.message));
    return p.cola;
}

// ---------------------------------------------------------------------------
// Empezar una partida
// ---------------------------------------------------------------------------
async function empezar({ canal, guildId, tipo, a, b, jugadores, apuesta = 0, idioma, piso = null, pvpId = null }) {
    const id = nuevoId();
    const c = C.nuevoCombate(a, b);
    const p = { id, guildId, tipo, c, jugadores, apuesta, idioma, piso, pvpId, elecciones: {}, ocupado: false, creado: Date.now(), timeoutsSeguidos: 0 };
    for (const k of ['a', 'b']) if (jugadores[k]) enJuego.set(`${guildId}:${jugadores[k]}`, id);
    partidas.set(id, p);
    const png = await require('./combateArte.js').arena(c, { titulo: 'VS' }).catch(() => null);
    const e = embedPartida(p, idioma, { log: textoInicio(p, idioma) });
    if (png) e.setImage('attachment://arena.png');
    p.embed = e;
    p.msg = await canal.send({ embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'arena.png' })] : [], components: botones(p, idioma), allowedMentions: { users: Object.values(jugadores).filter(Boolean) } });
    armarTemporizador(p);
    return p;
}
function textoInicio(p, idioma) {
    const fila = (k) => {
        const l = p.c[k]; const el = C.ELEMENTOS[l.el];
        return `${el.emoji} **${l.nombre}**${l.mascota && l.mascota !== l.nombre ? ` (${l.mascota})` : ''} · ❤️ ${l.max} ⚔️ ${l.atk} 🛡️ ${l.def} 💨 ${l.vel}${l.mazo.length ? ` · 🃏 ${l.mazo.length}` : ''}`;
    };
    const fe = C.factorElemento(p.c.a.el, p.c.b.el);
    return [
        fila('a'), fila('b'),
        fe > 1 ? t(idioma, `💡 ${C.ELEMENTOS[p.c.a.el].emoji} tiene ventaja sobre ${C.ELEMENTOS[p.c.b.el].emoji}`, `💡 ${C.ELEMENTOS[p.c.a.el].emoji} has the edge over ${C.ELEMENTOS[p.c.b.el].emoji}`) : fe < 1 ? t(idioma, `💡 ${C.ELEMENTOS[p.c.b.el].emoji} tiene ventaja sobre ${C.ELEMENTOS[p.c.a.el].emoji}`, `💡 ${C.ELEMENTOS[p.c.b.el].emoji} has the edge over ${C.ELEMENTOS[p.c.a.el].emoji}`) : '',
        p.jugadores.b ? t(idioma, `<@${p.jugadores.a}> y <@${p.jugadores.b}>: elegid vuestra jugada a la vez.`, `<@${p.jugadores.a}> and <@${p.jugadores.b}>: pick your moves at the same time.`) : t(idioma, `<@${p.jugadores.a}>, elige tu jugada.`, `<@${p.jugadores.a}>, pick your move.`),
        t(idioma, `*⚔️ ataque (+1⚡) · 🛡️ defensa (menos daño, +1⚡) · ✨ especial (${C.ENERGIA_ESPECIAL}⚡) · 🃏 cada carta del mazo, una vez*`, `*⚔️ attack (+1⚡) · 🛡️ defend (less damage, +1⚡) · ✨ special (${C.ENERGIA_ESPECIAL}⚡) · 🃏 each deck card, once*`),
    ].filter(Boolean).join('\n');
}
function armarTemporizador(p) {
    clearTimeout(p.timer);
    p.timer = setTimeout(() => {
        if (!partidas.has(p.id) || p.ocupado) return;
        // Quien no ha elegido hace lo que haría la IA. Si nadie elige 3 rondas seguidas, se acaba solo.
        const nadie = !Object.keys(p.elecciones).length;
        p.timeoutsSeguidos = nadie ? p.timeoutsSeguidos + 1 : 0;
        resolver(p, { porTiempo: true }).catch((e) => console.error('Combate (tiempo):', e));
    }, ESPERA_RONDA);
}

// ---------------------------------------------------------------------------
// Elegir y resolver
// ---------------------------------------------------------------------------
function ladoDe(p, userId) { return p.jugadores.a === userId ? 'a' : p.jugadores.b === userId ? 'b' : null; }
async function elegir(interaction, pid, accion, idioma) {
    const p = partidas.get(pid);
    const efimero = interaction.message?.flags?.has?.(64);
    const responder = (content) => (efimero ? interaction.update({ content, components: [] }) : interaction.reply({ content, flags: 64 }));
    if (!p) return responder(t(idioma, '⌛ Este combate ya ha terminado.', '⌛ This battle is over.'));
    const lado = ladoDe(p, interaction.user.id);
    if (!lado) return responder(t(idioma, '👀 Este combate no es tuyo. Reta a alguien con `/jugar combate retar`.', '👀 This isn’t your battle. Challenge someone with `/games fight challenge`.'));
    if (p.ocupado) return responder(t(idioma, '⏳ Un segundo, se está resolviendo la ronda…', '⏳ One second, the round is resolving…'));
    const l = p.c[lado];
    if (!C.valida(l, accion)) {
        return responder(accion === 'especial' ? t(idioma, `⚡ Te falta energía: tienes ${l.energia} y el especial cuesta ${C.ENERGIA_ESPECIAL}. Atacar y defender dan energía.`, `⚡ Not enough energy: you have ${l.energia} and the special costs ${C.ENERGIA_ESPECIAL}. Attacking and defending give energy.`) : t(idioma, 'Esa carta ya la has usado.', 'You already used that card.'));
    }
    p.elecciones[lado] = accion;
    if (p.tipo !== 'pvp') p.elecciones.b = C.eleccionIA(p.c.b, p.c.a);
    const listo = p.elecciones.a && p.elecciones.b;
    await responder(listo ? t(idioma, `✅ ${etiquetaAccion(accion, l, idioma)}`, `✅ ${etiquetaAccion(accion, l, idioma)}`) : t(idioma, `✅ Has elegido ${etiquetaAccion(accion, l, idioma)}. Esperando a tu rival…`, `✅ You picked ${etiquetaAccion(accion, l, idioma)}. Waiting for your opponent…`));
    if (listo) return resolver(p);
    // Que se vea quién ha elegido ya (sin decir qué).
    if (!p.embed) return null;
    p.embed.setFooter({ text: estadoElecciones(p, p.idioma) });
    return editar(p, { embeds: [p.embed] });
}
// Menú privado con tus cartas.
async function menuCartas(interaction, pid, idioma) {
    const p = partidas.get(pid);
    if (!p) return interaction.reply({ content: t(idioma, '⌛ Este combate ya ha terminado.', '⌛ This battle is over.'), flags: 64 });
    const lado = ladoDe(p, interaction.user.id);
    if (!lado) return interaction.reply({ content: t(idioma, '👀 Este combate no es tuyo.', '👀 This isn’t your battle.'), flags: 64 });
    const l = p.c[lado];
    if (!l.mazo.length) return interaction.reply({ content: t(idioma, '🃏 No llevas cartas. Prepara tu mazo con `/jugar combate mazo` (hasta 3 cartas de anime de tu álbum).', '🃏 You have no cards. Build your deck with `/games fight deck` (up to 3 anime cards from your album).'), flags: 64 });
    const fila = new ActionRowBuilder().addComponents(l.mazo.map((c, i) => new ButtonBuilder()
        .setCustomId(`cbt_a:${pid}:carta:${i}`).setStyle(c.usada ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(c.usada)
        .setLabel(`${K.def(c.id).es.split(' ')[0]} · ${t(idioma, c.tecnica.es, c.tecnica.en)}`.slice(0, 80)).setEmoji(c.usada ? '✖️' : '🃏')));
    const lineas = l.mazo.map((c) => `${c.usada ? '~~' : ''}🃏 **${K.def(c.id).es}** — ${t(idioma, c.tecnica.es, c.tecnica.en)}: ${C.textoTecnica(c.tecnica, idioma)}${c.usada ? '~~' : ''}`);
    return interaction.reply({ content: `${lineas.join('\n')}\n*${t(idioma, 'Cada carta, una vez por combate.', 'Each card, once per battle.')}*`, components: [fila], flags: 64 });
}
async function rendirse(interaction, pid, idioma) {
    const p = partidas.get(pid);
    if (!p) return interaction.reply({ content: t(idioma, '⌛ Este combate ya ha terminado.', '⌛ This battle is over.'), flags: 64 });
    const lado = ladoDe(p, interaction.user.id);
    if (!lado) return interaction.reply({ content: t(idioma, '👀 Este combate no es tuyo.', '👀 This isn’t your battle.'), flags: 64 });
    if (p.ocupado) return interaction.reply({ content: t(idioma, '⏳ Un segundo…', '⏳ One second…'), flags: 64 });
    await interaction.reply({ content: t(idioma, '🏳️ Te has rendido.', '🏳️ You surrendered.'), flags: 64 });
    p.c[lado].hp = 0;
    p.c.fin = { ganador: lado === 'a' ? 'b' : 'a', motivo: 'rendicion' };
    return terminar(p, t(p.idioma, `🏳️ **${p.c[lado].nombre}** se rinde.`, `🏳️ **${p.c[lado].nombre}** surrenders.`), null);
}
async function resolver(p, { porTiempo = false } = {}) {
    if (p.ocupado || !partidas.has(p.id)) return;
    p.ocupado = true;
    clearTimeout(p.timer);
    try {
        // Nadie ha jugado en 3 rondas: se acaba (gana quien tenga más vida).
        if (porTiempo && p.timeoutsSeguidos >= 3) {
            p.c.fin = { ganador: p.c.a.hp / p.c.a.max >= p.c.b.hp / p.c.b.max ? 'a' : 'b', motivo: 'abandono' };
            return await terminar(p, t(p.idioma, '💤 Nadie juega: el combate se acaba aquí.', '💤 Nobody is playing: the battle ends here.'), null);
        }
        for (const k of ['a', 'b']) if (!p.elecciones[k]) p.elecciones[k] = C.eleccionIA(p.c[k], p.c[k === 'a' ? 'b' : 'a']);
        const antes = { a: JSON.parse(JSON.stringify(p.c.a)), b: JSON.parse(JSON.stringify(p.c.b)) };
        const ev = C.ronda(p.c, { ...p.elecciones });
        p.elecciones = {};
        const log = textoRonda(p, ev, p.idioma);
        if (p.c.fin) return await terminar(p, log, { antes, ev });
        const gif = await require('./combateArte.js').gifRonda(p.c, antes, ev, { titulo: `${t(p.idioma, 'RONDA', 'ROUND')} ${p.c.ronda + 1}`, idioma: p.idioma }).catch((e) => { console.warn('GIF ronda:', e.message); return null; });
        const e = embedPartida(p, p.idioma, { log: `${log}${porTiempo ? `\n${t(p.idioma, '*⌛ Se acabó el tiempo: jugó por ti la IA.*', '*⌛ Time’s up: the AI played for you.*')}` : ''}` });
        if (gif) e.setImage('attachment://ronda.gif');
        p.embed = e;
        await editar(p, { embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'ronda.gif' })] : [], attachments: [], components: botones(p, p.idioma) });
        armarTemporizador(p);
    } finally {
        p.ocupado = false;
    }
}

// ---------------------------------------------------------------------------
// Final y premios
// ---------------------------------------------------------------------------
async function terminar(p, log, anim) {
    clearTimeout(p.timer);
    partidas.delete(p.id);
    for (const k of ['a', 'b']) if (p.jugadores[k]) enJuego.delete(`${p.guildId}:${p.jugadores[k]}`);
    const idioma = p.idioma;
    const g = p.c.fin.ganador; const pierde = g === 'a' ? 'b' : 'a';
    const lineas = [log];
    lineas.push(t(idioma, `\n🏆 **¡Gana ${p.c[g].nombre}!**`, `\n🏆 **${p.c[g].nombre} wins!**`));
    let botonesFin = [];
    try {
        if (p.tipo === 'pvp') lineas.push(...await premiosPvP(p, g, pierde));
        else if (p.tipo === 'torre') { const r = await premiosTorre(p, g === 'a'); lineas.push(...r.lineas); botonesFin = r.botones; }
        else lineas.push(t(idioma, '*Práctica: sin premios ni riesgo. ¡Prueba en la torre o reta a alguien!*', '*Practice: no rewards or risk. Try the tower or challenge someone!*'));
    } catch (e) { console.error('Combate (premios):', e); }
    if (p.tipo === 'pvp') botonesFin.push(new ButtonBuilder().setCustomId(`cbt_rev:${p.jugadores.a}:${p.jugadores.b}:${p.apuesta || 0}`).setEmoji('🔁').setStyle(ButtonStyle.Primary).setLabel(t(idioma, 'Revancha', 'Rematch')));
    if (p.tipo === 'practica') botonesFin.push(new ButtonBuilder().setCustomId(`cbt_otra:${p.jugadores.a}`).setEmoji('🎯').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Otra práctica', 'Practice again')));
    botonesFin.push(new ButtonBuilder().setCustomId(`cbt_perfil:${p.jugadores.a}`).setEmoji('📊').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mi perfil', 'My profile')));
    const CA = require('./combateArte.js');
    const img = anim ? await CA.gifRonda(p.c, anim.antes, anim.ev, { idioma, ganadorNombre: p.c[g].nombre }).catch(() => null) : await CA.arena(p.c, { titulo: '', ganador: p.c[g].nombre }).catch(() => null);
    const nombre = anim ? 'final.gif' : 'final.png';
    const e = embedPartida(p, idioma, { log: lineas.filter(Boolean).join('\n'), fin: true });
    if (img) e.setImage(`attachment://${nombre}`);
    await editar(p, { embeds: [e], files: img ? [new AttachmentBuilder(img, { name: nombre })] : [], attachments: [], components: [new ActionRowBuilder().addComponents(botonesFin.slice(0, 5))], allowedMentions: { parse: [] } });
}

async function perfilDe(guildId, userId) {
    return PerfilCombate.findOneAndUpdate({ guildId, userId }, { $setOnInsert: { guildId, userId } }, { upsert: true, returnDocument: 'after' }).lean();
}
async function premiosPvP(p, g, pierde) {
    const idioma = p.idioma; const dia = diaDe();
    const uG = p.jugadores[g]; const uP = p.jugadores[pierde];
    const [pg, pp] = await Promise.all([perfilDe(p.guildId, uG), perfilDe(p.guildId, uP)]);
    const lineas = [];
    // Clasificación: contra la misma persona, solo ELO_MISMA_PAREJA_DIA combates al día cuentan.
    const parejaHoy = (pf, otro) => (pf.hoy?.dia === dia ? (pf.hoy.parejas || {})[otro] || 0 : 0);
    const cuenta = parejaHoy(pg, uP) < C.ELO_MISMA_PAREJA_DIA;
    const r = C.elo(pg.elo, pp.elo, 'a');
    const victoriasHoy = pg.hoy?.dia === dia ? pg.hoy.victorias || 0 : 0;
    const premio = victoriasHoy < C.VICTORIAS_PREMIADAS ? C.PREMIO_VICTORIA : 0;
    const actualizar = async (pf, gana, otro, nuevoElo) => {
        const hoy = pf.hoy?.dia === dia ? { ...pf.hoy, parejas: { ...(pf.hoy.parejas || {}) } } : { dia, victorias: 0, parejas: {} };
        hoy.parejas[otro] = (hoy.parejas[otro] || 0) + 1;
        if (gana) hoy.victorias = (hoy.victorias || 0) + 1;
        const racha = gana ? (pf.racha || 0) + 1 : 0;
        await PerfilCombate.updateOne({ _id: pf._id }, { $set: { hoy, racha, mejorRacha: Math.max(pf.mejorRacha || 0, racha), ...(cuenta ? { elo: nuevoElo, mejorElo: Math.max(pf.mejorElo || 0, nuevoElo) } : {}) }, $inc: gana ? { victorias: 1 } : { derrotas: 1 } });
        return racha;
    };
    const rachaG = await actualizar(pg, true, uP, r.a);
    await actualizar(pp, false, uG, r.b);
    if (cuenta) {
        const antes = C.rangoDe(pg.elo); const ahora = C.rangoDe(r.a);
        lineas.push(t(idioma, `📈 <@${uG}> +${r.cambio} ELO (${r.a}) · 📉 <@${uP}> −${r.cambio} ELO (${r.b})`, `📈 <@${uG}> +${r.cambio} ELO (${r.a}) · 📉 <@${uP}> −${r.cambio} ELO (${r.b})`));
        if (ahora.desde > antes.desde) lineas.push(t(idioma, `🎖️ **¡<@${uG}> sube a ${ahora.emoji} ${ahora.es}!**`, `🎖️ **<@${uG}> ranks up to ${ahora.emoji} ${ahora.en}!**`));
        // 1.33.0: si sois de clanes rivales esta semana, suma para la guerra.
        const guerra = await require('./guerraClanes.js').combate(p.guildId, uG, uP, idioma).catch(() => null);
        if (guerra) lineas.push(guerra);
    } else lineas.push(t(idioma, '*Ya habéis combatido mucho hoy entre vosotros: este no cuenta para la clasificación.*', '*You two have fought a lot today: this one doesn’t count for the ranking.*'));
    if (rachaG >= 3) lineas.push(t(idioma, `🔥 <@${uG}> lleva **${rachaG} victorias seguidas**.`, `🔥 <@${uG}> is on a **${rachaG}-win streak**.`));
    const eco = require('./economia.js').en(p.guildId);
    if (premio) { await eco.darOro(uG, premio); lineas.push(t(idioma, `🪙 +${premio} por la victoria (${victoriasHoy + 1}/${C.VICTORIAS_PREMIADAS} premiadas hoy).`, `🪙 +${premio} for the win (${victoriasHoy + 1}/${C.VICTORIAS_PREMIADAS} rewarded today).`)); }
    // Apuesta: el que gana se lleva las dos menos la comisión.
    if (p.apuesta && p.pvpId) {
        const doc = await CombatePvP.findOneAndUpdate({ _id: p.pvpId, estado: 'en_curso' }, { $set: { estado: 'terminado', ganador: uG, rondas: p.c.ronda } });
        if (doc) {
            const bote = Math.floor(p.apuesta * 2 * (1 - C.COMISION_APUESTA));
            await eco.darOro(uG, bote);
            lineas.push(t(idioma, `💰 <@${uG}> se lleva la apuesta: **🪙 ${fmt(bote, idioma)}**.`, `💰 <@${uG}> takes the bet: **🪙 ${fmt(bote, idioma)}**.`));
        }
    }
    await ColeccionMascotas.updateOne({ guildId: p.guildId, userId: uG }, { $inc: { 'cbt.victorias': 1 } }).catch(() => {});
    const Pase = require('./pase.js');
    const mG = await Pase.registrar(p.guildId, uG, [['combate', 1], ['victoria', 1]], { idioma }).catch(() => []);
    const mP = await Pase.registrar(p.guildId, uP, [['combate', 1]], { idioma }).catch(() => []);
    lineas.push(...mG.map((x) => `<@${uG}> ${x}`), ...mP.map((x) => `<@${uP}> ${x}`));
    return lineas;
}
async function premiosTorre(p, gana) {
    const idioma = p.idioma; const userId = p.jugadores.a;
    const lineas = []; const bts = [];
    const pf = await perfilDe(p.guildId, userId);
    const quedan = C.TORRE_INTENTOS_DIA - (pf.torre?.intentos?.dia === diaDe() ? pf.torre.intentos.n || 0 : 0);
    if (gana) {
        // Solo si de verdad era su siguiente piso (y del mismo mes).
        const ok = await PerfilCombate.updateOne({ _id: pf._id, 'torre.temp': mesDe(), 'torre.piso': p.piso - 1 }, { $set: { 'torre.piso': p.piso, 'torre.mejor': Math.max(pf.torre?.mejor || 0, p.piso) } });
        if (ok.modifiedCount) {
            const pr = C.premioPiso(p.piso);
            const inc = {};
            for (const [k, v] of Object.entries(pr.tickets)) inc[`tickets.${k}`] = v;
            await ColeccionMascotas.updateOne({ guildId: p.guildId, userId }, { ...(Object.keys(inc).length ? { $inc: inc } : {}), $max: { 'cbt.torre': p.piso } }).catch(() => {});
            await require('./economia.js').en(p.guildId).darOro(userId, pr.oro);
            lineas.push(t(idioma, `🗼 **¡Piso ${p.piso} superado!** +🪙 ${fmt(pr.oro, idioma)}${Object.keys(pr.tickets).length ? ` · 🎫 ${Object.keys(pr.tickets).map((k) => k.replace('_', ' ')).join(', ')} (en \`/jugar pase\`)` : ''}`, `🗼 **Floor ${p.piso} cleared!** +🪙 ${fmt(pr.oro, idioma)}${Object.keys(pr.tickets).length ? ` · 🎫 ${Object.keys(pr.tickets).map((k) => k.replace('_', ' ')).join(', ')} (in \`/games pass\`)` : ''}`));
            lineas.push(...await require('./pase.js').registrar(p.guildId, userId, [['torre', 1]], { idioma }).catch(() => []));
        }
        if (quedan > 0) bts.push(new ButtonBuilder().setCustomId(`cbt_torre:${userId}`).setEmoji('⬆️').setStyle(ButtonStyle.Success).setLabel(t(idioma, `Piso ${p.piso + 1} (${quedan} intentos)`, `Floor ${p.piso + 1} (${quedan} tries)`)));
    } else {
        lineas.push(quedan > 0 ? t(idioma, `💪 Te quedan **${quedan}** intentos hoy. Cuida y entrena a tu compañero, mejora tu mazo… ¡y vuelve!`, `💪 You have **${quedan}** tries left today. Care for your companion, improve your deck… and come back!`) : t(idioma, '😴 Sin intentos por hoy. Mañana más.', '😴 No tries left today. More tomorrow.'));
        if (quedan > 0) bts.push(new ButtonBuilder().setCustomId(`cbt_torre:${userId}`).setEmoji('🔁').setStyle(ButtonStyle.Primary).setLabel(t(idioma, `Reintentar (${quedan})`, `Retry (${quedan})`)));
    }
    return { lineas, botones: bts };
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------
function ocupado(guildId, userId) { const id = enJuego.get(`${guildId}:${userId}`); return id && partidas.has(id) ? id : null; }

async function retar(interaction, cfg, idioma, rival, apuesta = 0) {
    const guildId = interaction.guildId; const yo = interaction.user;
    if (!rival || rival.bot || rival.id === yo.id) return { error: t(idioma, 'Elige a otra persona (no un bot) para retar. Para entrenar solo: `/jugar combate practica`.', 'Pick someone else (not a bot). To train alone: `/games fight practice`.') };
    apuesta = Math.max(0, Math.floor(apuesta || 0));
    if (apuesta && cfg?.combate?.apuestas === false) return { error: t(idioma, 'En este servidor los combates son sin apuesta.', 'Battles on this server have no bets.') };
    if (apuesta > apuestaMax(cfg)) return { error: t(idioma, `La apuesta máxima aquí es de 🪙 ${fmt(apuestaMax(cfg), idioma)}.`, `The max bet here is 🪙 ${fmt(apuestaMax(cfg), idioma)}.`) };
    if (ocupado(guildId, yo.id)) return { error: t(idioma, 'Ya estás en un combate. Termínalo primero.', 'You’re already in a battle. Finish it first.') };
    if (ocupado(guildId, rival.id)) return { error: t(idioma, 'Esa persona ya está en un combate.', 'That person is already in a battle.') };
    const memberRival = interaction.options?.getMember?.('member') || await interaction.guild.members.fetch(rival.id).catch(() => null);
    const [la, lb] = await Promise.all([luchadorDe(guildId, yo.id, nombreDe(interaction.member, yo), cfg), luchadorDe(guildId, rival.id, nombreDe(memberRival, rival), cfg)]);
    if (!la) return { error: t(idioma, '🥚 Aún no tienes compañeros para combatir. Consigue uno con `/jugar cofre abrir`.', '🥚 You have no companions to fight with yet. Get one with `/games chest open`.') };
    if (!lb) return { error: t(idioma, `🥚 ${nombreDe(memberRival, rival)} aún no tiene compañeros.`, `🥚 ${nombreDe(memberRival, rival)} has no companions yet.`) };
    if (apuesta) {
        const eco = require('./economia.js').en(guildId);
        const [sa, sb] = await Promise.all([eco.obtenerUsuario(yo.id), eco.obtenerUsuario(rival.id)]);
        if ((sa.balance || 0) < apuesta) return { error: t(idioma, `No tienes 🪙 ${fmt(apuesta, idioma)} para apostar.`, `You don’t have 🪙 ${fmt(apuesta, idioma)} to bet.`) };
        if ((sb.balance || 0) < apuesta) return { error: t(idioma, `${nombreDe(memberRival, rival)} no tiene 🪙 ${fmt(apuesta, idioma)} para esa apuesta.`, `${nombreDe(memberRival, rival)} doesn’t have 🪙 ${fmt(apuesta, idioma)} for that bet.`) };
    }
    const id = nuevoId();
    retos.set(id, { guildId, a: yo.id, b: rival.id, apuesta, hasta: Date.now() + ESPERA_RETO, idioma });
    const vista = C.nuevoCombate(la.l, lb.l);
    const png = await require('./combateArte.js').arena(vista, { titulo: 'VS' }).catch(() => null);
    const pa = await perfilDe(guildId, yo.id); const pb = await perfilDe(guildId, rival.id);
    const ra = C.rangoDe(pa.elo); const rb = C.rangoDe(pb.elo);
    const e = new EmbedBuilder().setColor('#dc2626').setTitle(t(idioma, '⚔️ ¡Reto a combate!', '⚔️ Battle challenge!'))
        .setDescription([
            t(idioma, `<@${rival.id}>, **${la.l.nombre}** te reta con su **${la.l.mascota}**.`, `<@${rival.id}>, **${la.l.nombre}** challenges you with their **${la.l.mascota}**.`),
            `${ra.emoji} ${la.l.nombre} (${pa.elo}) · ${C.ELEMENTOS[la.l.el].emoji} 💪 ${C.poder(la.s)}`,
            `${rb.emoji} ${lb.l.nombre} (${pb.elo}) · ${C.ELEMENTOS[lb.l.el].emoji} 💪 ${C.poder(lb.s)}`,
            apuesta ? t(idioma, `💰 Apuesta: **🪙 ${fmt(apuesta, idioma)}** cada uno (el ganador se lleva ${fmt(Math.floor(apuesta * 2 * (1 - C.COMISION_APUESTA)), idioma)}).`, `💰 Bet: **🪙 ${fmt(apuesta, idioma)}** each (the winner takes ${fmt(Math.floor(apuesta * 2 * (1 - C.COMISION_APUESTA)), idioma)}).`) : '',
            t(idioma, '*Caduca en 2 minutos.*', '*Expires in 2 minutes.*'),
        ].filter(Boolean).join('\n'));
    if (png) e.setImage('attachment://reto.png');
    return { ok: true, msg: {
        content: `<@${rival.id}>`, embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'reto.png' })] : [],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`cbt_ok:${id}`).setEmoji('⚔️').setStyle(ButtonStyle.Success).setLabel(t(idioma, '¡Acepto!', 'I accept!')),
            new ButtonBuilder().setCustomId(`cbt_no:${id}`).setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Ahora no', 'Not now')),
        )],
        allowedMentions: { users: [rival.id] },
    } };
}
async function responderReto(interaction, rid, acepta, cfg, idioma) {
    const r = retos.get(rid);
    if (!r || r.hasta < Date.now()) { retos.delete(rid); return interaction.update({ content: t(idioma, '⌛ Este reto ha caducado.', '⌛ This challenge has expired.'), components: [] }); }
    const yo = interaction.user.id;
    if (yo !== r.b && !(yo === r.a && !acepta)) return interaction.reply({ content: t(idioma, 'Este reto no es para ti.', 'This challenge isn’t for you.'), flags: 64 });
    retos.delete(rid);
    if (!acepta) return interaction.update({ content: t(idioma, yo === r.a ? '❌ Reto cancelado.' : '🙅 Reto rechazado.', yo === r.a ? '❌ Challenge cancelled.' : '🙅 Challenge declined.'), components: [] });
    if (ocupado(r.guildId, r.a) || ocupado(r.guildId, r.b)) return interaction.reply({ content: t(idioma, 'Alguno de los dos ya está en otro combate.', 'One of you is already in another battle.'), flags: 64 });
    await interaction.update({ components: [] });
    const guild = interaction.guild;
    const [ma, mb] = await Promise.all([guild.members.fetch(r.a).catch(() => null), guild.members.fetch(r.b).catch(() => null)]);
    const [la, lb] = await Promise.all([luchadorDe(r.guildId, r.a, nombreDe(ma, ma?.user), cfg), luchadorDe(r.guildId, r.b, nombreDe(mb, mb?.user), cfg)]);
    if (!la || !lb) return interaction.followUp({ content: t(idioma, 'Alguien se ha quedado sin compañeros.', 'Someone no longer has companions.'), flags: 64 });
    let pvpId = null;
    if (r.apuesta) {
        // Se cobra a los dos; si al segundo no le llega, se le devuelve al primero.
        const eco = require('./economia.js').en(r.guildId);
        const okA = await eco.cobrar(r.a, r.apuesta);
        if (okA === null) return interaction.followUp({ content: t(idioma, `❌ <@${r.a}> ya no tiene 🪙 ${fmt(r.apuesta, idioma)}.`, `❌ <@${r.a}> no longer has 🪙 ${fmt(r.apuesta, idioma)}.`), allowedMentions: { parse: [] } });
        const okB = await eco.cobrar(r.b, r.apuesta);
        if (okB === null) { await eco.darOro(r.a, r.apuesta); return interaction.followUp({ content: t(idioma, `❌ <@${r.b}> ya no tiene 🪙 ${fmt(r.apuesta, idioma)}.`, `❌ <@${r.b}> no longer has 🪙 ${fmt(r.apuesta, idioma)}.`), allowedMentions: { parse: [] } }); }
        pvpId = (await CombatePvP.create({ guildId: r.guildId, a: r.a, b: r.b, apuesta: r.apuesta }))._id;
    }
    try {
        await empezar({ canal: interaction.channel, guildId: r.guildId, tipo: 'pvp', a: la.l, b: lb.l, jugadores: { a: r.a, b: r.b }, apuesta: r.apuesta, idioma: t(cfg, 'es', 'en'), pvpId });
    } catch (e) {
        // No se pudo empezar (p. ej. sin permiso para escribir aquí): se devuelve la apuesta ya.
        console.error('Combate (empezar):', e.message);
        for (const u of [r.a, r.b]) { const id = enJuego.get(`${r.guildId}:${u}`); if (id) { partidas.delete(id); enJuego.delete(`${r.guildId}:${u}`); } }
        if (pvpId) {
            const d = await CombatePvP.findOneAndUpdate({ _id: pvpId, estado: 'en_curso' }, { $set: { estado: 'devuelto' } });
            if (d) { const eco = require('./economia.js').en(r.guildId); await eco.darOro(r.a, r.apuesta); await eco.darOro(r.b, r.apuesta); }
        }
        await interaction.followUp({ content: t(idioma, '❌ No he podido empezar el combate aquí (¿me falta permiso para escribir?). Se ha devuelto la apuesta.', '❌ I couldn’t start the battle here (missing permission to post?). The bet was refunded.'), flags: 64 }).catch(() => {});
    }
}
async function torre(interaction, cfg, idioma) {
    const guildId = interaction.guildId; const userId = interaction.user.id;
    if (ocupado(guildId, userId)) return { error: t(idioma, 'Ya estás en un combate. Termínalo primero.', 'You’re already in a battle. Finish it first.') };
    const yo = await luchadorDe(guildId, userId, nombreDe(interaction.member, interaction.user), cfg);
    if (!yo) return { error: t(idioma, '🥚 Necesitas un compañero. Consigue uno con `/jugar cofre abrir`.', '🥚 You need a companion. Get one with `/games chest open`.') };
    const mes = mesDe(); const dia = diaDe();
    let pf = await perfilDe(guildId, userId);
    // Torre nueva cada mes.
    if (pf.torre?.temp !== mes) {
        await PerfilCombate.updateOne({ _id: pf._id }, { $set: { torre: { temp: mes, piso: 0, mejor: pf.torre?.mejor || 0, intentos: { dia, n: 0 } } } });
        pf = await perfilDe(guildId, userId);
    }
    // Gasta un intento (atómico: dos clics a la vez no gastan dos ni juegan dos).
    const usados = pf.torre?.intentos?.dia === dia ? pf.torre.intentos.n || 0 : 0;
    const piso = (pf.torre?.piso || 0) + 1;
    if (piso > 50) return { error: t(idioma, '🏯 ¡Has llegado a la cima de la torre este mes! El mes que viene, otra.', '🏯 You reached the top of the tower this month! A new one next month.') };
    if (usados >= C.TORRE_INTENTOS_DIA) return { error: t(idioma, `😴 Ya has usado tus ${C.TORRE_INTENTOS_DIA} intentos de hoy. Vuelve mañana (la torre se reinicia cada mes).`, `😴 You’ve used your ${C.TORRE_INTENTOS_DIA} tries today. Come back tomorrow (the tower resets monthly).`) };
    const filtro = pf.torre?.intentos?.dia === dia ? { _id: pf._id, 'torre.intentos.n': usados } : { _id: pf._id, 'torre.intentos.dia': pf.torre?.intentos?.dia ?? null };
    const ok = await PerfilCombate.updateOne(filtro, { $set: { 'torre.intentos': { dia, n: usados + 1 } } });
    if (!ok.modifiedCount) return { error: t(idioma, 'Prueba otra vez.', 'Try again.') };
    const en = C.enemigoTorre(piso, mes);
    const dc = en.id === 'golem' ? { es: 'Gólem', en: 'Golem' } : K.def(en.id);
    const nombre = en.jefe ? t(idioma, C.JEFES[en.id.slice(5)]?.es || 'Jefe', C.JEFES[en.id.slice(5)]?.en || 'Boss') : t(idioma, `${dc.es} salvaje`, `Wild ${dc.en}`);
    const b = C.luchador({ nombre, id: en.jefe ? en.id : en.id === 'golem' ? 'srv:golem' : en.id, s: en.s, mazo: en.mazo, ia: true });
    b.nivel = piso;
    try { await empezar({ canal: interaction.channel, guildId, tipo: 'torre', a: yo.l, b, jugadores: { a: userId, b: null }, idioma, piso }); } catch (e) { await PerfilCombate.updateOne({ _id: pf._id, 'torre.intentos.n': { $gt: 0 } }, { $inc: { 'torre.intentos.n': -1 } }).catch(() => {}); const id = enJuego.get(`${guildId}:${userId}`); if (id) partidas.delete(id); enJuego.delete(`${guildId}:${userId}`); return { error: t(idioma, 'No he podido empezar el combate aquí (¿me falta permiso para escribir?).', 'I couldn’t start the battle here (missing permission to post?).') }; }
    return { ok: true, texto: t(idioma, `🗼 Piso ${piso}${en.jefe ? ' · ¡JEFE!' : ''} · intento ${usados + 1}/${C.TORRE_INTENTOS_DIA} de hoy`, `🗼 Floor ${piso}${en.jefe ? ' · BOSS!' : ''} · try ${usados + 1}/${C.TORRE_INTENTOS_DIA} today`) };
}
async function practica(interaction, cfg, idioma) {
    const guildId = interaction.guildId; const userId = interaction.user.id;
    if (ocupado(guildId, userId)) return { error: t(idioma, 'Ya estás en un combate. Termínalo primero.', 'You’re already in a battle. Finish it first.') };
    const yo = await luchadorDe(guildId, userId, nombreDe(interaction.member, interaction.user), cfg);
    if (!yo) return { error: t(idioma, '🥚 Necesitas un compañero. Consigue uno con `/jugar cofre abrir`.', '🥚 You need a companion. Get one with `/games chest open`.') };
    // Un rival del catálogo, de la misma rareza y nivel parecido.
    const rareza = K.def(yo.m.id).rareza;
    const ids = Object.keys(K.COMPANEROS).filter((id) => K.COMPANEROS[id].rareza === rareza && id !== yo.m.id);
    const id = ids[Math.floor(Math.random() * ids.length)] || 'gato';
    const s = C.stats({ id, estrellas: yo.m.estrellas || 1, afinidad: yo.m.afinidad || 0 });
    const b = C.luchador({ nombre: t(idioma, `${K.def(id).es} de práctica`, `Practice ${K.def(id).en}`), id, s, ia: true });
    b.nivel = s.nivel;
    try { await empezar({ canal: interaction.channel, guildId, tipo: 'practica', a: yo.l, b, jugadores: { a: userId, b: null }, idioma }); } catch (e) { const id = enJuego.get(`${guildId}:${userId}`); if (id) partidas.delete(id); enJuego.delete(`${guildId}:${userId}`); return { error: t(idioma, 'No he podido empezar el combate aquí (¿me falta permiso para escribir?).', 'I couldn’t start the battle here (missing permission to post?).') }; }
    return { ok: true, texto: t(idioma, '🎯 ¡A practicar!', '🎯 Let’s practice!') };
}
async function mazo(guildId, userId, ids, idioma, cfg) {
    const col = await ColeccionMascotas.findOne({ guildId, userId }).select('cartas mazo holos seriesCompletas').lean();
    const cartas = col?.cartas || [];
    if (ids && ids.length) {
        if (!cfg?.compis?.anime) return { error: t(idioma, '🃏 Las cartas de anime no están activadas en este servidor.', '🃏 Anime cards aren’t turned on on this server.') };
        const validos = [...new Set(ids.filter(Boolean))].filter((id) => cartas.some((c) => c.id === id)).slice(0, C.MAZO_MAX);
        if (!validos.length) return { error: t(idioma, 'No tienes esas cartas. Mira tu álbum con `/jugar carta album`.', 'You don’t have those cards. See your album with `/games card album`.') };
        await ColeccionMascotas.updateOne({ guildId, userId }, { $set: { mazo: validos } });
        col.mazo = validos;
    }
    const m = C.prepararMazo(col?.mazo || [], cartas, col?.seriesCompletas || [], col?.holos || []);
    const e = new EmbedBuilder().setColor('#7c3aed').setTitle(t(idioma, '🎴 Tu mazo de combate', '🎴 Your battle deck'))
        .setDescription(m.length ? m.map((c, i) => `**${i + 1}.** ${(col.holos || []).includes(c.id) ? '🌈 ' : ''}**${K.def(c.id).es}** (${K.RAREZAS[K.def(c.id).rareza].emoji} ${'★'.repeat((cartas.find((x) => x.id === c.id) || {}).estrellas || 1)})\n　⚔️ ${t(idioma, c.tecnica.es, c.tecnica.en)}: ${C.textoTecnica(c.tecnica, idioma)}`).join('\n')
            : t(idioma, 'Aún no tienes mazo. Elige hasta 3 cartas de tu álbum: `/jugar combate mazo carta1:… carta2:… carta3:…`', 'No deck yet. Pick up to 3 cards from your album: `/games fight deck card1:… card2:… card3:…`'))
        .setFooter({ text: t(idioma, `Cada carta se usa una vez por combate. Dos de la misma serie: +${Math.round(C.SINERGIA_MAZO * 100)} % de fuerza. Más estrellas = más fuerte.`, `Each card is used once per battle. Two from the same series: +${Math.round(C.SINERGIA_MAZO * 100)}% power. More stars = stronger.`) });
    return { embeds: [e] };
}
async function verPerfil(interaction, cfg, idioma, usuario = null) {
    const quien = usuario || interaction.user;
    const member = usuario ? await interaction.guild.members.fetch(quien.id).catch(() => null) : interaction.member;
    const nombre = nombreDe(member, quien);
    const [pf, yo] = await Promise.all([perfilDe(interaction.guildId, quien.id), luchadorDe(interaction.guildId, quien.id, nombre, cfg)]);
    const rango = C.rangoDe(pf.elo);
    const pos = (await PerfilCombate.countDocuments({ guildId: interaction.guildId, elo: { $gt: pf.elo } })) + 1;
    const torreTxt = pf.torre?.temp === mesDe() ? t(idioma, `🗼 Piso ${pf.torre.piso || 0}`, `🗼 Floor ${pf.torre.piso || 0}`) : t(idioma, '🗼 Piso 0', '🗼 Floor 0');
    const img = await require('./combateArte.js').tarjetaPerfil({
        nombre, elo: pf.elo, rangoTexto: t(idioma, rango.es, rango.en),
        lineaRecord: t(idioma, `${pf.victorias} V · ${pf.derrotas} D · racha ${pf.racha || 0} · #${pos} del servidor`, `${pf.victorias} W · ${pf.derrotas} L · streak ${pf.racha || 0} · #${pos} in server`),
        luchador: yo?.s || null, variante: yo?.l.variante, elementoTexto: yo ? t(idioma, C.ELEMENTOS[yo.l.el].es, C.ELEMENTOS[yo.l.el].en) : '',
        mazoTitulo: t(idioma, 'MAZO DE COMBATE', 'BATTLE DECK'), mazo: (yo?.l.mazo || []).map((c) => ({ id: c.id, tecnica: t(idioma, c.tecnica.es, c.tecnica.en) })),
        mazoVacio: t(idioma, 'Sin cartas · /jugar combate mazo', 'No cards · /games fight deck'), lineaTorre: torreTxt,
    }).catch(() => null);
    const e = new EmbedBuilder().setColor(rango.color).setTitle(t(idioma, `📊 Combate · ${nombre}`, `📊 Battle · ${nombre}`));
    if (img) e.setImage('attachment://perfil.png');
    else e.setDescription(`${rango.emoji} ${t(idioma, rango.es, rango.en)} · ${pf.elo} ELO\n${pf.victorias} V · ${pf.derrotas} D`);
    const sig = C.RANGOS.find((r) => r.desde > pf.elo);
    e.setFooter({ text: sig ? t(idioma, `Siguiente rango: ${sig.es} (${sig.desde} ELO) · mejor ELO ${pf.mejorElo}`, `Next rank: ${sig.en} (${sig.desde} ELO) · best ELO ${pf.mejorElo}`) : t(idioma, `Rango máximo · mejor ELO ${pf.mejorElo}`, `Top rank · best ELO ${pf.mejorElo}`) });
    return { embeds: [e], files: img ? [new AttachmentBuilder(img, { name: 'perfil.png' })] : [], allowedMentions: { parse: [] } };
}
async function ranking(interaction, idioma) {
    const top = await PerfilCombate.find({ guildId: interaction.guildId, $or: [{ victorias: { $gt: 0 } }, { derrotas: { $gt: 0 } }] }).sort({ elo: -1 }).limit(10).lean();
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(t(idioma, '🏆 Clasificación de combate', '🏆 Battle ranking'))
        .setDescription(top.length ? top.map((p, i) => { const r = C.rangoDe(p.elo); return `${['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`} <@${p.userId}> · ${r.emoji} **${p.elo}** · ${p.victorias}V ${p.derrotas}D`; }).join('\n')
            : t(idioma, 'Aún no ha combatido nadie. ¡Sé el primero con `/jugar combate retar`!', 'Nobody has fought yet. Be the first with `/games fight challenge`!'))
        .setFooter({ text: t(idioma, 'Rangos: 🥉 Bronce · 🥈 Plata 1100 · 🥇 Oro 1250 · 💠 Platino 1400 · 💎 Diamante 1550 · 👑 Maestro 1700', 'Ranks: 🥉 Bronze · 🥈 Silver 1100 · 🥇 Gold 1250 · 💠 Platinum 1400 · 💎 Diamond 1550 · 👑 Master 1700') });
    return { embeds: [e], allowedMentions: { parse: [] } };
}
function ayuda(idioma) {
    const els = Object.entries(C.GANA_A).map(([a, bs]) => `${C.ELEMENTOS[a].emoji} > ${bs.map((b) => C.ELEMENTOS[b].emoji).join(' ')}`).join(' · ');
    return { embeds: [new EmbedBuilder().setColor('#7c3aed').setTitle(t(idioma, '⚔️ Cómo funcionan los combates', '⚔️ How battles work')).setDescription([
        t(idioma, '**Tu luchador es tu compañero equipado** (`/compi`). Pelea mejor si es más raro, tiene más estrellas y más nivel de afinidad, y si está feliz (con hambre pelea peor). ¡Cuídalo!', '**Your fighter is your equipped companion** (`/companion`). It fights better if it’s rarer, has more stars and affinity level, and if it’s happy (hungry ones fight worse). Take care of it!'),
        t(idioma, `**Cada ronda** elegís a la vez: ⚔️ atacar (+1⚡), 🛡️ defender (recibes menos de la mitad y +1⚡), ✨ especial de tu elemento (${C.ENERGIA_ESPECIAL}⚡) o 🃏 una carta de tu mazo (cada una, una vez). Actúa primero el más rápido.`, `**Each round** you both pick at once: ⚔️ attack (+1⚡), 🛡️ defend (take less than half and +1⚡), ✨ your element’s special (${C.ENERGIA_ESPECIAL}⚡) or 🃏 a deck card (each once). The faster one acts first.`),
        t(idioma, `**Elementos:** ${els}. Con ventaja pegas un ${Math.round((C.VENTAJA - 1) * 100)} % más.`, `**Elements:** ${els}. With the edge you hit ${Math.round((C.VENTAJA - 1) * 100)}% harder.`),
        t(idioma, '**Cartas = técnicas:** cada carta de anime tiene la suya (golpes, curas, escudos, congelar, quemar…). Prepara 3 con `/jugar combate mazo`.', '**Cards = techniques:** every anime card has one (hits, heals, shields, freeze, burn…). Pick 3 with `/games fight deck`.'),
        t(idioma, `**Qué ganas:** 🪙 ${C.PREMIO_VICTORIA} por cada una de tus ${C.VICTORIAS_PREMIADAS} primeras victorias del día, ELO y rango, XP del pase y logros. Con apuesta, el ganador se lleva las dos (menos un ${Math.round(C.COMISION_APUESTA * 100)} %).`, `**Rewards:** 🪙 ${C.PREMIO_VICTORIA} for each of your first ${C.VICTORIAS_PREMIADAS} wins a day, ELO and rank, pass XP and achievements. With a bet, the winner takes both (minus ${Math.round(C.COMISION_APUESTA * 100)}%).`),
        t(idioma, `🗼 **Torre:** 50 pisos que se reinician cada mes, ${C.TORRE_INTENTOS_DIA} intentos al día, premio la primera vez que subes y tickets de sobres y cofres cada 5 y 10 pisos.`, `🗼 **Tower:** 50 floors that reset monthly, ${C.TORRE_INTENTOS_DIA} tries a day, a reward the first time you climb and pack and chest tickets every 5 and 10 floors.`),
        t(idioma, `🐉 **Jefe de la semana:** todo el servidor le pega (${C.ATAQUES_JEFE_DIA} ataques al día). Si cae antes del domingo, premios para todos. \`/jugar combate jefe\``, `🐉 **Weekly boss:** the whole server hits it (${C.ATAQUES_JEFE_DIA} attacks a day). If it falls before Sunday, rewards for everyone. \`/games fight boss\``),
    ].join('\n\n'))], flags: 64 };
}

// Devuelve las apuestas de combates que se quedaron a medias (el bot se reinició).
async function devolverPendientes() {
    const docs = await CombatePvP.find({ estado: 'en_curso' }).lean();
    for (const d of docs) {
        const r = await CombatePvP.updateOne({ _id: d._id, estado: 'en_curso' }, { $set: { estado: 'devuelto' } });
        if (!r.modifiedCount || !d.apuesta) continue;
        const eco = require('./economia.js').en(d.guildId);
        await eco.darOro(d.a, d.apuesta).catch(() => {});
        await eco.darOro(d.b, d.apuesta).catch(() => {});
    }
    return docs.length;
}
// Limpieza (lo llama el programador): retos caducados y partidas colgadas (más de 30 min).
function barrer() {
    const ahora = Date.now();
    for (const [id, r] of retos) if (r.hasta < ahora) retos.delete(id);
    for (const [, p] of partidas) {
        if (ahora - p.creado > 30 * 60 * 1000 && !p.ocupado) {
            p.c.fin = { ganador: p.c.a.hp / p.c.a.max >= p.c.b.hp / p.c.b.max ? 'a' : 'b', motivo: 'abandono' };
            terminar(p, t(p.idioma, '⌛ El combate ha durado demasiado: gana quien tenía más vida.', '⌛ The battle took too long: whoever had more health wins.'), null).catch(() => {});
        }
    }
}

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------
async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('cbt_')) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const [tipo, ...resto] = id.split(':');
    if (tipo === 'cbt_a') { const [pid, ...acc] = resto; await elegir(interaction, pid, acc.join(':'), idioma); return true; }
    if (tipo === 'cbt_m') { await menuCartas(interaction, resto[0], idioma); return true; }
    if (tipo === 'cbt_r') { await rendirse(interaction, resto[0], idioma); return true; }
    if (tipo === 'cbt_ok' || tipo === 'cbt_no') { await responderReto(interaction, resto[0], tipo === 'cbt_ok', cfg, idioma); return true; }
    if (!activos(cfg)) { await interaction.reply({ content: textoApagado(idioma), flags: 64 }); return true; }
    if (tipo === 'cbt_rev') {
        const [a, b, ap] = resto;
        if (interaction.user.id !== a && interaction.user.id !== b) { await interaction.reply({ content: t(idioma, 'La revancha es para los dos que combatieron.', 'The rematch is for the two who fought.'), flags: 64 }); return true; }
        const otro = interaction.user.id === a ? b : a;
        const rival = await interaction.client.users.fetch(otro).catch(() => null);
        const r = await retar(interaction, cfg, idioma, rival, Number(ap) || 0);
        if (r.error) await interaction.reply({ content: `❌ ${r.error}`, flags: 64 }); else await interaction.reply(r.msg);
        return true;
    }
    if (tipo === 'cbt_torre' || tipo === 'cbt_otra') {
        if (resto[0] !== interaction.user.id) { await interaction.reply({ content: t(idioma, 'Este botón es de otra persona. Usa `/jugar combate torre` o `/jugar combate practica`.', 'This button belongs to someone else. Use `/games fight tower` or `/games fight practice`.'), flags: 64 }); return true; }
        const r = tipo === 'cbt_torre' ? await torre(interaction, cfg, idioma) : await practica(interaction, cfg, idioma);
        await interaction.reply({ content: r.error ? `❌ ${r.error}` : r.texto, flags: 64 });
        return true;
    }
    if (tipo === 'cbt_jefe') {
        await interaction.deferReply();
        const r = await require('./jefe.js').atacar(interaction, cfg, idioma);
        if (r.error) { await interaction.deleteReply().catch(() => {}); await interaction.followUp({ content: `❌ ${r.error}`, flags: 64 }); } else await interaction.editReply(r);
        return true;
    }
    if (tipo === 'cbt_perfil') { await interaction.deferReply({ flags: 64 }); await interaction.editReply(await verPerfil(interaction, cfg, idioma)); return true; }
    return false;
}

module.exports = {
    activos, textoApagado, luchadorDe, retar, responderReto, torre, practica, mazo, verPerfil, ranking, ayuda,
    manejar, devolverPendientes, barrer, partidas, retos, enJuego, empezar, resolver, terminar, elegir, textoRonda, perfilDe,
};
