// Lobby del casino (1.23.0): un mensaje fijo en el canal del casino con un cartel
// animado (luces, bote), los últimos premios gordos, los que más ganan y un
// desplegable con TODOS los juegos. Al elegir uno se abre (solo para ti) su «mesa»:
// cómo se juega, lo que paga, tu oro y fichas para apostar de un toque (o «Otra
// cantidad»). 2.5.0: la partida se juega AHÍ MISMO, en tu mesa (un solo mensaje que cambia:
// «Otra vez», «Cambiar apuesta o juego», el desplegable de juegos arriba…). Las partidas con
// más gente (carrera, ruleta en mesa, cohete, bingo, póker, duelo) salen en el canal para todos.
// Se publica desde el panel (Diversión → Casino) o al activar el casino con el setup,
// y se pone al día solo cada pocos minutos (bote, premios). Botones: cas_lob, cas_lb:*,
// cas_lx:*, cas_lm:*, cas_ldu:*, cas_lp:*; las fichas reutilizan cas_rep (utils/casino.js).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const C = require('./casinoNucleo.js');
const K = require('./cofresNucleo.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const casino = () => require('./casino.js');
const ayuda = () => require('./casinoAyuda.js');

// Una línea para cada juego en el desplegable.
const RESUMEN = {
    tragaperras: ['Tres rodillos y un bote que no para de crecer', 'Three reels and an ever-growing jackpot'],
    ruleta: ['Rojo, negro, docenas o tu número de la suerte', 'Red, black, dozens or your lucky number'],
    blackjack: ['Acércate a 21 sin pasarte', 'Get close to 21 without going over'],
    crash: ['El cohete sube… retírate antes de que explote', 'The rocket climbs… cash out before it blows up'],
    minas: ['Destapa gemas y no pises una mina', 'Uncover gems and avoid the mines'],
    moneda: ['Cara o cruz, rápido y sencillo', 'Heads or tails, quick and simple'],
    duelo: ['Reta a alguien del servidor', 'Challenge someone on the server'],
    carrera: ['Todo el canal apuesta por un corredor', 'The whole channel bets on a runner'],
    hilo: ['¿Mayor o menor? Encadena aciertos y retírate', 'Higher or lower? Chain wins and cash out'],
    rasca: ['Rasca 9 casillas: 3 iguales y ganas', 'Scratch 9 tiles: 3 of a kind wins'],
    plinko: ['La bola cae rebotando: ¡los bordes pagan ×29!', 'The ball bounces down: the edges pay ×29!'],
    rueda: ['Apuesta a un número: el 40 paga ×47', 'Bet on a number: 40 pays ×47'],
    dados: ['Tres dados: grande, pequeño o un trío (×34)', 'Three dice: big, small or a triple (×34)'],
    baccarat: ['Jugador o banca: el clásico de los casinos', 'Player or banker: the casino classic'],
    bingo: ['Bingo para todo el canal: línea y cartón lleno', 'Bingo for the whole channel: line and full card'],
    poker: ['Texas Hold\'em de 2 a 6 personas con fichas', 'Texas Hold\'em for 2-6 players with chips'],
};
// Opciones de cada juego en su mesa (lo que va como «extra» en cas_rep).
const OPCIONES = {
    ruleta: [['rojo', '🔴 Rojo', '🔴 Red'], ['negro', '⚫ Negro', '⚫ Black'], ['par', 'Par', 'Even'], ['impar', 'Impar', 'Odd'], ['bajo', '1-18', '1-18'], ['alto', '19-36', '19-36'],
        ['docena1', '1.ª docena (×3)', '1st dozen (×3)'], ['docena2', '2.ª docena (×3)', '2nd dozen (×3)'], ['docena3', '3.ª docena (×3)', '3rd dozen (×3)'], ['numero-7', 'Número 7 (×36)', 'Number 7 (×36)'], ['numero-17', 'Número 17 (×36)', 'Number 17 (×36)'], ['numero-0', '🟢 Número 0 (×36)', '🟢 Number 0 (×36)']],
    moneda: [['cara', '👑 Cara', '👑 Heads'], ['cruz', '🦅 Cruz', '🦅 Tails']],
    minas: [['1', '1 mina (tranquilo)', '1 mine (calm)'], ['3', '3 minas', '3 mines'], ['5', '5 minas', '5 mines'], ['8', '8 minas (valiente)', '8 mines (brave)'], ['12', '12 minas (locura)', '12 mines (madness)']],
    plinko: [['bajo', '🟢 Riesgo bajo', '🟢 Low risk'], ['medio', '🟠 Riesgo medio', '🟠 Medium risk'], ['alto', '🔴 Riesgo alto (×29)', '🔴 High risk (×29)']],
    rueda: [['1', '1 (×2,05)', '1 (×2.05)'], ['2', '2 (×3,6)', '2 (×3.6)'], ['5', '5 (×6,8)', '5 (×6.8)'], ['10', '10 (×11,8)', '10 (×11.8)'], ['20', '20 (×23,5)', '20 (×23.5)'], ['40', '40 (×47)', '40 (×47)']],
    dados: [['grande', '🔺 Grande 11-17 (×2)', '🔺 Big 11-17 (×2)'], ['pequeno', '🔻 Pequeño 4-10 (×2)', '🔻 Small 4-10 (×2)'], ['par', 'Par (×2)', 'Even (×2)'], ['impar', 'Impar (×2)', 'Odd (×2)'], ['trio', '🎯 Trío (×34)', '🎯 Triple (×34)'],
        ...[1, 2, 3, 4, 5, 6].map((n) => [`numero-${n}`, `🎲 Al ${n} (×2/×3/×13)`, `🎲 On ${n} (×2/×3/×13)`])],
    baccarat: [['jugador', '🔵 Jugador (×2)', '🔵 Player (×2)'], ['banca', '🔴 Banca (×1,95)', '🔴 Banker (×1.95)'], ['empate', '🟢 Empate (×9)', '🟢 Tie (×9)']],
    crash: [['', 'Me retiro yo', 'I cash out myself'], ['1.5', 'Retiro solo en ×1,5', 'Auto cash out at ×1.5'], ['2', 'Retiro solo en ×2', 'Auto cash out at ×2'], ['3', 'Retiro solo en ×3', 'Auto cash out at ×3'], ['5', 'Retiro solo en ×5', 'Auto cash out at ×5'], ['10', 'Retiro solo en ×10', 'Auto cash out at ×10']],
};
const EXTRA_INICIAL = { ruleta: 'rojo', moneda: 'cara', minas: '3', crash: '', plinko: 'bajo', rueda: '1', dados: 'grande', baccarat: 'jugador' };
// Fichas: mínimo, algunas redondas y el máximo.
function fichas(min, max) {
    const l = [...new Set([min, 100, 250, 500, 1000, 2500, max].filter((x) => x >= min && x <= max))].sort((a, b) => a - b);
    // Cinco como mucho, siempre con la mínima y la máxima.
    return l.length > 5 ? [l[0], l[1], l[3], l[4], l[l.length - 1]] : l;
}
const juegosActivos = (cfg) => Object.keys(casino().JUEGOS).filter((j) => cfg?.casino?.juegos?.[j] !== false);

// ---------------------------------------------------------------------------
// El mensaje del lobby
// ---------------------------------------------------------------------------
async function datosLobby(guildId) {
    const CasinoBote = require('../models/CasinoBote.js');
    const JugadaCasino = require('../models/JugadaCasino.js');
    const PerfilCasino = require('../models/PerfilCasino.js');
    const semana = new Date(Date.now() - 7 * 86400000);
    const [bote, grandes, top] = await Promise.all([
        CasinoBote.findOne({ guildId }).lean(),
        JugadaCasino.find({ guildId, estado: 'hecha', premio: { $gte: 500 }, fecha: { $gte: semana } }).sort({ premio: -1 }).limit(4).lean(),
        PerfilCasino.aggregate([{ $match: { guildId, jugadas: { $gt: 0 } } }, { $addFields: { neto: { $subtract: ['$ganado', '$apostado'] } } }, { $sort: { neto: -1 } }, { $limit: 3 }]),
    ]);
    return { bote: bote?.bote ?? 1000, ultimoGanador: bote?.ultimoGanadorId || null, ultimoPremio: bote?.ultimoPremio || 0, grandes, top };
}

// El desplegable con todos los juegos (el del lobby y el de arriba de tu mesa, con el juego que tienes abierto).
function filaJuegos(cfg, idioma, actual = null) {
    const c = cfg?.casino || {};
    const J = casino().JUEGOS;
    const op = (value, emoji, label, description) => ({ value, emoji, label, description, default: value === actual });
    const menu = new StringSelectMenuBuilder().setCustomId('cas_lob').setPlaceholder(t(idioma, '🎲 Elige un juego…', '🎲 Pick a game…'))
        .addOptions([
            ...juegosActivos(cfg).map((j) => op(j, J[j].emoji, t(idioma, J[j].es, J[j].en), `${casino().JUEGOS_GRUPO.has(j) ? '👥 ' : ''}${t(idioma, ...RESUMEN[j])}`.slice(0, 100))),
            ...(c.cofres !== false ? [op('cofres', '🎁', t(idioma, 'Cofres de mascotas', 'Pet chests'), t(idioma, 'Mascotas con habilidades exclusivas (hay una divina)', 'Pets with exclusive abilities (there’s a divine one)'))] : []),
            ...(cfg?.compis?.anime ? [op('cartas', '🃏', t(idioma, 'Sobres de cartas de anime', 'Anime card packs'), t(idioma, '3 cartas por sobre: técnicas de combate y poderes', '3 cards per pack: battle techniques and powers'))] : []),
            ...(c.juegos?.crash !== false ? [op('cohete', '🚀', t(idioma, 'Cohete del canal (todos)', 'Channel rocket (everyone)'), t(idioma, '👥 Un crash para todos: retírate antes que nadie', '👥 One crash for all: cash out before it blows'))] : []),
            ...(c.juegos?.ruleta !== false ? [op('mesaruleta', '🎡', t(idioma, 'Ruleta en mesa (todo el canal)', 'Table roulette (whole channel)'), t(idioma, '👥 Una tirada para todos: 30 s para apostar', '👥 One spin for everyone: 30 s to bet'))] : []),
            ...(c.juegos?.loteria !== false ? [op('loteria', '🎟️', t(idioma, 'Lotería de la semana', 'Weekly lottery'), t(idioma, 'Boletos de 🪙 100 · sorteo el domingo', '🪙 100 tickets · Sunday draw'))] : []),
            op('numeros', '📈', t(idioma, 'Mis números', 'My numbers'), t(idioma, 'Cómo te ha ido, con gráfica', 'How you’ve done, with a chart')),
        ].slice(0, 25));
    return new ActionRowBuilder().addComponents(menu);
}
// Pone el desplegable de juegos encima de una vista de tu mesa (si cabe: deja sitio a la fila «🏠 Menú · ❔»).
function conJuegos(v, cfg, idioma, actual = null) {
    const comps = v.components || [];
    if (comps.length >= 4) return v;
    return { ...v, components: [filaJuegos(cfg, idioma, actual), ...comps] };
}

async function mensajeLobby(guild, cfg, { conCartel = true } = {}) {
    const idioma = cfg?.idioma || 'es';
    const c = cfg?.casino || {};
    const d = await datosLobby(guild.id);
    const J = casino().JUEGOS;
    const activos = juegosActivos(cfg);
    const e = new EmbedBuilder().setColor('#f59e0b')
        .setTitle(t(idioma, '🎰 Bienvenido al casino', '🎰 Welcome to the casino'))
        .setDescription(t(idioma,
            `Elige un juego en el desplegable de abajo: se abre **tu mesa** (solo la ves tú) y juegas **ahí mismo**, en ese mismo mensaje: otra vez, cambiar de apuesta o de juego, sin ir a ningún sitio ni llenar el canal.\n👥 Las partidas con más gente (carrera, ruleta en mesa, cohete, bingo, póker) salen aquí para todos.\n🎁 Cada día tienes **una tirada gratis**. Apuestas de 🪙 ${fmt(c.apuestaMin ?? 10, idioma)} a 🪙 ${fmt(c.apuestaMax ?? 5000, idioma)}.`,
            `Pick a game from the menu below: **your table** opens (only you see it) and you play **right there**, in that same message: again, change your bet or game, without going anywhere or filling the channel.\n👥 Games with other people (race, table roulette, rocket, bingo, poker) show here for everyone.\n🎁 You get **one free spin** every day. Bets from 🪙 ${fmt(c.apuestaMin ?? 10, idioma)} to 🪙 ${fmt(c.apuestaMax ?? 5000, idioma)}.`))
        .addFields(
            { name: t(idioma, '💎 Bote de la tragaperras', '💎 Slots jackpot'), value: `**🪙 ${fmt(d.bote, idioma)}**${d.ultimoGanador ? t(idioma, `\nÚltimo: <@${d.ultimoGanador}> (🪙 ${fmt(d.ultimoPremio, idioma)})`, `\nLast: <@${d.ultimoGanador}> (🪙 ${fmt(d.ultimoPremio, idioma)})`) : ''}`, inline: true },
            { name: t(idioma, '🏆 Los que más ganan', '🏆 Top winners'), value: d.top.map((p, i) => `${['🥇', '🥈', '🥉'][i]} <@${p.userId}> ${p.neto >= 0 ? '+' : ''}🪙 ${fmt(p.neto, idioma)}`).join('\n') || t(idioma, 'Aún nadie… ¿serás tú?', 'Nobody yet… will it be you?'), inline: true },
            { name: t(idioma, '🔥 Premios gordos de la semana', '🔥 Big wins this week'), value: d.grandes.map((j) => `${J[j.juego]?.emoji || '🎲'} <@${j.userId}> 🪙 ${fmt(j.premio, idioma)}${j.mult ? ` (×${Math.round(j.mult * 100) / 100})` : ''}`).join('\n') || t(idioma, 'Esta semana todavía no ha caído ninguno.', 'None yet this week.'), inline: false },
            { name: t(idioma, '🎲 En este casino', '🎲 At this casino'), value: activos.map((j) => `${J[j].emoji} ${t(idioma, J[j].es, J[j].en)}`).join(' · ') + (c.cofres !== false ? ` · 🎁 ${t(idioma, 'Cofres', 'Chests')}` : ''), inline: false },
        )
        .setFooter({ text: t(idioma, `El oro es virtual: no se compra ni se cambia por dinero · tope de pérdidas al día: 🪙 ${c.limiteDiario ? fmt(c.limiteDiario, idioma) : '∞'} · juega con cabeza 💛`, `Gold is virtual: it can’t be bought or exchanged for money · daily loss limit: 🪙 ${c.limiteDiario ? fmt(c.limiteDiario, idioma) : '∞'} · play smart 💛`) })
        .setTimestamp(new Date());
    const files = [];
    if (conCartel) {
        const gif = await require('./casinoArte.js').bannerCasino({
            titulo: t(idioma, 'CASINO', 'CASINO'), subtitulo: guild.name, boteTexto: `🪙 ${fmt(d.bote, idioma)}`, boteEtiqueta: t(idioma, 'BOTE', 'JACKPOT'),
        }).catch(() => null);
        if (gif) { files.push(new AttachmentBuilder(gif, { name: 'casino.gif' })); e.setImage('attachment://casino.gif'); }
    }
    const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cas_lb:diaria').setEmoji('🎁').setLabel(t(idioma, 'Tirada gratis', 'Free spin')).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cas_lb:mio').setEmoji('💰').setLabel(t(idioma, 'Mi oro', 'My gold')).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cas_lb:ranking').setEmoji('🏆').setLabel(t(idioma, 'Ranking', 'Leaderboard')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cas_lb:guia').setEmoji('📖').setLabel(t(idioma, 'Cómo se juega', 'How to play')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('emp:abrir').setEmoji('👋').setLabel(t(idioma, '¿Nuevo? Empieza aquí', 'New? Start here')).setStyle(ButtonStyle.Success),
    );
    return { embeds: [e], files, components: [filaJuegos(cfg, idioma), botones], allowedMentions: { parse: [] } };
}

