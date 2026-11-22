// Guía del casino dentro de Discord (/casino ayuda): cómo se consigue oro, cómo se
// juega a cada juego (con un ejemplo del comando y lo que paga) y un botón para
// probarlo con la apuesta mínima. El menú es `cas_guia` y el botón reutiliza `cas_rep`.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const C = require('./casinoNucleo.js');
const K = require('./cofresNucleo.js');
const { t } = require('./i18n.js');

// Para cada juego: ejemplo (es/en), cómo se juega, lo que paga y el «extra» del botón de probar.
const GUIA = {
    tragaperras: {
        emoji: '🎰', probar: '',
        ej: ['/casino tragaperras apuesta:100', '/casino slots bet:100'],
        como: ['Pones una apuesta y giran los 3 rodillos. Se paran uno a uno y, si en la línea del medio sale una combinación, ganas.', 'Place a bet and the 3 reels spin. They stop one by one and, if the middle line shows a combination, you win.'],
        paga: () => [
            `${C.SIMBOLOS.slice().reverse().map((s) => `${s.emoji}${s.emoji}${s.emoji} ×${s.paga3}`).join(' · ')}\n🍒🍒 ×2 · dos iguales seguidos: recuperas lo apostado\n💎💎💎 además se lleva **el bote** del servidor.`,
            `${C.SIMBOLOS.slice().reverse().map((s) => `${s.emoji}${s.emoji}${s.emoji} ×${s.paga3}`).join(' · ')}\n🍒🍒 ×2 · two matching in a row: you get your bet back\n💎💎💎 also takes the server **jackpot**.`],
    },
    ruleta: {
        emoji: '🎡', probar: 'rojo',
        ej: ['/casino ruleta a:🔴 Rojo apuesta:100', '/casino roulette on:🔴 Red bet:100'],
        como: ['Eliges a qué apuestas y la rueda gira. Si cae en lo tuyo, ganas. Para un número concreto elige «Un número» y rellena «numero» (0-36).', 'Pick what you bet on and the wheel spins. If it lands on yours, you win. For a specific number pick “One number” and fill in “number” (0-36).'],
        paga: () => ['🔴 Rojo / ⚫ Negro / Par / Impar / 1-18 / 19-36: **×2**\nDocenas (1-12, 13-24, 25-36): **×3**\nUn número: **×36**\nEl 🟢 0 hace perder todas menos la del número 0.', '🔴 Red / ⚫ Black / Even / Odd / 1-18 / 19-36: **×2**\nDozens (1-12, 13-24, 25-36): **×3**\nOne number: **×36**\nThe 🟢 0 loses every bet except a bet on 0.'],
    },
    blackjack: {
        emoji: '🃏', probar: '',
        ej: ['/casino blackjack apuesta:100', '/casino blackjack bet:100'],
        como: ['Intenta acercarte a 21 sin pasarte. Las figuras valen 10 y el As 1 u 11. Pulsa **➕ Pedir** para otra carta, **✋ Plantarse** para quedarte, o **💰 Doblar** (con tus dos primeras cartas) para apostar el doble y recibir solo una carta más. Luego juega la banca: roba hasta llegar a 17.', 'Get as close to 21 as you can without going over. Face cards are 10 and an Ace is 1 or 11. Press **➕ Hit** for another card, **✋ Stand** to stay, or **💰 Double** (on your first two cards) to bet double and get just one more card. Then the dealer plays: draws until 17.'],
        paga: () => ['Ganas: **×2** · Blackjack (21 con dos cartas): **×2,5** · Empate: recuperas la apuesta.', 'Win: **×2** · Blackjack (21 with two cards): **×2.5** · Push: you get your bet back.'],
    },
    crash: {
        emoji: '🚀', probar: '',
        ej: ['/casino crash apuesta:100   (o con auto:2 para retirarte solo en ×2)', '/casino crash bet:100   (or with auto:2 to cash out automatically at ×2)'],
        como: ['Despega un cohete y el multiplicador sube (×1,5… ×2… ×5…). Pulsa **🪂 Retirarme** cuando quieras y cobras tu apuesta por ese multiplicador. Pero en cualquier momento puede **explotar**: si explota antes de que te retires, lo pierdes.', 'A rocket takes off and the multiplier climbs (×1.5… ×2… ×5…). Press **🪂 Cash out** whenever you want and you get your bet times that multiplier. But it can **blow up** at any moment: if it blows up before you cash out, you lose it.'],
        paga: () => ['Lo que marque cuando te retires (hasta ×100).', 'Whatever it shows when you cash out (up to ×100).'],
    },
    minas: {
        emoji: '💣', probar: '3',
        ej: ['/casino minas apuesta:100 minas:3', '/casino mines bet:100 mines:3'],
        como: ['Sale un tablero de 20 casillas ❔ con minas escondidas. Pulsa casillas: cada 💎 sube el premio. Pulsa **💰 Retirarme** para cobrar lo que llevas. Si destapas una 💣, lo pierdes todo. Más minas = más riesgo y más premio.', 'You get a board of 20 ❔ tiles with hidden mines. Tap tiles: each 💎 raises the prize. Press **💰 Cash out** to collect what you have. Uncover a 💣 and you lose it all. More mines = more risk and bigger prizes.'],
        paga: () => [`Con 3 minas: 1 💎 ×${C.multMinas(3, 1)} · 3 💎 ×${C.multMinas(3, 3)} · 5 💎 ×${C.multMinas(3, 5)} · 8 💎 ×${C.multMinas(3, 8)}`, `With 3 mines: 1 💎 ×${C.multMinas(3, 1)} · 3 💎 ×${C.multMinas(3, 3)} · 5 💎 ×${C.multMinas(3, 5)} · 8 💎 ×${C.multMinas(3, 8)}`],
    },
    moneda: {
        emoji: '🪙', probar: 'cara',
        ej: ['/casino moneda lado:👑 Cara apuesta:100', '/casino coinflip side:👑 Heads bet:100'],
        como: ['Eliges cara o cruz y la moneda gira en el aire. Si sale lo tuyo, ganas.', 'Pick heads or tails and the coin spins in the air. If it lands on yours, you win.'],
        paga: () => [`**×${C.MONEDA_PAGO}**`, `**×${C.MONEDA_PAGO}**`],
    },
    duelo: {
        emoji: '⚔️', probar: null,
        ej: ['/casino duelo rival:@Alex apuesta:500', '/casino duel rival:@Alex bet:500'],
        como: ['Retas a otra persona: tiene 60 s para pulsar **⚔️ Aceptar**. Los dos ponen lo mismo y se lanza una moneda (tú eres cara). Si no acepta, se te devuelve el oro.', 'Challenge someone: they have 60 s to press **⚔️ Accept**. You both put in the same and a coin is flipped (you’re heads). If they don’t accept, your gold is refunded.'],
        paga: () => [`El ganador se lleva el doble menos un ${Math.round(C.DUELO_COMISION * 100)} %.`, `The winner takes double minus ${Math.round(C.DUELO_COMISION * 100)}%.`],
    },
    hilo: {
        emoji: '🔼', probar: '',
        ej: ['/casino mayormenor apuesta:100', '/casino higherlower bet:100'],
        como: ['Sale una carta. Di si la siguiente será **⬆️ mayor** o **⬇️ menor** (A=1, J=11, Q=12, K=13). Cada acierto multiplica lo que llevas; si es igual, empate y sigues. Pulsa **💰 Retirarme** cuando quieras: si fallas, lo pierdes.', 'A card is shown. Say whether the next one will be **⬆️ higher** or **⬇️ lower** (A=1, J=11, Q=12, K=13). Each correct guess multiplies what you have; a tie changes nothing. Press **💰 Cash out** whenever you want: miss and you lose it.'],
        paga: () => ['Cada botón dice lo que paga ese acierto: lo difícil paga más (p. ej. «mayor» desde un 10 paga ×3,88). Hasta ×100.', 'Each button shows what that guess pays: harder guesses pay more (e.g. “higher” from a 10 pays ×3.88). Up to ×100.'],
    },
    rasca: {
        emoji: '🎟️', probar: '',
        ej: ['/casino rasca apuesta:100', '/casino scratch bet:100'],
        como: ['Compras un boleto con 9 casillas. Ráscalas una a una (o **✨ Rascar todo**): si salen **3 símbolos iguales**, ganas lo que paga ese símbolo.', 'You buy a ticket with 9 tiles. Scratch them one by one (or **✨ Scratch all**): if you get **3 of the same symbol**, you win what it pays.'],
        paga: () => [C.RASCA_PREMIOS.map((x) => `${x.simbolo}×3 → ×${x.mult}`).join(' · '), C.RASCA_PREMIOS.map((x) => `${x.simbolo}×3 → ×${x.mult}`).join(' · ')],
    },
    carrera: {
        emoji: '🏇', probar: null,
        ej: ['/casino carrera', '/casino race'],
        como: ['Abre una carrera en el canal. Durante 45 s **cualquiera** pulsa el corredor que quiera y escribe cuánto apuesta. Luego la carrera se ve en directo y cobran los que acertaron.', 'Start a race in the channel. For 45 s **anyone** taps the runner they like and types how much to bet. Then the race plays live and whoever picked the winner gets paid.'],
        paga: () => [C.CORREDORES.map((c) => `${c.emoji} ×${C.cuota(c.id)}`).join(' · ') + '\n(Los que pagan más ganan menos veces.)', C.CORREDORES.map((c) => `${c.emoji} ×${C.cuota(c.id)}`).join(' · ') + '\n(The higher-paying ones win less often.)'],
    },
};

