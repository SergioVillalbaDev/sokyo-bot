// Casino de oro (1.16.0). Juegos con animaciones: tragaperras (con bote), ruleta,
// blackjack, crash (en directo), minas, cara o cruz, duelos entre miembros y carreras
// con apuestas de todo el canal. Todo con oro virtual (no se compra ni se cambia por
// dinero) y con frenos: apuesta mínima y máxima, tope de pérdidas al día y pausa
// voluntaria. Las reglas puras están en utils/casinoNucleo.js; las animaciones, en
// utils/casinoArte.js.
const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const PerfilCasino = require('../models/PerfilCasino.js');
const JugadaCasino = require('../models/JugadaCasino.js');
const CasinoBote = require('../models/CasinoBote.js');
const C = require('./casinoNucleo.js');
const A = require('./casinoArte.js');
const { t } = require('./i18n.js');

const BOTE_PARTE = 0.02;   // de cada tirada de la tragaperras, al bote
const BOTE_INICIAL = 1000;
const GRAN_PREMIO = 1000;  // desde aquí (y ×10) se anuncia
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const hoyClave = () => new Date().toISOString().slice(0, 10);
const nuevoId = () => crypto.randomBytes(5).toString('hex');

const JUEGOS = {
    tragaperras: { emoji: '🎰', es: 'Tragaperras', en: 'Slots' },
    ruleta: { emoji: '🎡', es: 'Ruleta', en: 'Roulette' },
    blackjack: { emoji: '🃏', es: 'Blackjack', en: 'Blackjack' },
    crash: { emoji: '🚀', es: 'Crash', en: 'Crash' },
    minas: { emoji: '💣', es: 'Minas', en: 'Mines' },
    moneda: { emoji: '🪙', es: 'Cara o cruz', en: 'Coin flip' },
    duelo: { emoji: '⚔️', es: 'Duelo', en: 'Duel' },
    carrera: { emoji: '🏇', es: 'Carrera', en: 'Race' },
    hilo: { emoji: '🔼', es: 'Mayor o menor', en: 'Higher or lower' },
    rasca: { emoji: '🎟️', es: 'Rasca y gana', en: 'Scratch card' },
};

// ---------------------------------------------------------------------------
// Apostar y cobrar
// ---------------------------------------------------------------------------
function textoFallo(f, idioma, cfgC = {}) {
    switch (f.fallo) {
        case 'apagado': return t(idioma, '🎰 El casino no está activado en este servidor.', '🎰 The casino isn’t turned on on this server.');
        case 'juego': return t(idioma, 'Ese juego está desactivado en este servidor.', 'That game is turned off on this server.');
        case 'canal': return t(idioma, `🎰 Aquí no se juega: ve a <#${cfgC.canalId}>.`, `🎰 Not here: head to <#${cfgC.canalId}>.`);
        case 'pausa': return t(idioma, '🧘 Te has tomado un descanso del casino. Vuelve cuando acabe.', '🧘 You’re taking a break from the casino. Come back when it ends.');
        case 'min': return t(idioma, `La apuesta mínima es 🪙 ${f.min}.`, `The minimum bet is 🪙 ${f.min}.`);
        case 'max': return t(idioma, `La apuesta máxima es 🪙 ${f.max}.`, `The maximum bet is 🪙 ${f.max}.`);
        case 'limite': return t(idioma, `🛑 Has llegado a tu tope de pérdidas de hoy. Te quedan 🪙 ${f.queda}. Mañana más.`, `🛑 You’ve hit today’s loss limit. You have 🪙 ${f.queda} left. More tomorrow.`);
        case 'oro': return t(idioma, `No tienes 🪙 ${f.cantidad}. Consigue oro con \`/diario\`, votando (\`/votar\`) o con tu tirada gratis (\`/casino diaria\`).`, `You don’t have 🪙 ${f.cantidad}. Get gold with \`/daily\`, by voting (\`/vote\`) or with your free spin (\`/casino daily\`).`);
        default: return '❌';
    }
}

// Comprueba todo, cobra y apunta la jugada. Devuelve { jugada, saldo } o { fallo }.
async function apostar({ guildId, canalId, userId, cfg, juego, cantidad }) {
    const c = cfg?.casino;
    if (!c?.activo) return { fallo: 'apagado' };
    if (c.juegos && c.juegos[juego] === false) return { fallo: 'juego' };
    if (c.canalId && canalId && c.canalId !== canalId) return { fallo: 'canal' };
    const perfil = await PerfilCasino.findOne({ guildId, userId }).lean();
    const ok = C.comprobarApuesta(cantidad, c, perfil || {});
    if (ok.fallo) return ok;
    const saldo = await require('./economia.js').en(guildId).cobrar(userId, ok.cantidad);
    if (saldo === null) return { fallo: 'oro', cantidad: ok.cantidad };
    const jugada = await JugadaCasino.create({ guildId, userId, juego, apuesta: ok.cantidad });
    return { jugada, saldo };
}

// Cierra una jugada: paga, devuelve un poco si llevas compañero con «vuelta», apunta
// los números y anuncia los premios gordos.
async function cobrarJugada(client, cfg, jugada, premio, detalle = null) {
    premio = Math.max(0, Math.floor(premio));
    const r = await JugadaCasino.findOneAndUpdate({ _id: jugada._id, estado: 'en_curso' }, { $set: { estado: 'hecha', premio, mult: jugada.apuesta ? Math.round((premio / jugada.apuesta) * 100) / 100 : 0, detalle } }, { returnDocument: 'after' });
    if (!r) return { premio: 0, vuelta: 0, repetida: true };
    const economia = require('./economia.js');
    const perdida = Math.max(0, jugada.apuesta - premio);
    let vuelta = 0;
    if (perdida > 0) {
        const v = await require('./cofres.js').ventajasUsuario(jugada.guildId, jugada.userId).catch(() => null);
        if (v?.vuelta) vuelta = Math.floor(perdida * v.vuelta);
    }
    if (premio + vuelta > 0) await economia.en(jugada.guildId).darOro(jugada.userId, premio + vuelta);
    const hoy = hoyClave();
    const p = await PerfilCasino.findOne({ guildId: jugada.guildId, userId: jugada.userId }).lean();
    const perdidoHoy = (p?.dia === hoy ? p.perdidoHoy || 0 : 0) + Math.max(0, jugada.apuesta - premio - vuelta) - Math.max(0, premio - jugada.apuesta);
    await PerfilCasino.updateOne({ guildId: jugada.guildId, userId: jugada.userId }, {
        $set: { dia: hoy, perdidoHoy: Math.max(0, perdidoHoy), ...(premio > (p?.mayorPremio || 0) ? { mayorPremio: premio, mayorJuego: jugada.juego } : {}) },
        $inc: { jugadas: 1, apostado: jugada.apuesta, ganado: premio },
    }, { upsert: true });
    if (client && premio >= GRAN_PREMIO && premio >= jugada.apuesta * 10) await anunciarGranPremio(client, cfg, jugada, premio).catch(() => {});
    // 1.29.0: cada partida da un poco de XP del pase (con tope diario y sin importar la apuesta).
    await require('./pase.js').registrar(jugada.guildId, jugada.userId, 'casino').catch(() => {});
    return { premio, vuelta };
}

async function anunciarGranPremio(client, cfg, jugada, premio, extra = '') {
    const guild = client.guilds.cache.get(jugada.guildId);
    const canal = guild && cfg.casino?.anunciosId ? guild.channels.cache.get(cfg.casino.anunciosId) : null;
    if (!canal?.isTextBased()) return;
    const j = JUEGOS[jugada.juego] || { emoji: '🎰', es: jugada.juego, en: jugada.juego };
    await canal.send({ content: t(cfg, `🎉💰 **¡GRAN PREMIO!** <@${jugada.userId}> ha ganado **🪙 ${fmt(premio, cfg)}** en ${j.emoji} ${j.es} (×${Math.round(premio / jugada.apuesta)}).${extra}`, `🎉💰 **BIG WIN!** <@${jugada.userId}> won **🪙 ${fmt(premio, cfg)}** at ${j.emoji} ${j.en} (×${Math.round(premio / jugada.apuesta)}).${extra}`), allowedMentions: { users: [jugada.userId] } }).catch(() => {});
}

// Al arrancar: devuelve lo apostado en jugadas que se quedaron a medias.
async function devolverPendientes() {
    const pendientes = await JugadaCasino.find({ estado: 'en_curso' }).limit(500);
    for (const j of pendientes) {
        const r = await JugadaCasino.updateOne({ _id: j._id, estado: 'en_curso' }, { $set: { estado: 'devuelta' } });
        if (r.modifiedCount && j.guildId) await require('./economia.js').en(j.guildId).darOro(j.userId, j.apuesta).catch(() => {});
    }
    return pendientes.length;
}