// Publica (o vuelve a publicar) el lobby en el canal del casino y lo fija.
async function publicar(client, guildId, canalId = null) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { error: 'Servidor no encontrado' };
    const cfg = await ServidorConfig.findOne({ guildId }).lean();
    if (!cfg?.casino?.activo) return { error: 'El casino no está activado' };
    const canal = guild.channels.cache.get(String(canalId || cfg.casino.canalId || ''));
    if (!canal?.isTextBased()) return { error: 'Elige primero el canal del casino' };
    // El anterior se borra para que no haya dos.
    const viejo = cfg.casino.lobby;
    if (viejo?.mensajeId) {
        const cv = guild.channels.cache.get(viejo.canalId);
        const m = cv ? await cv.messages.fetch(viejo.mensajeId).catch(() => null) : null;
        if (m) await m.delete().catch(() => {});
    }
    const msg = await canal.send(await mensajeLobby(guild, cfg));
    await msg.pin().catch(() => {});
    await ServidorConfig.updateOne({ guildId }, { $set: { 'casino.lobby': { canalId: canal.id, mensajeId: msg.id, fecha: new Date() } } });
    require('./config.js').invalidateConfig?.(guildId);
    return { ok: true, canalId: canal.id, mensajeId: msg.id };
}

// Pone al día los lobbies (bote, premios…). El cartel solo se rehace si cambia el bote.
const ultimoBote = new Map();
async function refrescar(client) {
    const cfgs = await ServidorConfig.find({ 'casino.activo': true, 'casino.lobby.mensajeId': { $ne: null } }).select('guildId idioma casino').lean();
    for (const cfg of cfgs) {
        try {
            const guild = client.guilds.cache.get(cfg.guildId);
            const canal = guild?.channels.cache.get(cfg.casino.lobby.canalId);
            const msg = canal ? await canal.messages.fetch(cfg.casino.lobby.mensajeId).catch(() => null) : null;
            if (!msg) continue;
            const { bote } = await datosLobby(cfg.guildId);
            const cambia = ultimoBote.get(cfg.guildId) !== bote;
            const nuevo = await mensajeLobby(guild, cfg, { conCartel: cambia });
            if (!cambia) { delete nuevo.files; nuevo.embeds[0].setImage(msg.embeds?.[0]?.image?.url || null); } else nuevo.attachments = [];
            await msg.edit(nuevo);
            ultimoBote.set(cfg.guildId, bote);
        } catch (e) { console.warn('Lobby del casino:', e.message); }
    }
}