function menuJuegos(idioma, cfg) {
    const nombres = require('./casino.js').JUEGOS;
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cas_guia')
        .setPlaceholder(t(idioma, '📖 ¿Cómo se juega a…?', '📖 How do you play…?'))
        .addOptions([
            ...Object.keys(GUIA).filter((j) => cfg?.casino?.juegos?.[j] !== false).map((j) => ({ label: t(idioma, nombres[j].es, nombres[j].en), value: j, emoji: GUIA[j].emoji })),
            { label: t(idioma, 'Cofres de mascotas', 'Pet chests'), value: 'cofres', emoji: '🎁' },
        ]));
}

function guiaGeneral(idioma, cfg) {
    const c = cfg?.casino || {};
    const min = c.apuestaMin ?? 10; const max = c.apuestaMax ?? 5000;
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(t(idioma, '🎰 Cómo se juega en el casino', '🎰 How to play at the casino'))
        .setDescription(t(idioma,
            `**1.** Consigue oro: \`/diario\` cada día, votando por el bot (\`/votar\`), hablando, en sorpresas de la mascota…\n**2.** En el canal del casino elige un juego en el **desplegable** (o escribe **\`/casino menu\`**).\n**3.** Pon la **apuesta** (entre 🪙 ${min} y 🪙 ${max}) y mira la animación.\n**4.** Al acabar sale **🔁 Otra vez** para repetir con un toque.\n\nEmpieza gratis con **\`/casino diaria\`**: una tirada de la tragaperras al día sin gastar nada.`,
            `**1.** Get gold: \`/daily\` every day, voting for the bot (\`/vote\`), chatting, pet surprises…\n**2.** In the casino channel pick a game from the **menu** (or type **\`/casino menu\`**).\n**3.** Set your **bet** (between 🪙 ${min} and 🪙 ${max}) and watch the animation.\n**4.** When it ends, **🔁 Again** lets you replay with one tap.\n\nStart for free with **\`/casino daily\`**: one slots spin a day without spending anything.`))
        .addFields(
            { name: t(idioma, '🎲 Los juegos', '🎲 The games'), value: Object.entries(GUIA).filter(([j]) => c.juegos?.[j] !== false).map(([, g]) => `${g.emoji} \`${t(idioma, g.ej[0], g.ej[1]).split('   ')[0]}\``).join('\n') },
            { name: t(idioma, '🎁 Cofres de mascotas', '🎁 Pet chests'), value: t(idioma, '`/cofre abrir` · `/cofre coleccion` · `/cofre probabilidades`', '`/chest open` · `/chest collection` · `/chest odds`'), inline: true },
            { name: t(idioma, '🧘 Con cabeza', '🧘 Play smart'), value: t(idioma, `Tope de pérdidas al día: 🪙 ${c.limiteDiario ? c.limiteDiario : '∞'}\n\`/casino pausa\` para descansar 1-30 días`, `Daily loss limit: 🪙 ${c.limiteDiario ? c.limiteDiario : '∞'}\n\`/casino pause\` to take a 1-30 day break`), inline: true },
        )
        .setFooter({ text: t(idioma, 'Elige un juego abajo para ver cómo funciona · el oro es virtual: no se compra ni se cambia por dinero', 'Pick a game below to see how it works · gold is virtual: it can’t be bought or exchanged for money') });
    if (c.canalId) e.addFields({ name: t(idioma, '📍 Dónde', '📍 Where'), value: `<#${c.canalId}>` });
    return { embeds: [e], components: [menuJuegos(idioma, cfg)] };
}