const filaOtraVez = (juego, cantidad, idioma, extra = '') => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cas_rep:${juego}:${cantidad}${extra ? `:${extra}` : ''}`).setEmoji('🔁').setStyle(ButtonStyle.Secondary)
        .setLabel(t(idioma, `Otra vez (🪙 ${cantidad})`, `Again (🪙 ${cantidad})`)));

// 1.31.0: el pie solo dice tu oro (y lo que te devuelve el compañero); el resultado ya va en la imagen.
const pieSaldo = (idioma, saldo, vuelta = 0) => t(idioma, `🪙 ${fmt(saldo, idioma)}${vuelta ? ` · 🐾 +${vuelta}` : ''} · /casino pausa`, `🪙 ${fmt(saldo, idioma)}${vuelta ? ` · 🐾 +${vuelta}` : ''} · /casino pause`);
const saldoDe = async (guildId, userId) => (await require('./economia.js').en(guildId).obtenerUsuario(userId)).balance;

// ---------------------------------------------------------------------------
// 🎰 Tragaperras
// ---------------------------------------------------------------------------
async function tragaperras({ interaction, client, cfg, idioma, cantidad, gratis = false }) {
    const guildId = interaction.guildId; const userId = interaction.user.id;
    let jugada;
    if (gratis) {
        jugada = await JugadaCasino.create({ guildId, userId, juego: 'tragaperras', apuesta: 0 });
    } else {
        const a = await apostar({ guildId, canalId: interaction.channelId, userId, cfg, juego: 'tragaperras', cantidad });
        if (a.fallo) return { error: textoFallo(a, idioma, cfg.casino) };
        jugada = a.jugada;
    }
    const base = gratis ? 100 : cantidad;
    const r = C.tirarTragaperras();
    // Al bote: un 2 % de cada tirada de pago.
    let bote = await CasinoBote.findOneAndUpdate({ guildId }, { $setOnInsert: { bote: BOTE_INICIAL } }, { upsert: true, returnDocument: 'after' });
    if (!gratis) bote = await CasinoBote.findOneAndUpdate({ guildId }, { $inc: { bote: Math.max(1, Math.round(cantidad * BOTE_PARTE)) } }, { returnDocument: 'after' });
    let premio = Math.floor(base * r.mult);
    let boteGanado = 0;
    if (r.bote) {
        const antes = await CasinoBote.findOneAndUpdate({ guildId }, { $set: { bote: BOTE_INICIAL, ultimoGanadorId: userId, ultimoPremio: bote.bote, ultimaFecha: new Date() } }, { returnDocument: 'before' });
        boteGanado = antes?.bote || 0;
        premio += boteGanado;
    }
    // 1.31.0: el GIF acaba con lo que ganas o pierdes dibujado; el mensaje casi no lleva texto.
    const gif = await A.gifTragaperras(r.rodillos, { mult: r.mult, bote: r.bote, resultado: { premio, apuesta: gratis ? 0 : base, idioma } }).catch(() => null);
    const simb = r.rodillos.map((id) => C.simbolo(id).emoji).join(' │ ');
    const girando = new EmbedBuilder().setColor('#b91c1c')
        .setTitle(t(idioma, `🎰 Tragaperras · 🪙 ${fmt(base, idioma)}${gratis ? ' · 🎁 gratis' : ''}`, `🎰 Slots · 🪙 ${fmt(base, idioma)}${gratis ? ' · 🎁 free' : ''}`))
        .setFooter({ text: t(idioma, `💎 Bote 🪙 ${fmt(r.bote ? boteGanado : bote.bote, idioma)}`, `💎 Jackpot 🪙 ${fmt(r.bote ? boteGanado : bote.bote, idioma)}`) });
    if (gif) girando.setImage('attachment://tragaperras.gif');
    else girando.setDescription(t(idioma, `<@${userId}> apuesta **🪙 ${fmt(base, idioma)}**… 🤞`, `<@${userId}> bets **🪙 ${fmt(base, idioma)}**… 🤞`));
    await interaction.editReply({ embeds: [girando], files: gif ? [new AttachmentBuilder(gif, { name: 'tragaperras.gif' })] : [], allowedMentions: { parse: [] } });
    await espera(gif ? 3300 : 800);
    const { vuelta } = await cobrarJugada(client, cfg, jugada, premio, { rodillos: r.rodillos, bote: boteGanado });
    const saldo = await saldoDe(interaction.guildId, userId);
    const texto = r.bote
        ? t(idioma, `💎💎💎 **¡¡BOTE!!** <@${userId}> se lleva **🪙 ${fmt(premio, idioma)}** 🎉🎉🎉`, `💎💎💎 **JACKPOT!!** <@${userId}> takes **🪙 ${fmt(premio, idioma)}** 🎉🎉🎉`)
        : premio > base ? t(idioma, `🎉 ¡Premio! **×${r.mult}** → **🪙 ${fmt(premio, idioma)}**`, `🎉 Winner! **×${r.mult}** → **🪙 ${fmt(premio, idioma)}**`)
            : premio > 0 ? t(idioma, `😅 Recuperas **🪙 ${fmt(premio, idioma)}**`, `😅 You get back **🪙 ${fmt(premio, idioma)}**`)
                : t(idioma, '💨 Esta vez no… ¡la próxima!', '💨 Not this time… next one!');
    const fin = EmbedBuilder.from(girando).setColor(premio > base ? '#16a34a' : '#7f1d1d').setDescription(gif ? (r.bote ? texto : null) : `${simb}\n\n${texto}`).setFooter({ text: pieSaldo(idioma, saldo, vuelta) });
    if (r.bote) await anunciarGranPremio(client, cfg, { ...jugada.toObject(), apuesta: Math.max(1, base) }, premio, t(cfg, ' 💎💎💎 ¡BOTE!', ' 💎💎💎 JACKPOT!')).catch(() => {});
    await interaction.editReply({ embeds: [fin], components: gratis ? [] : [filaOtraVez('tragaperras', base, idioma)] });
    return { ok: true, premio, r };
}

// ---------------------------------------------------------------------------
// 🎡 Ruleta
// ---------------------------------------------------------------------------
const NOMBRE_APUESTA = {
    rojo: ['🔴 Rojo', '🔴 Red'], negro: ['⚫ Negro', '⚫ Black'], par: ['Par', 'Even'], impar: ['Impar', 'Odd'],
    bajo: ['1-18', '1-18'], alto: ['19-36', '19-36'], docena1: ['1.ª docena (1-12)', '1st dozen (1-12)'],
    docena2: ['2.ª docena (13-24)', '2nd dozen (13-24)'], docena3: ['3.ª docena (25-36)', '3rd dozen (25-36)'], numero: ['Número', 'Number'],
};
async function ruleta({ interaction, client, cfg, idioma, cantidad, apuesta, numero }) {
    if (!C.APUESTAS_RULETA.includes(apuesta)) return { error: t(idioma, 'Esa apuesta no existe.', 'That bet doesn’t exist.') };
    if (apuesta === 'numero' && !(numero >= 0 && numero <= 36)) return { error: t(idioma, 'Elige un número del 0 al 36.', 'Pick a number from 0 to 36.') };
    const a = await apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'ruleta', cantidad });
    if (a.fallo) return { error: textoFallo(a, idioma, cfg.casino) };
    const sale = C.girarRuleta();
    const mult = C.pagoRuleta(apuesta, numero, sale);
    const premio = Math.floor(cantidad * mult);
    const gif = await A.gifRuleta(sale, { resultado: { premio, apuesta: cantidad, idioma, mult } }).catch(() => null);
    const nombre = t(idioma, ...NOMBRE_APUESTA[apuesta]) + (apuesta === 'numero' ? ` ${numero}` : '');
    const e = new EmbedBuilder().setColor('#166534').setTitle(t(idioma, `🎡 ${nombre} · 🪙 ${fmt(cantidad, idioma)}`, `🎡 ${nombre} · 🪙 ${fmt(cantidad, idioma)}`));
    if (gif) e.setImage('attachment://ruleta.gif');
    else e.setDescription(t(idioma, `<@${interaction.user.id}> apuesta **🪙 ${fmt(cantidad, idioma)}** a **${nombre}**… 🎲`, `<@${interaction.user.id}> bets **🪙 ${fmt(cantidad, idioma)}** on **${nombre}**… 🎲`));
    await interaction.editReply({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'ruleta.gif' })] : [], allowedMentions: { parse: [] } });
    await espera(gif ? 3600 : 800);
    const { vuelta } = await cobrarJugada(client, cfg, a.jugada, premio, { apuesta, numero, sale });
    const color = { verde: '🟢', rojo: '🔴', negro: '⚫' }[C.colorNumero(sale)];
    const fin = EmbedBuilder.from(e).setColor(premio ? '#16a34a' : '#7f1d1d')
        .setDescription(gif ? null : `${t(idioma, 'Ha salido', 'It landed on')} ${color} **${sale}**\n\n${premio
            ? t(idioma, `🎉 ¡Ganas **🪙 ${fmt(premio, idioma)}**! (×${mult})`, `🎉 You win **🪙 ${fmt(premio, idioma)}**! (×${mult})`)
            : t(idioma, `💨 Pierdes **🪙 ${fmt(cantidad, idioma)}**.`, `💨 You lose **🪙 ${fmt(cantidad, idioma)}**.`)}`)
        .setFooter({ text: pieSaldo(idioma, await saldoDe(interaction.guildId, interaction.user.id), vuelta) });
    await interaction.editReply({ embeds: [fin], components: [filaOtraVez('ruleta', cantidad, idioma, `${apuesta}${apuesta === 'numero' ? `-${numero}` : ''}`)] });
    return { ok: true, premio };
}

// ---------------------------------------------------------------------------
// 🪙 Cara o cruz
// ---------------------------------------------------------------------------
async function moneda({ interaction, client, cfg, idioma, cantidad, lado }) {
    const a = await apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'moneda', cantidad });
    if (a.fallo) return { error: textoFallo(a, idioma, cfg.casino) };
    const sale = C.lanzarMoneda();
    const premio = sale === lado ? Math.floor(cantidad * C.MONEDA_PAGO) : 0;
    const gif = await A.gifMoneda(sale, { res: { premio, apuesta: cantidad, idioma }, textos: { cara: t(idioma, '👑 CARA', '👑 HEADS'), cruz: t(idioma, '⭐ CRUZ', '⭐ TAILS') } }).catch(() => null);
    const nom = (x) => (x === 'cara' ? t(idioma, '👑 Cara', '👑 Heads') : t(idioma, '⭐ Cruz', '⭐ Tails'));
    const e = new EmbedBuilder().setColor('#a16207').setTitle(`${nom(lado)} · 🪙 ${fmt(cantidad, idioma)}`);
    if (gif) e.setImage('attachment://moneda.gif');
    else e.setDescription(t(idioma, `<@${interaction.user.id}> apuesta **🪙 ${fmt(cantidad, idioma)}** a **${nom(lado)}**… 🪙💨`, `<@${interaction.user.id}> bets **🪙 ${fmt(cantidad, idioma)}** on **${nom(lado)}**… 🪙💨`));
    await interaction.editReply({ embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'moneda.gif' })] : [], allowedMentions: { parse: [] } });
    await espera(gif ? 1800 : 600);
    const { vuelta } = await cobrarJugada(client, cfg, a.jugada, premio, { lado, sale });
    const fin = EmbedBuilder.from(e).setColor(premio ? '#16a34a' : '#7f1d1d')
        .setDescription(gif ? null : `${t(idioma, 'Ha salido', 'It’s')} **${nom(sale)}**\n\n${premio ? t(idioma, `🎉 ¡Ganas **🪙 ${fmt(premio, idioma)}**!`, `🎉 You win **🪙 ${fmt(premio, idioma)}**!`) : t(idioma, '💨 ¡Mala suerte!', '💨 Bad luck!')}`)
        .setFooter({ text: pieSaldo(idioma, await saldoDe(interaction.guildId, interaction.user.id), vuelta) });
    await interaction.editReply({ embeds: [fin], components: [filaOtraVez('moneda', cantidad, idioma, lado)] });
    return { ok: true, premio };
}

// ---------------------------------------------------------------------------
// 🃏 Blackjack (con botones)
// ---------------------------------------------------------------------------
const partidas = new Map(); // id -> estado de blackjack / crash / minas
// Partidas abandonadas: el blackjack se resuelve como si se plantara y las minas cobran
// lo que llevaban (así nadie las deja a medias esperando un reinicio para recuperar la apuesta).
function limpiarPartidas(client = null) {
    const ahora = Date.now();
    for (const [k, p] of partidas) {
        if (p.caduca >= ahora) continue;
        partidas.delete(k);
        if (p.tipo === 'bj') {
            const banca = C.jugarBanca(p.banca, p.mazo);
            const apuesta = p.apuesta * (p.doblada ? 2 : 1);
            cobrarJugada(client, p.cfg, { ...p.jugada.toObject(), apuesta }, Math.floor(apuesta * C.resultadoBlackjack(p.jugador, banca).mult), { abandonada: true }).catch(() => {});
        } else if (p.tipo === 'minas') {
            cobrarJugada(client, p.cfg, p.jugada, Math.floor(p.apuesta * C.multMinas(p.minas, p.abiertas.length)), { abandonada: true }).catch(() => {});
        } else if (p.tipo === 'hilo') {
            cobrarJugada(client, p.cfg, p.jugada, Math.floor(p.apuesta * p.mult), { abandonada: true }).catch(() => {});
        } else if (p.tipo === 'rasca') {
            cobrarJugada(client, p.cfg, p.jugada, p.boleto.premio ? Math.floor(p.apuesta * p.boleto.premio.mult) : 0, { abandonada: true }).catch(() => {});
        }
    }
}
const barrerPartidas = (client) => limpiarPartidas(client);

function vistaBlackjack(p, idioma, { fin = null, ocultar = true } = {}) {
    const png = A.mesaBlackjack({ jugador: p.jugador, banca: p.banca, ocultar, resultado: fin?.resultado || null, textos: { banca: t(idioma, 'Banca', 'Dealer'), tu: t(idioma, 'Tú', 'You'), lema: t(idioma, 'BLACKJACK PAGA 3 A 2 · LA BANCA SE PLANTA EN 17', 'BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17') } });
    const e = new EmbedBuilder().setColor(fin ? (fin.mult > 1 ? '#16a34a' : fin.mult === 1 ? '#a16207' : '#7f1d1d') : '#14532d')
        .setTitle(t(idioma, `🃏 Blackjack · 🪙 ${fmt(p.apuesta * (p.doblada ? 2 : 1), idioma)}`, `🃏 Blackjack · 🪙 ${fmt(p.apuesta * (p.doblada ? 2 : 1), idioma)}`));
    // 1.31.0: con la mesa dibujada (puntos y resultado incluidos) sobra el texto.
    if (png) e.setImage('attachment://mesa.png');
    else e.setDescription(fin ? fin.texto : t(idioma, `Tienes **${C.puntos(p.jugador).total}**. ¿Pides otra carta o te plantas?`, `You have **${C.puntos(p.jugador).total}**. Hit or stand?`));
    const botones = fin ? [] : [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cas_bj:${p.id}:pedir`).setLabel(t(idioma, 'Pedir', 'Hit')).setEmoji('➕').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`cas_bj:${p.id}:plantarse`).setLabel(t(idioma, 'Plantarse', 'Stand')).setEmoji('✋').setStyle(ButtonStyle.Secondary),
        ...(p.jugador.length === 2 && !p.doblada ? [new ButtonBuilder().setCustomId(`cas_bj:${p.id}:doblar`).setLabel(t(idioma, `Doblar (🪙 ${p.apuesta})`, `Double (🪙 ${p.apuesta})`)).setEmoji('💰').setStyle(ButtonStyle.Success)] : []),
    )];
    return { embeds: [e], files: png ? [new AttachmentBuilder(png, { name: 'mesa.png' })] : [], components: botones, attachments: [] };
}