// ---------------------------------------------------------------------------
// La mesa de cada juego (solo para quien la abre)
// ---------------------------------------------------------------------------
// 2.5.0: toda vista de la mesa lleva arriba el desplegable de juegos (cambias de juego sin salir de tu ventana).
async function mesa(juego, opciones) {
    const v = await mesaSola(juego, opciones);
    return conJuegos(v, opciones.cfg, opciones.idioma, juego);
}
async function mesaSola(juego, { cfg, idioma, guildId, userId, cantidad = null, extra = null }) {
    const c = cfg?.casino || {};
    const min = c.apuestaMin ?? 10; const max = c.apuestaMax ?? 5000;
    const saldo = (await require('./economia.js').en(guildId || cfg?.guildId).obtenerUsuario(userId)).balance;
    const J = casino().JUEGOS;
    if (juego === 'cartas') {
        const S = require('./cartasNucleo.js');
        const e = new EmbedBuilder().setColor('#8b5cf6').setTitle(t(idioma, '🃏 Sobres de cartas de anime', '🃏 Anime card packs'))
            .setDescription(t(idioma, `Cada sobre trae **3 cartas** de personajes de anime. Cada carta tiene su poder y se usa sobre tu mascota para potenciarla (\`/compi\` → 🃏). Hasta ${S.CARTAS_DIA} al día.`, `Each pack has **3 cards** of anime characters. Each card has its power and is used on your pet to power it up (\`/companion\` → 🃏). Up to ${S.CARTAS_DIA} a day.`))
            .addFields(Object.entries(S.SOBRES).map(([, x]) => ({ name: `${x.emoji} ${t(idioma, x.es, x.en)} · 🪙 ${fmt(x.precio, idioma)}`, value: Object.entries(x.prob).filter(([, p]) => p > 0).map(([r, p]) => `${K.RAREZAS[r].emoji} ${p} %`).join(' · '), inline: false })))
            .setFooter({ text: t(idioma, `Tu oro: 🪙 ${fmt(saldo, idioma)}`, `Your gold: 🪙 ${fmt(saldo, idioma)}`) });
        return { embeds: [e], components: [
            new ActionRowBuilder().addComponents(Object.entries(S.SOBRES).map(([id, x]) => new ButtonBuilder().setCustomId(`crt_otro:${id}`).setEmoji(x.emoji).setStyle(ButtonStyle.Primary).setLabel(`${t(idioma, x.es, x.en)} · 🪙 ${fmt(x.precio, idioma)}`).setDisabled(saldo < x.precio))),
            new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('crt_album').setEmoji('📚').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mi álbum', 'My album'))),
        ] };
    }
    if (juego === 'loteria') return require('./casinoExtra.js').vistaLoteria(await require('./casinoExtra.js').loteriaDe(guildId || cfg?.guildId), userId, idioma);
    if (juego === 'numeros') { const r = await require('./casinoExtra.js').estadisticas(guildId || cfg?.guildId, userId, idioma); delete r.flags; return r; }
    if (juego === 'cohete') {
        const e = new EmbedBuilder().setColor('#0ea5e9').setTitle(t(idioma, '🚀 Cohete del canal', '🚀 Channel rocket'))
            .setDescription(t(idioma, 'Abre un crash para **todo el canal**: 20 s para subirse y luego un solo cohete. Cada uno se retira cuando quiere; quien siga dentro cuando explote, pierde.', 'Open a crash for **the whole channel**: 20 s to board, then one rocket. Everyone cashes out when they want; whoever is still on when it blows, loses.'));
        return { embeds: [e], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cas_lb:cohete').setEmoji('🚀').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Lanzar el cohete', 'Launch the rocket')))] };
    }
    if (juego === 'mesaruleta') {
        const e = new EmbedBuilder().setColor('#16a34a').setTitle(t(idioma, '🎡 Ruleta en mesa', '🎡 Table roulette'))
            .setDescription(t(idioma, 'Abre una ruleta para **todo el canal**: durante 30 s cada uno apuesta a rojo, negro, par, impar o al 0, y luego gira **una sola vez para todos**.', 'Open a roulette for **the whole channel**: for 30 s everyone bets on red, black, even, odd or zero, then it spins **once for everyone**.'));
        return { embeds: [e], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cas_lb:mesaruleta').setEmoji('🎡').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Abrir la mesa', 'Open the table')))] };
    }
    if (juego === 'cofres') {
        const e = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, '🎁 Cofres de mascotas', '🎁 Pet chests'))
            .setDescription(t(idioma, 'Abre un cofre y sale una mascota al azar, cada una con su **habilidad exclusiva**. Llévala equipada para sus ventajas y cuídala con `/compi`. Cuanto más caro el cofre, más fácil que salga algo raro.', 'Open a chest and get a random pet, each with its own **exclusive ability**. Equip it for its perks and look after it with `/companion`. The pricier the chest, the likelier something rare.'))
            .addFields(Object.entries(K.COFRES).map(([id, x]) => ({ name: `${x.emoji} ${t(idioma, x.es, x.en)} · 🪙 ${fmt(x.precio, idioma)}`, value: Object.entries(x.prob).filter(([, p]) => p > 0).map(([r, p]) => `${K.RAREZAS[r].emoji} ${p} %`).join(' · '), inline: false })))
            .setFooter({ text: t(idioma, `Tu oro: 🪙 ${fmt(saldo, idioma)}`, `Your gold: 🪙 ${fmt(saldo, idioma)}`) });
        return { embeds: [e], components: [
            new ActionRowBuilder().addComponents(Object.entries(K.COFRES).map(([id, x]) => new ButtonBuilder().setCustomId(`cof_otro:${id}`).setEmoji(x.emoji).setStyle(ButtonStyle.Primary).setLabel(`${t(idioma, x.es, x.en)} · 🪙 ${fmt(x.precio, idioma)}`).setDisabled(saldo < x.precio))),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cas_lb:coleccion').setEmoji('📚').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mi colección', 'My collection')),
                new ButtonBuilder().setCustomId('grj:abrir').setEmoji('🧺').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Mi granja', 'My farm')),
                new ButtonBuilder().setCustomId('grj:alb').setEmoji('📖').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Álbum', 'Album')),
            ),
        ] };
    }
    const g = ayuda().GUIA[juego];
    if (!g || !J[juego]) return { content: '❌', components: [] };
    if (extra === null) extra = EXTRA_INICIAL[juego] ?? '';
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(`${g.emoji} ${t(idioma, J[juego].es, J[juego].en)}`)
        .addFields(
            { name: t(idioma, '🎮 Cómo se juega', '🎮 How to play'), value: t(idioma, g.como[0], g.como[1]) },
            { name: t(idioma, '💰 Lo que paga', '💰 Payouts'), value: t(idioma, ...g.paga()) },
        )
        .setFooter({ text: t(idioma, `Tu oro: 🪙 ${fmt(saldo, idioma)} · apuestas de 🪙 ${fmt(min, idioma)} a 🪙 ${fmt(max, idioma)}`, `Your gold: 🪙 ${fmt(saldo, idioma)} · bets from 🪙 ${fmt(min, idioma)} to 🪙 ${fmt(max, idioma)}`) });
    const filas = [];
    if (juego === 'carrera') {
        e.setDescription(t(idioma, 'Al abrirla, durante 45 s todo el canal puede apostar por su corredor. Luego se ve en directo.', 'Once opened, the whole channel has 45 s to bet on a runner. Then it plays live.'));
        filas.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cas_lb:carrera').setEmoji('🏇').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Abrir una carrera', 'Start a race'))));
        return { embeds: [e], components: filas };
    }
    if (juego === 'duelo') {
        const cant = Math.min(max, Math.max(min, cantidad || fichas(min, max)[1] || min));
        e.setDescription(t(idioma, `Apuesta del duelo: **🪙 ${fmt(cant, idioma)}**. Elige a quién retas: tendrá 60 s para aceptar.`, `Duel bet: **🪙 ${fmt(cant, idioma)}**. Pick who to challenge: they’ll have 60 s to accept.`));
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cas_lx:duelo:cantidad').setPlaceholder(t(idioma, 'Cuánto apostáis…', 'How much…'))
            .addOptions(fichas(min, max).map((f) => ({ value: String(f), label: `🪙 ${fmt(f, idioma)}`, default: f === cant })))));
        filas.push(new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`cas_ldu:${cant}`).setPlaceholder(t(idioma, '⚔️ ¿A quién retas?', '⚔️ Who do you challenge?'))));
        return { embeds: [e], components: filas };
    }
    if (juego === 'poker') e.setDescription(t(idioma, 'Elige **la entrada** (lo que paga cada uno para sentarse) y se abre una mesa en el canal: 60 s para sentarse.', 'Pick **the buy-in** (what everyone pays to sit) and a table opens in the channel: 60 s to sit down.'));
    if (juego === 'bingo') e.setDescription(t(idioma, 'Elige **el precio de cada cartón** y se abre el bingo para todo el canal (45 s para comprar).', 'Pick **the price of each card** and a bingo opens for the whole channel (45 s to buy).'));
    if (OPCIONES[juego]) {
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cas_lx:${juego}:extra`)
            .addOptions(OPCIONES[juego].map(([v, es, en]) => ({ value: v || 'nada', label: t(idioma, es, en), default: v === extra })))));
        const op = OPCIONES[juego].find(([v]) => v === extra);
        if (op) e.setDescription(t(idioma, `Juegas a: **${op[1]}**`, `Playing: **${op[2]}**`));
    }
    const ex = extra ? `:${extra}` : '';
    filas.push(new ActionRowBuilder().addComponents(fichas(min, max).map((f) => new ButtonBuilder()
        .setCustomId(`cas_rep:${juego}:${f}${ex}`).setStyle(f > saldo ? ButtonStyle.Secondary : ButtonStyle.Success).setDisabled(f > saldo).setLabel(`🪙 ${fmt(f, idioma)}`))));
    const grupo = casino().JUEGOS_GRUPO.has(juego);
    filas.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cas_lm:${juego}${ex}`).setEmoji('✏️').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Otra cantidad', 'Other amount')),
        new ButtonBuilder().setCustomId('cas_lb:mio').setEmoji('💰').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mi oro', 'My gold')),
        new ButtonBuilder().setCustomId('cas_lb:diaria').setEmoji('🎁').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Tirada gratis', 'Free spin')),
    ));
    if (!e.data.description) e.setDescription(grupo
        ? t(idioma, '👥 Se abre en el canal del casino para que se apunte quien quiera.', '👥 It opens in the casino channel so anyone can join.')
        : t(idioma, '👤 Pulsa una ficha y juegas aquí mismo: solo lo ves tú.', '👤 Tap a chip and you play right here: only you see it.'));
    return { embeds: [e], components: filas };
}