function guiaJuego(juego, idioma, cfg) {
    if (juego === 'cofres') {
        const e = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, '🎁 Cofres de mascotas', '🎁 Pet chests'))
            .setDescription(t(idioma,
                `Con **\`/cofre abrir\`** eliges un cofre (📦 ${K.COFRES.basico.precio} · 💜 ${K.COFRES.epico.precio} · 👑 ${K.COFRES.legendario.precio}) y sale un compañero al azar. Llevas equipado uno y te da ventajas: más XP, más oro en \`/diario\` y vuelta en el casino. Los repetidos suben estrellas ★.\nCon **\`/cofre coleccion\`** ves los tuyos y cambias el que llevas. **\`/cofre probabilidades\`** dice qué puede salir.\n🌈 Hay una **DIVINA** rarísima: Sokyo, el Dragón Celestial.`,
                `With **\`/chest open\`** you pick a chest (📦 ${K.COFRES.basico.precio} · 💜 ${K.COFRES.epico.precio} · 👑 ${K.COFRES.legendario.precio}) and get a random companion. You wear one and it gives you perks: more XP, more gold on \`/daily\` and casino cashback. Duplicates add stars ★.\n**\`/chest collection\`** shows yours and lets you switch. **\`/chest odds\`** shows what can drop.\n🌈 There’s one ultra-rare **DIVINE**: Sokyo, the Celestial Dragon.`));
        return { embeds: [e], components: [menuJuegos(idioma, cfg)] };
    }
    const g = GUIA[juego];
    const nombres = require('./casino.js').JUEGOS;
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(`${g.emoji} ${t(idioma, nombres[juego].es, nombres[juego].en)}`)
        .addFields(
            { name: t(idioma, '✍️ Escribe', '✍️ Type'), value: `\`${t(idioma, g.ej[0], g.ej[1])}\`` },
            { name: t(idioma, '🎮 Cómo se juega', '🎮 How to play'), value: t(idioma, g.como[0], g.como[1]) },
            { name: t(idioma, '💰 Lo que paga', '💰 Payouts'), value: t(idioma, ...g.paga()) },
        );
    const filas = [menuJuegos(idioma, cfg)];
    if (g.probar !== null && cfg?.casino?.activo) {
        const min = cfg.casino.apuestaMin ?? 10;
        filas.unshift(new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId(`cas_rep:${juego}:${min}${g.probar ? `:${g.probar}` : ''}`).setStyle(ButtonStyle.Success).setEmoji('▶️')
            .setLabel(t(idioma, `Probar con 🪙 ${min}`, `Try it with 🪙 ${min}`))));
    }
    return { embeds: [e], components: filas };
}

module.exports = { GUIA, guiaGeneral, guiaJuego };