async function blackjack({ interaction, client, cfg, idioma, cantidad }) {
    const a = await apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'blackjack', cantidad });
    if (a.fallo) return { error: textoFallo(a, idioma, cfg.casino) };
    limpiarPartidas(client);
    const mazo = C.baraja();
    const p = { id: nuevoId(), tipo: 'bj', userId: interaction.user.id, jugada: a.jugada, apuesta: cantidad, mazo, jugador: [mazo.pop(), mazo.pop()], banca: [mazo.pop(), mazo.pop()], doblada: false, caduca: Date.now() + 10 * 60000, cfg, idioma };
    partidas.set(p.id, p);
    if (C.esBlackjack(p.jugador) || C.esBlackjack(p.banca)) {
        await interaction.editReply(vistaBlackjack(p, idioma, { ocultar: false }));
        await terminarBlackjack(interaction, client, p, true);
        return { ok: true };
    }
    await interaction.editReply(vistaBlackjack(p, idioma));
    return { ok: true };
}

async function terminarBlackjack(interaction, client, p, yaEditado = false) {
    partidas.delete(p.id);
    const idioma = p.idioma;
    // La banca destapa y roba carta a carta (animación con ediciones).
    if (C.puntos(p.jugador).total <= 21 && !C.esBlackjack(p.jugador)) {
        if (!yaEditado) { await interaction.editReply(vistaBlackjack(p, idioma, { ocultar: false, fin: null })).catch(() => {}); await espera(900); }
        while (C.puntos(p.banca).total < 17) {
            p.banca.push(p.mazo.pop());
            await interaction.editReply({ ...vistaBlackjack(p, idioma, { ocultar: false }), components: [] }).catch(() => {});
            await espera(900);
        }
    }
    const r = C.resultadoBlackjack(p.jugador, p.banca);
    const apuesta = p.apuesta * (p.doblada ? 2 : 1);
    const premio = Math.floor(apuesta * r.mult);
    const jugada = p.jugada;
    jugada.apuesta = apuesta;
    if (p.doblada) await JugadaCasino.updateOne({ _id: jugada._id }, { $set: { apuesta } });
    const { vuelta } = await cobrarJugada(client, p.cfg, jugada, premio, { jugador: p.jugador, banca: p.banca, res: r.res });
    const textos = {
        blackjack: t(idioma, `🂡 **¡BLACKJACK!** Ganas **🪙 ${fmt(premio, idioma)}**`, `🂡 **BLACKJACK!** You win **🪙 ${fmt(premio, idioma)}**`),
        gana: t(idioma, `🎉 ¡Ganas **🪙 ${fmt(premio, idioma)}**!`, `🎉 You win **🪙 ${fmt(premio, idioma)}**!`),
        empate: t(idioma, '🤝 Empate: recuperas tu apuesta.', '🤝 Push: you get your bet back.'),
        pasa: t(idioma, `💥 Te has pasado (${C.puntos(p.jugador).total}). Pierdes **🪙 ${fmt(apuesta, idioma)}**.`, `💥 Bust (${C.puntos(p.jugador).total}). You lose **🪙 ${fmt(apuesta, idioma)}**.`),
        pierde: t(idioma, `😞 Gana la banca. Pierdes **🪙 ${fmt(apuesta, idioma)}**.`, `😞 Dealer wins. You lose **🪙 ${fmt(apuesta, idioma)}**.`),
    };
    const titulos = { blackjack: 'BLACKJACK!', gana: t(idioma, '¡GANAS!', 'YOU WIN!'), empate: t(idioma, 'EMPATE', 'PUSH'), pasa: t(idioma, 'TE PASAS', 'BUST'), pierde: t(idioma, 'GANA LA BANCA', 'DEALER WINS') };
    const v = vistaBlackjack(p, idioma, { ocultar: false, fin: { mult: r.mult, resultado: { premio, apuesta, idioma, titulo: titulos[r.res] }, texto: `${t(idioma, 'Banca', 'Dealer')} **${C.puntos(p.banca).total}** · ${t(idioma, 'Tú', 'You')} **${C.puntos(p.jugador).total}**\n\n${textos[r.res]}` } });
    v.embeds[0].setFooter({ text: pieSaldo(idioma, await saldoDe(p.jugada.guildId, p.userId), vuelta) });
    v.components = [filaOtraVez('blackjack', p.apuesta, idioma)];
    await interaction.editReply(v).catch(() => {});
}