async function miOro(interaction, cfg, idioma) {
    const PerfilCasino = require('../models/PerfilCasino.js');
    const p = (await PerfilCasino.findOne({ guildId: interaction.guildId, userId: interaction.user.id }).lean()) || {};
    const saldo = (await require('./economia.js').en(interaction.guildId).obtenerUsuario(interaction.user.id)).balance;
    const c = cfg?.casino || {};
    const hoy = new Date().toISOString().slice(0, 10);
    const perdido = p.dia === hoy ? p.perdidoHoy || 0 : 0;
    const v = await require('./cofres.js').ventajasUsuario(interaction.guildId, interaction.user.id).catch(() => null);
    const e = new EmbedBuilder().setColor('#22c55e').setTitle(t(idioma, '💰 Tu oro', '💰 Your gold'))
        .addFields(
            { name: t(idioma, 'Ahora tienes', 'You have'), value: `**🪙 ${fmt(saldo, idioma)}**`, inline: true },
            { name: t(idioma, 'Perdido hoy', 'Lost today'), value: `🪙 ${fmt(Math.max(0, perdido), idioma)}${c.limiteDiario ? ` / ${fmt(c.limiteDiario, idioma)}` : ''}`, inline: true },
            { name: t(idioma, 'Tus números aquí', 'Your stats here'), value: t(idioma, `${fmt(p.jugadas, idioma)} jugadas · apostado 🪙 ${fmt(p.apostado, idioma)} · cobrado 🪙 ${fmt(p.ganado, idioma)}\nMayor premio: 🪙 ${fmt(p.mayorPremio, idioma)}`, `${fmt(p.jugadas, idioma)} plays · wagered 🪙 ${fmt(p.apostado, idioma)} · won 🪙 ${fmt(p.ganado, idioma)}\nBiggest win: 🪙 ${fmt(p.mayorPremio, idioma)}`) },
            ...(v?.vuelta ? [{ name: t(idioma, '🐾 Tu compañero', '🐾 Your companion'), value: t(idioma, `Te devuelve un ${Math.round(v.vuelta * 1000) / 10} % de lo que pierdes.`, `Gives you back ${Math.round(v.vuelta * 1000) / 10}% of what you lose.`) }] : []),
            ...(p.pausaHasta && new Date(p.pausaHasta) > new Date() ? [{ name: '🧘', value: t(idioma, `Estás en pausa hasta <t:${Math.floor(new Date(p.pausaHasta) / 1000)}:f>.`, `You’re on a break until <t:${Math.floor(new Date(p.pausaHasta) / 1000)}:f>.`) }] : []),
        )
        .setFooter({ text: t(idioma, 'Más oro: /diario cada día, votar por el bot, hablar, misiones de /compi… Si te estás pasando, tómate un descanso 💛', 'More gold: /daily every day, voting for the bot, chatting, /companion missions… If it’s getting too much, take a break 💛') });
    return { embeds: [e], components: [filaJuegos(cfg, idioma), new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cas_lp:1').setEmoji('🧘').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Descanso de 1 día', '1-day break')),
        new ButtonBuilder().setCustomId('cas_lp:7').setEmoji('🧘').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Descanso de 7 días', '7-day break')),
    )] };
}