async function botonBlackjack(interaction, client) {
    const [, id, accion] = interaction.customId.split(':');
    const p = partidas.get(id);
    const { idiomaInteraccion } = require('./preferencias.js');
    const idioma = p?.idioma || await idiomaInteraccion(interaction, null);
    if (!p) return interaction.reply({ content: t(idioma, '⌛ Esta partida ya ha terminado.', '⌛ This game is over.'), flags: 64 });
    if (p.userId !== interaction.user.id) return interaction.reply({ content: t(idioma, 'Esta mano es de otra persona: juega la tuya con `/casino blackjack`.', 'This hand belongs to someone else: play yours with `/casino blackjack`.'), flags: 64 });
    if (p.ocupada) return interaction.deferUpdate().catch(() => {});
    p.ocupada = true;
    await interaction.deferUpdate();
    try {
        if (accion === 'doblar') {
            if (p.jugador.length !== 2 || p.doblada) return;
            const saldo = await require('./economia.js').en(p.jugada.guildId).cobrar(p.userId, p.apuesta);
            if (saldo === null) { await interaction.followUp({ content: t(idioma, `No tienes 🪙 ${p.apuesta} para doblar.`, `You don’t have 🪙 ${p.apuesta} to double.`), flags: 64 }); return; }
            p.doblada = true;
            p.jugador.push(p.mazo.pop());
            return await terminarBlackjack(interaction, client, p);
        }
        if (accion === 'pedir') {
            p.jugador.push(p.mazo.pop());
            if (C.puntos(p.jugador).total >= 21) return await terminarBlackjack(interaction, client, p);
            return await interaction.editReply(vistaBlackjack(p, idioma));
        }
        return await terminarBlackjack(interaction, client, p);
    } finally { p.ocupada = false; }
}

// ---------------------------------------------------------------------------
// 🚀 Crash (en directo: el mensaje se actualiza mientras sube)
// ---------------------------------------------------------------------------
function vistaCrash(p, idioma, mult, estado) {
    // 1.31.0: gráfica con el cohete; si no se puede dibujar, la barra de texto de siempre.
    const png = A.graficaCrash({ mult, estado, punto: p.punto, cobradoEn: p.cobradoEn, apuesta: p.apuesta, auto: p.auto, idioma });
    const llenas = Math.min(12, Math.floor(Math.log(mult) / Math.log(1.25)));
    const cielo = `${'▰'.repeat(llenas)}${'▱'.repeat(12 - llenas)}`;
    const cohete = estado === 'boom' ? '💥' : estado === 'cobrado' ? '🪂' : '🚀';
    const color = estado === 'boom' ? '#7f1d1d' : estado === 'cobrado' ? '#16a34a' : mult >= 5 ? '#f59e0b' : '#2563eb';
    const texto = ({
        vuela: () => t(idioma, `**×${mult.toFixed(2)}** ${cohete}\n${cielo}\nCobras ahora: **🪙 ${fmt(p.apuesta * mult, idioma)}**${p.auto ? ` · retiro automático en ×${p.auto}` : ''}`, `**×${mult.toFixed(2)}** ${cohete}\n${cielo}\nCash out now: **🪙 ${fmt(p.apuesta * mult, idioma)}**${p.auto ? ` · auto cash-out at ×${p.auto}` : ''}`),
        cobrado: () => t(idioma, `🪂 ¡Te has retirado a tiempo en **×${p.cobradoEn.toFixed(2)}**! Ganas **🪙 ${fmt(p.premio, idioma)}**.\nEl cohete explotó en ×${p.punto.toFixed(2)}.`, `🪂 You cashed out in time at **×${p.cobradoEn.toFixed(2)}**! You win **🪙 ${fmt(p.premio, idioma)}**.\nThe rocket blew up at ×${p.punto.toFixed(2)}.`),
        boom: () => t(idioma, `💥 **¡BOOM!** Ha explotado en **×${p.punto.toFixed(2)}**. Pierdes **🪙 ${fmt(p.apuesta, idioma)}**.`, `💥 **BOOM!** It blew up at **×${p.punto.toFixed(2)}**. You lose **🪙 ${fmt(p.apuesta, idioma)}**.`),
    })[estado]();
    const e = new EmbedBuilder().setColor(color).setTitle(t(idioma, `🚀 Crash · 🪙 ${fmt(p.apuesta, idioma)}`, `🚀 Crash · 🪙 ${fmt(p.apuesta, idioma)}`));
    if (png) e.setImage('attachment://crash.png'); else e.setDescription(texto);
    const comps = estado === 'vuela' ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cas_crash:${p.id}`).setStyle(ButtonStyle.Success).setEmoji('🪂').setLabel(t(idioma, `Retirarme (🪙 ${fmt(p.apuesta * mult, idioma)})`, `Cash out (🪙 ${fmt(p.apuesta * mult, idioma)})`)))] : [filaOtraVez('crash', p.apuesta, idioma, p.auto ? String(p.auto) : '')];
    return { embeds: [e], components: comps, files: png ? [new AttachmentBuilder(png, { name: 'crash.png' })] : [], attachments: [] };
}
async function crash({ interaction, client, cfg, idioma, cantidad, auto = null }) {
    const a = await apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'crash', cantidad });
    if (a.fallo) return { error: textoFallo(a, idioma, cfg.casino) };
    limpiarPartidas(client);
    const p = { id: nuevoId(), tipo: 'crash', userId: interaction.user.id, jugada: a.jugada, apuesta: cantidad, punto: C.puntoCrash(), inicio: Date.now() + 1500, auto: auto && auto >= 1.01 ? Math.round(auto * 100) / 100 : null, terminado: false, caduca: Date.now() + 5 * 60000, cfg, idioma, interaction };
    partidas.set(p.id, p);
    await interaction.editReply(vistaCrash(p, idioma, 1, 'vuela'));
    // Bucle: sube y actualiza cada 1,5 s hasta explotar, retirarse o llegar al automático.
    (async () => {
        while (!p.terminado) {
            await espera(1500);
            if (p.terminado) return;
            const seg = (Date.now() - p.inicio) / 1000;
            const mult = C.multCrash(seg);
            if (p.auto && p.auto <= p.punto && mult >= p.auto) { await retirarCrash(p, client, p.auto); return; }
            if (mult >= p.punto) {
                p.terminado = true; partidas.delete(p.id);
                await cobrarJugada(client, cfg, p.jugada, 0, { punto: p.punto });
                await interaction.editReply(vistaCrash(p, idioma, p.punto, 'boom')).catch(() => {});
                return;
            }
            await interaction.editReply(vistaCrash(p, idioma, mult, 'vuela')).catch(() => {});
        }
    })().catch((e) => console.error('Crash:', e.message));
    return { ok: true };
}
async function retirarCrash(p, client, multFijo = null) {
    if (p.terminado) return false;
    const mult = multFijo ?? C.multCrash((Date.now() - p.inicio) / 1000);
    if (mult >= p.punto) return false; // tarde: ya ha explotado
    p.terminado = true; partidas.delete(p.id);
    p.cobradoEn = mult;
    p.premio = Math.floor(p.apuesta * mult);
    const { vuelta } = await cobrarJugada(client, p.cfg, p.jugada, p.premio, { punto: p.punto, cobrado: mult });
    const v = vistaCrash(p, p.idioma, mult, 'cobrado');
    v.embeds[0].setFooter({ text: pieSaldo(p.idioma, await saldoDe(p.jugada.guildId, p.userId), vuelta) });
    await p.interaction.editReply(v).catch(() => {});
    return true;
}
async function botonCrash(interaction, client) {
    const id = interaction.customId.split(':')[1];
    const p = partidas.get(id);
    if (!p) return interaction.reply({ content: '⌛', flags: 64 });
    if (p.userId !== interaction.user.id) return interaction.reply({ content: t(p.idioma, 'Este cohete es de otra persona 🚀', 'This rocket belongs to someone else 🚀'), flags: 64 });
    await interaction.deferUpdate().catch(() => {});
    const ok = await retirarCrash(p, client);
    if (!ok) await interaction.followUp({ content: t(p.idioma, '💥 ¡Demasiado tarde!', '💥 Too late!'), flags: 64 }).catch(() => {});
}

// ---------------------------------------------------------------------------
// 💣 Minas (cuadrícula de botones)
// ---------------------------------------------------------------------------
function vistaMinas(p, idioma, estado = 'juega') {
    const mult = C.multMinas(p.minas, p.abiertas.length);
    const filas = [];
    for (let fi = 0; fi < 4; fi++) {
        const fila = new ActionRowBuilder();
        for (let co = 0; co < 5; co++) {
            const i = fi * 5 + co;
            const abierta = p.abiertas.includes(i);
            const mina = p.posMinas.includes(i);
            const b = new ButtonBuilder().setCustomId(`cas_min:${p.id}:${i}`);
            if (estado !== 'juega') {
                b.setDisabled(true).setEmoji(mina ? (i === p.explota ? '💥' : '💣') : abierta ? '💎' : '▫️').setStyle(mina && i === p.explota ? ButtonStyle.Danger : abierta ? ButtonStyle.Success : ButtonStyle.Secondary);
            } else if (abierta) {
                b.setDisabled(true).setEmoji('💎').setStyle(ButtonStyle.Success);
            } else {
                b.setEmoji('❔').setStyle(ButtonStyle.Secondary);
            }
            fila.addComponents(b);
        }
        filas.push(fila);
    }
    if (estado === 'juega') {
        filas.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cas_min:${p.id}:cobrar`).setStyle(ButtonStyle.Success).setEmoji('💰')
            .setDisabled(p.abiertas.length === 0).setLabel(t(idioma, `Retirarme ×${mult} (🪙 ${fmt(p.apuesta * mult, idioma)})`, `Cash out ×${mult} (🪙 ${fmt(p.apuesta * mult, idioma)})`))));
    } else {
        filas.push(filaOtraVez('minas', p.apuesta, idioma, String(p.minas)));
    }
    const siguiente = C.multMinas(p.minas, p.abiertas.length + 1);
    const desc = {
        juega: t(idioma, `Hay **${p.minas}** 💣 escondidas. Cada 💎 sube el premio.\nAhora: **×${mult}** · siguiente: **×${siguiente}**`, `There are **${p.minas}** 💣 hidden. Each 💎 raises the prize.\nNow: **×${mult}** · next: **×${siguiente}**`),
        boom: t(idioma, `💥 **¡BOOM!** Has pisado una mina. Pierdes **🪙 ${fmt(p.apuesta, idioma)}**.`, `💥 **BOOM!** You hit a mine. You lose **🪙 ${fmt(p.apuesta, idioma)}**.`),
        cobrado: t(idioma, `💰 Te retiras con **×${mult}**: ganas **🪙 ${fmt(Math.floor(p.apuesta * mult), idioma)}**.`, `💰 You cash out at **×${mult}**: you win **🪙 ${fmt(Math.floor(p.apuesta * mult), idioma)}**.`),
    }[estado];
    const e = new EmbedBuilder().setColor(estado === 'boom' ? '#7f1d1d' : estado === 'cobrado' ? '#16a34a' : '#334155')
        .setTitle(t(idioma, `💣 Minas · 🪙 ${fmt(p.apuesta, idioma)}`, `💣 Mines · 🪙 ${fmt(p.apuesta, idioma)}`)).setDescription(desc);
    return { embeds: [e], components: filas };
}
async function minas({ interaction, client, cfg, idioma, cantidad, numMinas = 3 }) {
    numMinas = Math.max(1, Math.min(10, parseInt(numMinas, 10) || 3));
    const a = await apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'minas', cantidad });
    if (a.fallo) return { error: textoFallo(a, idioma, cfg.casino) };
    limpiarPartidas(client);
    const p = { id: nuevoId(), tipo: 'minas', userId: interaction.user.id, jugada: a.jugada, apuesta: cantidad, minas: numMinas, posMinas: C.colocarMinas(numMinas), abiertas: [], caduca: Date.now() + 15 * 60000, cfg, idioma };
    partidas.set(p.id, p);
    await interaction.editReply(vistaMinas(p, idioma));
    return { ok: true };
}
async function botonMinas(interaction, client) {
    const [, id, que] = interaction.customId.split(':');
    const p = partidas.get(id);
    if (!p) return interaction.reply({ content: '⌛', flags: 64 });
    if (p.userId !== interaction.user.id) return interaction.reply({ content: t(p.idioma, 'Este tablero es de otra persona 💣', 'This board belongs to someone else 💣'), flags: 64 });
    if (p.ocupada) return interaction.deferUpdate().catch(() => {});
    p.ocupada = true;
    try {
        if (que === 'cobrar') {
            if (!p.abiertas.length) return interaction.deferUpdate();
            partidas.delete(p.id);
            const premio = Math.floor(p.apuesta * C.multMinas(p.minas, p.abiertas.length));
            const { vuelta } = await cobrarJugada(client, p.cfg, p.jugada, premio, { minas: p.minas, abiertas: p.abiertas.length });
            const v = vistaMinas(p, p.idioma, 'cobrado');
            v.embeds[0].setFooter({ text: pieSaldo(p.idioma, await saldoDe(p.jugada.guildId, p.userId), vuelta) });
            return interaction.update(v);
        }
        const i = parseInt(que, 10);
        if (p.abiertas.includes(i)) return interaction.deferUpdate();
        if (p.posMinas.includes(i)) {
            partidas.delete(p.id);
            p.explota = i;
            const { vuelta } = await cobrarJugada(client, p.cfg, p.jugada, 0, { minas: p.minas, abiertas: p.abiertas.length });
            const v = vistaMinas(p, p.idioma, 'boom');
            v.embeds[0].setFooter({ text: pieSaldo(p.idioma, await saldoDe(p.jugada.guildId, p.userId), vuelta) });
            return interaction.update(v);
        }
        p.abiertas.push(i);
        // Si ya no quedan casillas seguras, cobra solo.
        if (p.abiertas.length >= C.CASILLAS - p.minas) {
            partidas.delete(p.id);
            const premio = Math.floor(p.apuesta * C.multMinas(p.minas, p.abiertas.length));
            await cobrarJugada(client, p.cfg, p.jugada, premio, { minas: p.minas, abiertas: p.abiertas.length });
            return interaction.update(vistaMinas(p, p.idioma, 'cobrado'));
        }
        return interaction.update(vistaMinas(p, p.idioma));
    } finally { p.ocupada = false; }
}