// ---------------------------------------------------------------------------
// Botones y menús del lobby. Devuelve true si eran suyos.
// ---------------------------------------------------------------------------
async function manejar(interaction, client) {
    const id = interaction.customId || '';
    if (!/^cas_(lob|lb:|lx:|lm:|ldu:|lp:|mesa:)/.test(id)) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const userId = interaction.user.id;
    if (!cfg?.casino?.activo) { await interaction.reply({ content: t(idioma, '🎰 El casino está cerrado ahora mismo.', '🎰 The casino is closed right now.'), flags: 64 }); return true; }

    // Desde el lobby se abre tu mesa (solo para ti; sustituye a la que tuvieras abierta en este canal). Desde tu
    // mesa, el mismo desplegable cambia de juego en ese mismo mensaje (utils/ventana.js convierte la respuesta).
    if (interaction.isStringSelectMenu() && id === 'cas_lob') {
        await interaction.reply({ ...(await mesa(interaction.values[0], { cfg, idioma, guildId: interaction.guildId, userId })), flags: 64 });
        return true;
    }
    // «Cambiar apuesta o juego» de un resultado: vuelve a la mesa de ese juego (con la opción que llevabas).
    if (interaction.isButton() && id.startsWith('cas_mesa:')) {
        const [, juego, extra = null] = id.split(':');
        await interaction.reply({ ...(await mesa(juego, { cfg, idioma, guildId: interaction.guildId, userId, extra })), flags: 64 });
        return true;
    }
    if (interaction.isStringSelectMenu() && id.startsWith('cas_lx:')) {
        const [, juego, que] = id.split(':');
        const v = interaction.values[0];
        await interaction.update(await mesa(juego, { cfg, idioma, guildId: interaction.guildId, userId, ...(que === 'cantidad' ? { cantidad: parseInt(v, 10) } : { extra: v === 'nada' ? '' : v }) }));
        return true;
    }
    if (interaction.isUserSelectMenu() && id.startsWith('cas_ldu:')) {
        const cantidad = parseInt(id.split(':')[1], 10);
        const rival = interaction.users.first();
        // El reto es público: fuera del canal del casino, un aviso en tu mesa (sin dejar un mensaje a medias en el canal).
        if (casino().fueraDelCasino(cfg, interaction.channelId)) { await interaction.reply({ content: casino().textoFallo({ fallo: 'canal' }, idioma, cfg.casino), flags: 64 }); return true; }
        await interaction.deferReply();
        const r = await casino().duelo({ interaction, client, cfg, idioma, cantidad, rival });
        if (r?.error) await interaction.editReply({ content: `${/^\p{Extended_Pictographic}/u.test(r.error) ? '' : '❌ '}${r.error}` });
        return true;
    }
    if (interaction.isButton() && id.startsWith('cas_lm:')) {
        const [, juego, extra = ''] = id.split(':');
        const c = cfg.casino;
        await interaction.showModal(new ModalBuilder().setCustomId(`cas_lm:${juego}:${extra}`).setTitle(t(idioma, '¿Cuánto apuestas?', 'How much do you bet?'))
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cantidad').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(9)
                .setLabel(t(idioma, `De ${c.apuestaMin ?? 10} a ${c.apuestaMax ?? 5000}`, `From ${c.apuestaMin ?? 10} to ${c.apuestaMax ?? 5000}`)))));
        return true;
    }
    if (interaction.isModalSubmit() && id.startsWith('cas_lm:')) {
        const [, juego, extra = ''] = id.split(':');
        const cantidad = parseInt(String(interaction.fields.getTextInputValue('cantidad')).replace(/[^\d]/g, ''), 10);
        if (!cantidad) { await interaction.reply({ content: t(idioma, 'Escribe un número.', 'Type a number.'), flags: 64 }); return true; }
        // Se juega igual que con una ficha (cas_rep).
        await casino().jugarRepetir(interaction, client, cfg, idioma, juego, cantidad, extra);
        return true;
    }
    if (interaction.isButton() && id.startsWith('cas_lp:')) {
        const dias = parseInt(id.split(':')[1], 10) || 1;
        const hasta = await casino().pausa(interaction.guildId, userId, dias);
        await interaction.reply({ content: t(idioma, `🧘 Hecho: no podrás apostar aquí hasta <t:${Math.floor(hasta / 1000)}:f>. ¡Buen descanso!`, `🧘 Done: you can’t bet here until <t:${Math.floor(hasta / 1000)}:f>. Enjoy the break!`), flags: 64 });
        return true;
    }
    if (interaction.isButton() && id.startsWith('cas_lb:')) {
        const que = id.split(':')[1];
        if (que === 'mio') { await interaction.reply({ ...(await miOro(interaction, cfg, idioma)), flags: 64 }); return true; }
        // 2.5.0: el casino entero (como /casino menu) en tu ventana, desde cualquier canal (p. ej. desde /empezar).
        if (que === 'abrir') { await interaction.deferReply({ flags: 64 }); await interaction.editReply(await mensajeLobby(interaction.guild, { ...cfg, idioma }, { conCartel: true })); return true; }
        if (que === 'ranking') { await interaction.reply({ embeds: [await casino().embedBote(interaction.guild, idioma, userId)], components: [filaJuegos(cfg, idioma)], flags: 64 }); return true; }
        if (que === 'guia') { await interaction.reply({ ...(await ayuda().guiaGeneral(idioma, cfg, { canalId: interaction.channelId, guildId: interaction.guildId })), flags: 64 }); return true; }
        if (que === 'coleccion') { await interaction.deferReply({ flags: 64 }); await interaction.editReply(await require('./cofres.js').verColeccion(interaction, idioma)); return true; }
        if (que === 'diaria' || que === 'carrera' || que === 'mesaruleta' || que === 'cohete') {
            // 2.5.0: la tirada gratis es tuya: se juega en privado (en tu mesa si la pulsas ahí). Las de grupo, en el
            // canal del casino; desde otro canal, un aviso (sin abrir nada a medias).
            const grupo = que !== 'diaria';
            if (grupo && casino().fueraDelCasino(cfg, interaction.channelId)) { await interaction.reply({ content: casino().textoFallo({ fallo: 'canal' }, idioma, cfg.casino), flags: 64 }); return true; }
            if (grupo) await interaction.deferReply();
            else { interaction.__casinoPrivado = true; await interaction.deferReply({ flags: 64 }); }
            const X = require('./casinoExtra.js');
            const r = que === 'diaria' ? await casino().diaria({ interaction, client, cfg, idioma }) : que === 'carrera' ? await casino().carrera({ interaction, client, cfg, idioma }) : que === 'cohete' ? await X.cohete({ interaction, client, cfg, idioma }) : await X.mesa({ interaction, client, cfg, idioma });
            if (r?.error) { await interaction.deleteReply().catch(() => {}); await interaction.followUp({ content: `${/^\p{Extended_Pictographic}/u.test(r.error) ? '' : '❌ '}${r.error}`, flags: 64 }); }
            return true;
        }
    }
    return false;
}

module.exports = { mensajeLobby, publicar, refrescar, mesa, miOro, manejar, fichas, filaJuegos, conJuegos, OPCIONES, RESUMEN };