// ---------------------------------------------------------------------------
// 🃏 Mayor o menor (1.25.0)
// ---------------------------------------------------------------------------
function vistaHilo(p, idioma, estado = 'juega', ultimo = null) {
    const pMayor = C.pagoHilo(p.actual, 'mayor'); const pMenor = C.pagoHilo(p.actual, 'menor');
    const x = (n) => (t(idioma, 'es', 'en') === 'es' ? String(n).replace('.', ',') : String(n));
    const png = A.mesaHilo ? A.mesaHilo({ actual: p.actual, historial: p.historial, mult: p.mult, estado, textos: { racha: t(idioma, 'Racha', 'Streak'), llevas: t(idioma, 'Llevas', 'You have') } }) : null;
    const texto = {
        juega: t(idioma, `¿La siguiente carta será **mayor** o **menor** que **${p.actual}**?\nLlevas **×${x(p.mult)}** (🪙 ${fmt(Math.floor(p.apuesta * p.mult), idioma)}) · aciertos: ${p.aciertos}`, `Will the next card be **higher** or **lower** than **${p.actual}**?\nYou have **×${p.mult}** (🪙 ${fmt(Math.floor(p.apuesta * p.mult), idioma)}) · correct: ${p.aciertos}`),
        pierde: t(idioma, `💥 Ha salido **${p.actual}**… ¡fallaste! Pierdes **🪙 ${fmt(p.apuesta, idioma)}**.`, `💥 It was **${p.actual}**… wrong! You lose **🪙 ${fmt(p.apuesta, idioma)}**.`),
        cobrado: t(idioma, `💰 Te retiras con **×${x(p.mult)}**: ganas **🪙 ${fmt(Math.floor(p.apuesta * p.mult), idioma)}**.`, `💰 You cash out at **×${p.mult}**: you win **🪙 ${fmt(Math.floor(p.apuesta * p.mult), idioma)}**.`),
    }[estado];
    const previo = ultimo === 'empate' ? t(idioma, '🤝 ¡Empate! Misma carta: sigues igual.\n', '🤝 Tie! Same card: nothing changes.\n') : ultimo === 'gana' ? t(idioma, '✅ ¡Acertaste!\n', '✅ Correct!\n') : '';
    const e = new EmbedBuilder().setColor(estado === 'pierde' ? '#7f1d1d' : estado === 'cobrado' ? '#16a34a' : '#1e3a8a')
        .setTitle(t(idioma, `🃏 Mayor o menor · 🪙 ${fmt(p.apuesta, idioma)}`, `🃏 Higher or lower · 🪙 ${fmt(p.apuesta, idioma)}`));
    // 1.31.0: con la mesa (carta, historial y multiplicador) basta una línea: ✅/🤝 al jugar o el resultado al acabar.
    if (png) {
        e.setImage('attachment://hilo.png');
        e.setDescription(estado === 'juega' ? (previo.trim() || null) : texto);
    } else e.setDescription(previo + texto);
    const comps = estado === 'juega' ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cas_hl:${p.id}:mayor`).setEmoji('⬆️').setStyle(ButtonStyle.Primary).setDisabled(!pMayor).setLabel(pMayor ? t(idioma, `Mayor ×${x(pMayor)}`, `Higher ×${pMayor}`) : t(idioma, 'Mayor', 'Higher')),
        new ButtonBuilder().setCustomId(`cas_hl:${p.id}:menor`).setEmoji('⬇️').setStyle(ButtonStyle.Primary).setDisabled(!pMenor).setLabel(pMenor ? t(idioma, `Menor ×${x(pMenor)}`, `Lower ×${pMenor}`) : t(idioma, 'Menor', 'Lower')),
        new ButtonBuilder().setCustomId(`cas_hl:${p.id}:cobrar`).setEmoji('💰').setStyle(ButtonStyle.Success).setDisabled(!p.aciertos).setLabel(t(idioma, `Retirarme (🪙 ${fmt(Math.floor(p.apuesta * p.mult), idioma)})`, `Cash out (🪙 ${fmt(Math.floor(p.apuesta * p.mult), idioma)})`)),
    )] : [filaOtraVez('hilo', p.apuesta, idioma)];
    return { embeds: [e], components: comps, files: png ? [new AttachmentBuilder(png, { name: 'hilo.png' })] : [], attachments: [] };
}
async function hilo({ interaction, client, cfg, idioma, cantidad }) {
    const a = await apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'hilo', cantidad });
    if (a.fallo) return { error: textoFallo(a, idioma, cfg.casino) };
    limpiarPartidas(client);
    const p = { id: nuevoId(), tipo: 'hilo', userId: interaction.user.id, jugada: a.jugada, apuesta: cantidad, actual: C.cartaHilo(), historial: [], mult: 1, aciertos: 0, caduca: Date.now() + 15 * 60000, cfg, idioma };
    partidas.set(p.id, p);
    await interaction.editReply(vistaHilo(p, idioma));
    return { ok: true };
}
async function botonHilo(interaction, client) {
    const [, id, que] = interaction.customId.split(':');
    const p = partidas.get(id);
    if (!p) return interaction.reply({ content: '⌛', flags: 64 });
    if (p.userId !== interaction.user.id) return interaction.reply({ content: t(p.idioma, 'Esta partida es de otra persona 🃏', 'This game belongs to someone else 🃏'), flags: 64 });
    if (p.ocupada) return interaction.deferUpdate().catch(() => {});
    p.ocupada = true;
    try {
        const fin = async (estado, premio) => {
            partidas.delete(p.id);
            const { vuelta } = await cobrarJugada(client, p.cfg, p.jugada, premio, { aciertos: p.aciertos, mult: p.mult });
            const v = vistaHilo(p, p.idioma, estado);
            v.embeds[0].setFooter({ text: pieSaldo(p.idioma, await saldoDe(p.jugada.guildId, p.userId), vuelta) });
            return interaction.update(v);
        };
        if (que === 'cobrar') return p.aciertos ? fin('cobrado', Math.floor(p.apuesta * p.mult)) : interaction.deferUpdate();
        const pago = C.pagoHilo(p.actual, que);
        if (!pago) return interaction.deferUpdate();
        const siguiente = C.cartaHilo();
        const r = C.resultadoHilo(p.actual, siguiente, que);
        p.historial.push(p.actual);
        p.actual = siguiente;
        if (r === 'pierde') return fin('pierde', 0);
        if (r === 'gana') {
            p.aciertos += 1;
            p.mult = Math.min(C.HILO_MAX_MULT, Math.floor(p.mult * pago * 100) / 100);
            // Tope: con ×100 o 12 aciertos cobra solo.
            if (p.mult >= C.HILO_MAX_MULT || p.aciertos >= 12) return fin('cobrado', Math.floor(p.apuesta * p.mult));
        }
        return interaction.update(vistaHilo(p, p.idioma, 'juega', r));
    } finally { p.ocupada = false; }
}

// ---------------------------------------------------------------------------
// 🎟️ Rasca y gana (1.25.0)
// ---------------------------------------------------------------------------
function vistaRasca(p, idioma, fin = false) {
    const filas = [];
    for (let fi = 0; fi < 3; fi++) {
        const fila = new ActionRowBuilder();
        for (let co = 0; co < 3; co++) {
            const i = fi * 3 + co;
            const visto = fin || p.rascadas.includes(i);
            const ganadora = fin && p.boleto.premio && p.boleto.casillas[i] === p.boleto.premio.simbolo;
            fila.addComponents(new ButtonBuilder().setCustomId(`cas_ras:${p.id}:${i}`).setDisabled(visto)
                .setEmoji(visto ? p.boleto.casillas[i] : '🪙').setStyle(ganadora ? ButtonStyle.Success : visto ? ButtonStyle.Secondary : ButtonStyle.Primary));
        }
        filas.push(fila);
    }
    if (!fin) filas.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cas_ras:${p.id}:todo`).setEmoji('✨').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Rascar todo', 'Scratch all'))));
    else filas.push(filaOtraVez('rasca', p.apuesta, idioma));
    const tabla = C.RASCA_PREMIOS.map((x) => `${x.simbolo}×3 → ×${x.mult}`).join(' · ');
    const premio = p.boleto.premio ? Math.floor(p.apuesta * p.boleto.premio.mult) : 0;
    const e = new EmbedBuilder().setColor(fin ? (premio > p.apuesta ? '#16a34a' : premio ? '#ca8a04' : '#7f1d1d') : '#7c3aed')
        .setTitle(t(idioma, `🎟️ Rasca y gana · 🪙 ${fmt(p.apuesta, idioma)}`, `🎟️ Scratch card · 🪙 ${fmt(p.apuesta, idioma)}`))
        .setDescription(fin
            ? (p.boleto.premio ? `# +🪙 ${fmt(premio, idioma)}\n${p.boleto.premio.simbolo}×3 · ×${p.boleto.premio.mult}` : '# 💨')
            : null)
        .setFooter(fin ? null : { text: t(idioma, `3 iguales = premio · ${tabla}`, `3 of a kind wins · ${tabla}`) });
    return { embeds: [e], components: filas };
}
async function rasca({ interaction, client, cfg, idioma, cantidad }) {
    const a = await apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'rasca', cantidad });
    if (a.fallo) return { error: textoFallo(a, idioma, cfg.casino) };
    limpiarPartidas(client);
    const p = { id: nuevoId(), tipo: 'rasca', userId: interaction.user.id, jugada: a.jugada, apuesta: cantidad, boleto: C.boletoRasca(), rascadas: [], caduca: Date.now() + 15 * 60000, cfg, idioma };
    partidas.set(p.id, p);
    await interaction.editReply(vistaRasca(p, idioma));
    return { ok: true };
}
async function botonRasca(interaction, client) {
    const [, id, que] = interaction.customId.split(':');
    const p = partidas.get(id);
    if (!p) return interaction.reply({ content: '⌛', flags: 64 });
    if (p.userId !== interaction.user.id) return interaction.reply({ content: t(p.idioma, 'Este boleto es de otra persona 🎟️', 'This ticket belongs to someone else 🎟️'), flags: 64 });
    if (p.ocupada) return interaction.deferUpdate().catch(() => {});
    p.ocupada = true;
    try {
        if (que === 'todo') p.rascadas = [...Array(9).keys()];
        else { const i = parseInt(que, 10); if (!p.rascadas.includes(i)) p.rascadas.push(i); }
        if (p.rascadas.length < 9) return interaction.update(vistaRasca(p, p.idioma));
        partidas.delete(p.id);
        const premio = p.boleto.premio ? Math.floor(p.apuesta * p.boleto.premio.mult) : 0;
        const { vuelta } = await cobrarJugada(client, p.cfg, p.jugada, premio, { boleto: p.boleto.casillas });
        const v = vistaRasca(p, p.idioma, true);
        v.embeds[0].setFooter({ text: pieSaldo(p.idioma, await saldoDe(p.jugada.guildId, p.userId), vuelta) });
        return interaction.update(v);
    } finally { p.ocupada = false; }
}

// ---------------------------------------------------------------------------
// ⚔️ Duelo entre dos miembros (cara o cruz; el ganador se lo lleva casi todo)
// ---------------------------------------------------------------------------
const duelos = new Map();
async function duelo({ interaction, client, cfg, idioma, cantidad, rival }) {
    if (!rival || rival.bot || rival.id === interaction.user.id) return { error: t(idioma, 'Elige a otra persona (no un bot).', 'Pick someone else (not a bot).') };
    const a = await apostar({ guildId: interaction.guildId, canalId: interaction.channelId, userId: interaction.user.id, cfg, juego: 'duelo', cantidad });
    if (a.fallo) return { error: textoFallo(a, idioma, cfg.casino) };
    const d = { id: nuevoId(), retador: interaction.user.id, rival: rival.id, cantidad, jugadaA: a.jugada, cfg, idioma, interaction };
    duelos.set(d.id, d);
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(t(idioma, '⚔️ ¡Duelo!', '⚔️ Duel!'))
        .setDescription(t(idioma, `<@${d.retador}> reta a <@${d.rival}> a cara o cruz por **🪙 ${fmt(cantidad, idioma)}** cada uno.\nEl ganador se lleva **🪙 ${fmt(Math.floor(cantidad * 2 * (1 - C.DUELO_COMISION)), idioma)}**. Tienes 60 s para aceptar.`, `<@${d.retador}> challenges <@${d.rival}> to a coin flip for **🪙 ${fmt(cantidad, idioma)}** each.\nThe winner takes **🪙 ${fmt(Math.floor(cantidad * 2 * (1 - C.DUELO_COMISION)), idioma)}**. You have 60 s to accept.`));
    await interaction.editReply({ content: `<@${d.rival}>`, embeds: [e], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cas_duelo:${d.id}:si`).setStyle(ButtonStyle.Success).setEmoji('⚔️').setLabel(t(idioma, 'Aceptar', 'Accept')),
        new ButtonBuilder().setCustomId(`cas_duelo:${d.id}:no`).setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Rechazar', 'Decline')),
    )], allowedMentions: { users: [d.rival] } });
    setTimeout(async () => {
        if (!duelos.has(d.id)) return;
        duelos.delete(d.id);
        await cobrarJugada(client, cfg, d.jugadaA, d.cantidad, { duelo: 'caducado' });
        await interaction.editReply({ content: '', embeds: [EmbedBuilder.from(e).setColor('#475569').setDescription(t(idioma, `⌛ <@${d.rival}> no ha contestado. Se te devuelve el oro.`, `⌛ <@${d.rival}> didn’t answer. Your gold is refunded.`))], components: [] }).catch(() => {});
    }, 60000);
    return { ok: true };
}
async function botonDuelo(interaction, client) {
    const [, id, resp] = interaction.customId.split(':');
    const d = duelos.get(id);
    if (!d) return interaction.reply({ content: '⌛', flags: 64 });
    if (interaction.user.id !== d.rival) return interaction.reply({ content: t(d.idioma, 'Este duelo no es para ti.', 'This duel isn’t for you.'), flags: 64 });
    duelos.delete(d.id);
    if (resp === 'no') {
        await cobrarJugada(client, d.cfg, d.jugadaA, d.cantidad, { duelo: 'rechazado' });
        return interaction.update({ content: '', embeds: [new EmbedBuilder().setColor('#475569').setDescription(t(d.idioma, `🏳️ <@${d.rival}> ha rechazado el duelo. Se devuelve el oro.`, `🏳️ <@${d.rival}> declined the duel. Gold refunded.`))], components: [] });
    }
    const b = await apostar({ guildId: interaction.guildId, canalId: null, userId: d.rival, cfg: d.cfg, juego: 'duelo', cantidad: d.cantidad });
    if (b.fallo) {
        duelos.set(d.id, d);
        return interaction.reply({ content: textoFallo(b, d.idioma, d.cfg.casino), flags: 64 });
    }
    await interaction.deferUpdate();
    const sale = C.lanzarMoneda();
    const gana = sale === 'cara' ? d.retador : d.rival; // el retador es cara
    const premio = Math.floor(d.cantidad * 2 * (1 - C.DUELO_COMISION));
    const gif = await A.gifMoneda(sale).catch(() => null);
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle('⚔️ 🪙')
        .setDescription(t(d.idioma, `👑 Cara: <@${d.retador}> · ⭐ Cruz: <@${d.rival}>\n¡La moneda está en el aire!`, `👑 Heads: <@${d.retador}> · ⭐ Tails: <@${d.rival}>\nThe coin is in the air!`));
    if (gif) e.setImage('attachment://moneda.gif');
    await interaction.editReply({ content: '', embeds: [e], files: gif ? [new AttachmentBuilder(gif, { name: 'moneda.gif' })] : [], components: [], allowedMentions: { parse: [] } });
    await espera(gif ? 1800 : 500);
    await cobrarJugada(client, d.cfg, gana === d.retador ? d.jugadaA : b.jugada, premio, { duelo: 'ganado', sale });
    await cobrarJugada(client, d.cfg, gana === d.retador ? b.jugada : d.jugadaA, 0, { duelo: 'perdido', sale });
    await interaction.editReply({ embeds: [EmbedBuilder.from(e).setColor('#16a34a').setDescription(t(d.idioma, `Ha salido **${sale === 'cara' ? '👑 Cara' : '⭐ Cruz'}**\n\n🏆 <@${gana}> gana el duelo y se lleva **🪙 ${fmt(premio, d.idioma)}**!`, `It’s **${sale === 'cara' ? '👑 Heads' : '⭐ Tails'}**\n\n🏆 <@${gana}> wins the duel and takes **🪙 ${fmt(premio, d.idioma)}**!`))], allowedMentions: { users: [gana] } });
}

// ---------------------------------------------------------------------------
// 🏇 Carrera: 45 s para apostar (cualquiera del canal) y la carrera en directo.
// ---------------------------------------------------------------------------
const carreras = new Map(); // canalId -> carrera
const LARGO_PISTA = 14;
function pista(pos, ganador = null) {
    return C.CORREDORES.map((c, i) => {
        const avance = Math.round((pos?.[c.id] || 0) * LARGO_PISTA);
        return `\`${i + 1}\` 🏁${'·'.repeat(Math.max(0, LARGO_PISTA - avance))}${c.emoji}${'·'.repeat(avance)}${ganador === c.id ? ' 🏆' : ''}`;
    }).join('\n');
}
function vistaCarrera(car, idioma, { pos = null, ganador = null, fase = 'apuestas' } = {}) {
    const apuestas = [...car.apuestas.values()];
    const total = apuestas.reduce((s, a) => s + a.cantidad, 0);
    // 1.31.0: la pista es una imagen (se repinta en cada paso); el texto, lo justo.
    const apostados = {};
    for (const a of apuestas) if (a.cantidad) apostados[a.corredor] = (apostados[a.corredor] || 0) + 1;
    const png = A.pistaCarrera({ pos, ganador, apostados });
    const e = new EmbedBuilder().setColor(fase === 'fin' ? '#16a34a' : '#b45309')
        .setTitle(t(idioma, '🏇 ¡Carrera!', '🏇 Race!'))
        .setDescription(`${png ? '' : `${pista(pos, ganador)}\n\n`}${fase === 'apuestas'
            ? t(idioma, `⏱️ Apuestas hasta <t:${Math.floor(car.cierra / 1000)}:R>`, `⏱️ Bets close <t:${Math.floor(car.cierra / 1000)}:R>`)
            : fase === 'corre' ? t(idioma, '📣 ¡Y salen!', '📣 And they’re off!') : ''}` || null)
        .addFields({ name: t(idioma, `💰 Apuestas (${apuestas.length}) · 🪙 ${fmt(total, idioma)}`, `💰 Bets (${apuestas.length}) · 🪙 ${fmt(total, idioma)}`), value: apuestas.slice(0, 15).map((a) => `<@${a.userId}> → ${C.CORREDORES.find((c) => c.id === a.corredor).emoji} 🪙 ${fmt(a.cantidad, idioma)}`).join('\n') || '—' });
    const comps = fase === 'apuestas' ? [new ActionRowBuilder().addComponents(C.CORREDORES.map((c) => new ButtonBuilder().setCustomId(`cas_car:${car.id}:${c.id}`).setEmoji(c.emoji).setLabel(`×${C.cuota(c.id)}`).setStyle(ButtonStyle.Secondary)))] : [];
    if (png) e.setImage('attachment://carrera.png');
    return { embeds: [e], components: comps, files: png ? [new AttachmentBuilder(png, { name: 'carrera.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
}
async function carrera({ interaction, client, cfg, idioma }) {
    const c = cfg?.casino;
    if (!c?.activo) return { error: textoFallo({ fallo: 'apagado' }, idioma) };
    if (c.juegos?.carrera === false) return { error: textoFallo({ fallo: 'juego' }, idioma) };
    if (c.canalId && c.canalId !== interaction.channelId) return { error: textoFallo({ fallo: 'canal' }, idioma, c) };
    if (carreras.has(interaction.channelId)) return { error: t(idioma, 'Ya hay una carrera en este canal: ¡apuesta en ella!', 'There’s already a race in this channel: bet on it!') };
    const car = { id: nuevoId(), canalId: interaction.channelId, guildId: interaction.guildId, cierra: Date.now() + 45000, apuestas: new Map(), cfg, idioma, interaction };
    carreras.set(interaction.channelId, car);
    await interaction.editReply(vistaCarrera(car, idioma));
    setTimeout(() => correr(client, car).catch((e) => { console.error('Carrera:', e.message); carreras.delete(car.canalId); }), 45000);
    return { ok: true };
}
async function correr(client, car) {
    const idioma = car.idioma;
    const apuestas = [...car.apuestas.values()];
    if (!apuestas.length) {
        carreras.delete(car.canalId);
        await car.interaction.editReply({ embeds: [new EmbedBuilder().setColor('#475569').setDescription(t(idioma, '🏇 Nadie ha apostado: carrera cancelada.', '🏇 Nobody bet: race cancelled.'))], components: [], files: [], attachments: [] }).catch(() => {});
        return;
    }
    const ganador = C.ganadorCarrera();
    const pasos = C.pasosCarrera(ganador);
    await car.interaction.editReply(vistaCarrera(car, idioma, { fase: 'corre' })).catch(() => {});
    for (const pos of pasos) {
        await espera(1300);
        await car.interaction.editReply(vistaCarrera(car, idioma, { pos, fase: 'corre' })).catch(() => {});
    }
    carreras.delete(car.canalId);
    const lineas = [];
    for (const a of apuestas) {
        const premio = a.corredor === ganador ? Math.floor(a.cantidad * C.cuota(a.corredor)) : 0;
        await cobrarJugada(client, car.cfg, a.jugada, premio, { corredor: a.corredor, ganador });
        if (premio) lineas.push(`🎉 <@${a.userId}> +🪙 ${fmt(premio, idioma)}`);
    }
    const emo = C.CORREDORES.find((c) => c.id === ganador).emoji;
    const v = vistaCarrera(car, idioma, { pos: pasos[pasos.length - 1], ganador, fase: 'fin' });
    v.embeds[0].setDescription(`${v.files.length ? '' : `${pista(pasos[pasos.length - 1], ganador)}\n\n`}${t(idioma, `🏆 ¡Gana ${emo}!`, `🏆 ${emo} wins!`)}\n${lineas.join('\n') || '😅'}`);
    await car.interaction.editReply(v).catch(() => {});
}
async function botonCarrera(interaction) {
    const [, id, corredor] = interaction.customId.split(':');
    const car = [...carreras.values()].find((c) => c.id === id);
    const idioma = car?.idioma || 'es';
    if (!car || Date.now() > car.cierra) return interaction.reply({ content: t(idioma, '⌛ Las apuestas ya están cerradas.', '⌛ Bets are closed.'), flags: 64 });
    if (car.apuestas.has(interaction.user.id)) return interaction.reply({ content: t(idioma, 'Ya has apostado en esta carrera.', 'You already bet on this race.'), flags: 64 });
    const emo = C.CORREDORES.find((c) => c.id === corredor)?.emoji || '?';
    return interaction.showModal(new ModalBuilder().setCustomId(`cas_carm:${id}:${corredor}`).setTitle(t(idioma, `Apostar por ${emo}`, `Bet on ${emo}`))
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cantidad').setLabel(t(idioma, `Cuánto oro (cuota ×${C.cuota(corredor)})`, `How much gold (odds ×${C.cuota(corredor)})`)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(9))));
}
async function modalCarrera(interaction, client) {
    const [, id, corredor] = interaction.customId.split(':');
    const car = [...carreras.values()].find((c) => c.id === id);
    const idioma = car?.idioma || 'es';
    if (!car || Date.now() > car.cierra) return interaction.reply({ content: t(idioma, '⌛ Las apuestas ya están cerradas.', '⌛ Bets are closed.'), flags: 64 });
    if (car.apuestas.has(interaction.user.id)) return interaction.reply({ content: t(idioma, 'Ya has apostado en esta carrera.', 'You already bet on this race.'), flags: 64 });
    const cantidad = parseInt(interaction.fields.getTextInputValue('cantidad').replace(/\D/g, ''), 10);
    car.apuestas.set(interaction.user.id, { userId: interaction.user.id, corredor, cantidad: 0, jugada: null }); // reserva (doble clic)
    const a = await apostar({ guildId: car.guildId, canalId: car.canalId, userId: interaction.user.id, cfg: car.cfg, juego: 'carrera', cantidad });
    if (a.fallo) { car.apuestas.delete(interaction.user.id); return interaction.reply({ content: textoFallo(a, idioma, car.cfg.casino), flags: 64 }); }
    car.apuestas.set(interaction.user.id, { userId: interaction.user.id, corredor, cantidad, jugada: a.jugada });
    await interaction.reply({ content: t(idioma, `✅ Apuestas 🪙 ${fmt(cantidad, idioma)} por ${C.CORREDORES.find((c) => c.id === corredor).emoji}. ¡Suerte!`, `✅ You bet 🪙 ${fmt(cantidad, idioma)} on ${C.CORREDORES.find((c) => c.id === corredor).emoji}. Good luck!`), flags: 64 });
    await car.interaction.editReply(vistaCarrera(car, idioma)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Tirada gratis del día, bote y estadísticas, pausa
// ---------------------------------------------------------------------------
async function diaria({ interaction, client, cfg, idioma }) {
    const c = cfg?.casino;
    if (!c?.activo) return { error: textoFallo({ fallo: 'apagado' }, idioma) };
    if (c.canalId && c.canalId !== interaction.channelId) return { error: textoFallo({ fallo: 'canal' }, idioma, c) };
    const hace = new Date(Date.now() - 20 * 3600000);
    await PerfilCasino.updateOne({ guildId: interaction.guildId, userId: interaction.user.id }, { $setOnInsert: { jugadas: 0 } }, { upsert: true });
    const r = await PerfilCasino.findOneAndUpdate({ guildId: interaction.guildId, userId: interaction.user.id, $or: [{ ultimaDiaria: null }, { ultimaDiaria: { $lt: hace } }] }, { $set: { ultimaDiaria: new Date() } });
    if (!r) {
        const p = await PerfilCasino.findOne({ guildId: interaction.guildId, userId: interaction.user.id }).lean();
        return { error: t(idioma, `Ya has usado tu tirada gratis. Vuelve <t:${Math.floor((new Date(p.ultimaDiaria).getTime() + 20 * 3600000) / 1000)}:R>.`, `You already used your free spin. Come back <t:${Math.floor((new Date(p.ultimaDiaria).getTime() + 20 * 3600000) / 1000)}:R>.`) };
    }
    return tragaperras({ interaction, client, cfg, idioma, cantidad: 100, gratis: true });
}

async function resumenUsuario(guildId, userId) {
    const p = await PerfilCasino.findOne({ guildId, userId }).lean();
    return p || { jugadas: 0, apostado: 0, ganado: 0, mayorPremio: 0 };
}
async function embedBote(guild, idioma, userId) {
    const bote = await CasinoBote.findOneAndUpdate({ guildId: guild.id }, { $setOnInsert: { bote: BOTE_INICIAL } }, { upsert: true, returnDocument: 'after' });
    const top = await PerfilCasino.aggregate([{ $match: { guildId: guild.id, jugadas: { $gt: 0 } } }, { $addFields: { neto: { $subtract: ['$ganado', '$apostado'] } } }, { $sort: { neto: -1 } }, { $limit: 5 }]);
    const yo = await resumenUsuario(guild.id, userId);
    return new EmbedBuilder().setColor('#f59e0b').setTitle(t(idioma, '🎰 Casino', '🎰 Casino'))
        .addFields(
            { name: t(idioma, '💎 Bote de la tragaperras', '💎 Slots jackpot'), value: `**🪙 ${fmt(bote.bote, idioma)}**${bote.ultimoGanadorId ? t(idioma, `\nÚltimo: <@${bote.ultimoGanadorId}> (🪙 ${fmt(bote.ultimoPremio, idioma)})`, `\nLast: <@${bote.ultimoGanadorId}> (🪙 ${fmt(bote.ultimoPremio, idioma)})`) : ''}` },
            { name: t(idioma, '🏆 Los que más han ganado', '🏆 Biggest winners'), value: top.map((p, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} <@${p.userId}> ${p.neto >= 0 ? '+' : ''}🪙 ${fmt(p.neto, idioma)}`).join('\n') || '—' },
            { name: t(idioma, '📊 Tú', '📊 You'), value: t(idioma, `${fmt(yo.jugadas, idioma)} jugadas · apostado 🪙 ${fmt(yo.apostado, idioma)} · cobrado 🪙 ${fmt(yo.ganado, idioma)} · mayor premio 🪙 ${fmt(yo.mayorPremio, idioma)}`, `${fmt(yo.jugadas, idioma)} plays · wagered 🪙 ${fmt(yo.apostado, idioma)} · won 🪙 ${fmt(yo.ganado, idioma)} · biggest win 🪙 ${fmt(yo.mayorPremio, idioma)}`) },
        )
        .setFooter({ text: t(idioma, 'El oro es virtual: no se compra ni se cambia por dinero. Juega con cabeza 💛', 'Gold is virtual: it can’t be bought or exchanged for money. Play smart 💛') });
}
async function pausa(guildId, userId, dias) {
    const hasta = new Date(Date.now() + Math.max(1, Math.min(30, dias)) * 86400000);
    await PerfilCasino.updateOne({ guildId, userId }, { $max: { pausaHasta: hasta } }, { upsert: true });
    return hasta;
}

// ---------------------------------------------------------------------------
// Botones (cas_*)
// ---------------------------------------------------------------------------
async function manejar(interaction, client) {
    const id = interaction.customId || '';
    if (!id.startsWith('cas_')) return false;
    if (interaction.isStringSelectMenu() && id === 'cas_guia') {
        const { getConfigCached } = require('./config.js');
        const { idiomaInteraccion } = require('./preferencias.js');
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        await interaction.update(require('./casinoAyuda.js').guiaJuego(interaction.values[0], await idiomaInteraccion(interaction, cfg), cfg));
        return true;
    }
    if (interaction.isButton() && id.startsWith('cas_bj:')) { await botonBlackjack(interaction, client); return true; }
    if (interaction.isButton() && id.startsWith('cas_crash:')) { await botonCrash(interaction, client); return true; }
    if (interaction.isButton() && id.startsWith('cas_min:')) { await botonMinas(interaction, client); return true; }
    if (interaction.isButton() && id.startsWith('cas_hl:')) { await botonHilo(interaction, client); return true; }
    if (interaction.isButton() && id.startsWith('cas_ras:')) { await botonRasca(interaction, client); return true; }
    if (interaction.isButton() && id.startsWith('cas_duelo:')) { await botonDuelo(interaction, client); return true; }
    if (interaction.isButton() && id.startsWith('cas_car:')) { await botonCarrera(interaction); return true; }
    if (interaction.isModalSubmit() && id.startsWith('cas_carm:')) { await modalCarrera(interaction, client); return true; }
    if (interaction.isButton() && id.startsWith('cas_rep:')) {
        // «Otra vez» y las fichas del lobby: ese juego y esa apuesta, para quien lo pulsa (mensaje nuevo).
        const [, juego, cant, extra] = id.split(':');
        const { getConfigCached } = require('./config.js');
        const { idiomaInteraccion } = require('./preferencias.js');
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        const idioma = await idiomaInteraccion(interaction, cfg);
        await jugarRepetir(interaction, client, cfg, idioma, juego, parseInt(cant, 10), extra);
        return true;
    }
    // Lobby del casino (1.23.0): desplegable, mesas, mi oro, pausa…
    return require('./casinoLobby.js').manejar(interaction, client);
}

// Juega `juego` con `cantidad` (y su opción) en un mensaje nuevo en el canal.
async function jugarRepetir(interaction, client, cfg, idioma, juego, cantidad, extra = '') {
    await interaction.deferReply();
    const base = { interaction, client, cfg, idioma, cantidad };
    let r;
    if (juego === 'tragaperras') r = await tragaperras(base);
    else if (juego === 'ruleta') { const [ap, num] = String(extra || 'rojo').split('-'); r = await ruleta({ ...base, apuesta: ap, numero: num !== undefined ? parseInt(num, 10) : null }); }
    else if (juego === 'moneda') r = await moneda({ ...base, lado: extra === 'cruz' ? 'cruz' : 'cara' });
    else if (juego === 'blackjack') r = await blackjack(base);
    else if (juego === 'crash') r = await crash({ ...base, auto: extra ? parseFloat(extra) : null });
    else if (juego === 'minas') r = await minas({ ...base, numMinas: parseInt(extra, 10) || 3 });
    else if (juego === 'hilo') r = await hilo(base);
    else if (juego === 'rasca') r = await rasca(base);
    else r = { error: t(idioma, 'Ese juego no se puede repetir así.', 'That game can’t be replayed like this.') };
    if (r?.error) {
        // El error solo lo ve quien juega (no ensucia el canal).
        await interaction.deleteReply().catch(() => {});
        await interaction.followUp({ content: `❌ ${r.error}`, flags: 64 }).catch(() => {});
    }
    return r;
}

// Para el panel.
async function resumenServidor(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    const persona = (id) => { const m = guild?.members.cache.get(id); return { id, nombre: m?.displayName || id, avatar: m?.user.displayAvatarURL({ size: 64 }) || null }; };
    const desde = (dias) => new Date(Date.now() - dias * 86400000);
    const sumar = async (dias) => {
        const [r] = await JugadaCasino.aggregate([{ $match: { guildId, estado: 'hecha', fecha: { $gte: desde(dias) } } }, { $group: { _id: null, apostado: { $sum: '$apuesta' }, premios: { $sum: '$premio' }, jugadas: { $sum: 1 } } }]);
        return r || { apostado: 0, premios: 0, jugadas: 0 };
    };
    const [hoy, semana, porJuego, top, grandes, bote] = await Promise.all([
        sumar(1), sumar(7),
        JugadaCasino.aggregate([{ $match: { guildId, estado: 'hecha', fecha: { $gte: desde(7) } } }, { $group: { _id: '$juego', jugadas: { $sum: 1 }, apostado: { $sum: '$apuesta' }, premios: { $sum: '$premio' } } }]),
        PerfilCasino.aggregate([{ $match: { guildId, jugadas: { $gt: 0 } } }, { $addFields: { neto: { $subtract: ['$ganado', '$apostado'] } } }, { $sort: { neto: -1 } }, { $limit: 8 }]),
        JugadaCasino.find({ guildId, estado: 'hecha', mult: { $gte: 5 }, premio: { $gte: 200 } }).sort({ fecha: -1 }).limit(10).lean(),
        CasinoBote.findOne({ guildId }).lean(),
    ]);
    return {
        bote: bote?.bote ?? BOTE_INICIAL, ultimoBote: bote?.ultimoGanadorId ? { ...persona(bote.ultimoGanadorId), premio: bote.ultimoPremio, fecha: bote.ultimaFecha } : null,
        hoy, semana,
        porJuego: Object.fromEntries(porJuego.map((x) => [x._id, { jugadas: x.jugadas, apostado: x.apostado, premios: x.premios }])),
        top: top.map((p) => ({ ...persona(p.userId), neto: p.neto, jugadas: p.jugadas, mayorPremio: p.mayorPremio })),
        grandes: grandes.map((j) => ({ ...persona(j.userId), juego: j.juego, apuesta: j.apuesta, premio: j.premio, mult: j.mult, fecha: j.fecha })),
    };
}

module.exports = {
    JUEGOS, BOTE_INICIAL, apostar, cobrarJugada, devolverPendientes, textoFallo, barrerPartidas,
    tragaperras, ruleta, moneda, blackjack, crash, minas, hilo, rasca, duelo, carrera, diaria, embedBote, pausa, manejar, resumenServidor, jugarRepetir,
    _partidas: partidas, _carreras: carreras, _duelos: duelos, _correr: correr, retirarCrash,
};
