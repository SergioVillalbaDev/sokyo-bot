// Guía del casino dentro de Discord (/casino ayuda, «Cómo se juega» del lobby, /empezar).
// 1.34.1: rehecha. Portada = mapa del casino en imagen (cada juego con su icono, separados en
// «solo para ti» y «con más gente», los fáciles marcados) + menú con una frase por juego. Ficha
// de cada juego: icono, cómo se juega, lo que paga, el comando y SOLO botones que funcionan ahí
// (probar/abrir si estás en el canal del casino; si no, un enlace para ir; «Todos los juegos» para
// volver). Menú `cas_guia`, volver `cas_guiav`; probar reutiliza `cas_rep` y abrir, `cas_lb:*`.
// En la guía PÚBLICA (la que el panel deja fija en el canal) nada cambia el mensaje de todos: cada
// uno ve la ficha solo para él.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const C = require('./casinoNucleo.js');
const K = require('./cofresNucleo.js');
const { t } = require('./i18n.js');

// Para cada juego: ejemplo (es/en), cómo se juega, lo que paga y el «extra» del botón de probar.
// 1.34.1: `grupo` (se juega con más gente), `facil` (para empezar), `corto` (frase del menú, ≤ 100),
// `abrir` (botón del lobby que lo abre, para los de grupo), `activo` (qué interruptor del panel lo apaga)
// y `nombre` (si no está en casino.JUEGOS).
const GUIA = {
    tragaperras: {
        facil: true, corto: ['Tres rodillos: tres iguales y ganas. Con 💎💎💎, el bote.', 'Three reels: three of a kind wins. 💎💎💎 takes the jackpot.'],
        emoji: '🎰', probar: '',
        ej: ['/casino tragaperras apuesta:100', '/casino slots bet:100'],
        como: ['Pones una apuesta y giran los 3 rodillos. Se paran uno a uno y, si en la línea del medio sale una combinación, ganas.', 'Place a bet and the 3 reels spin. They stop one by one and, if the middle line shows a combination, you win.'],
        paga: () => [
            `${C.SIMBOLOS.slice().reverse().map((s) => `${s.emoji}${s.emoji}${s.emoji} ×${s.paga3}`).join(' · ')}\n🍒🍒 ×2 · dos iguales seguidos: recuperas lo apostado\n💎💎💎 además se lleva **el bote** del servidor.`,
            `${C.SIMBOLOS.slice().reverse().map((s) => `${s.emoji}${s.emoji}${s.emoji} ×${s.paga3}`).join(' · ')}\n🍒🍒 ×2 · two matching in a row: you get your bet back\n💎💎💎 also takes the server **jackpot**.`],
    },
    ruleta: {
        corto: ['Rojo, negro, par, docenas o un número.', 'Red, black, even, dozens or a single number.'],
        emoji: '🎡', probar: 'rojo',
        ej: ['/casino ruleta a:🔴 Rojo apuesta:100', '/casino roulette on:🔴 Red bet:100'],
        como: ['Eliges a qué apuestas y la rueda gira. Si cae en lo tuyo, ganas. Para un número concreto elige «Un número» y rellena «numero» (0-36).', 'Pick what you bet on and the wheel spins. If it lands on yours, you win. For a specific number pick “One number” and fill in “number” (0-36).'],
        paga: () => ['🔴 Rojo / ⚫ Negro / Par / Impar / 1-18 / 19-36: **×2**\nDocenas (1-12, 13-24, 25-36): **×3**\nUn número: **×36**\nEl 🟢 0 hace perder todas menos la del número 0.', '🔴 Red / ⚫ Black / Even / Odd / 1-18 / 19-36: **×2**\nDozens (1-12, 13-24, 25-36): **×3**\nOne number: **×36**\nThe 🟢 0 loses every bet except a bet on 0.'],
    },
    blackjack: {
        corto: ['Acércate a 21 sin pasarte y gana a la banca.', 'Get close to 21 without going over and beat the dealer.'],
        emoji: '🃏', probar: '',
        ej: ['/casino blackjack apuesta:100', '/casino blackjack bet:100'],
        como: ['Intenta acercarte a 21 sin pasarte. Las figuras valen 10 y el As 1 u 11. Pulsa **➕ Pedir** para otra carta, **✋ Plantarse** para quedarte, o **💰 Doblar** (con tus dos primeras cartas) para apostar el doble y recibir solo una carta más. Luego juega la banca: roba hasta llegar a 17.', 'Get as close to 21 as you can without going over. Face cards are 10 and an Ace is 1 or 11. Press **➕ Hit** for another card, **✋ Stand** to stay, or **💰 Double** (on your first two cards) to bet double and get just one more card. Then the dealer plays: draws until 17.'],
        paga: () => ['Ganas: **×2** · Blackjack (21 con dos cartas): **×2,5** · Empate: recuperas la apuesta.', 'Win: **×2** · Blackjack (21 with two cards): **×2.5** · Push: you get your bet back.'],
    },
    crash: {
        corto: ['El cohete sube: retírate antes de que explote.', 'The rocket climbs: cash out before it blows up.'],
        emoji: '🚀', probar: '',
        ej: ['/casino crash apuesta:100   (o con auto:2 para retirarte solo en ×2)', '/casino crash bet:100   (or with auto:2 to cash out automatically at ×2)'],
        como: ['Despega un cohete y el multiplicador sube (×1,5… ×2… ×5…). Pulsa **🪂 Retirarme** cuando quieras y cobras tu apuesta por ese multiplicador. Pero en cualquier momento puede **explotar**: si explota antes de que te retires, lo pierdes.', 'A rocket takes off and the multiplier climbs (×1.5… ×2… ×5…). Press **🪂 Cash out** whenever you want and you get your bet times that multiplier. But it can **blow up** at any moment: if it blows up before you cash out, you lose it.'],
        paga: () => ['Lo que marque cuando te retires (hasta ×100).', 'Whatever it shows when you cash out (up to ×100).'],
    },
    minas: {
        corto: ['Destapa diamantes y evita las minas.', 'Uncover diamonds and avoid the mines.'],
        emoji: '💣', probar: '3',
        ej: ['/casino minas apuesta:100 minas:3', '/casino mines bet:100 mines:3'],
        como: ['Sale un tablero de 20 casillas ❔ con minas escondidas. Pulsa casillas: cada 💎 sube el premio. Pulsa **💰 Retirarme** para cobrar lo que llevas. Si destapas una 💣, lo pierdes todo. Más minas = más riesgo y más premio.', 'You get a board of 20 ❔ tiles with hidden mines. Tap tiles: each 💎 raises the prize. Press **💰 Cash out** to collect what you have. Uncover a 💣 and you lose it all. More mines = more risk and bigger prizes.'],
        paga: () => [`Con 3 minas: 1 💎 ×${C.multMinas(3, 1)} · 3 💎 ×${C.multMinas(3, 3)} · 5 💎 ×${C.multMinas(3, 5)} · 8 💎 ×${C.multMinas(3, 8)}`, `With 3 mines: 1 💎 ×${C.multMinas(3, 1)} · 3 💎 ×${C.multMinas(3, 3)} · 5 💎 ×${C.multMinas(3, 5)} · 8 💎 ×${C.multMinas(3, 8)}`],
    },
    moneda: {
        facil: true, corto: ['Cara o cruz: doblas o pierdes.', 'Heads or tails: double or nothing.'],
        emoji: '🪙', probar: 'cara',
        ej: ['/casino moneda lado:👑 Cara apuesta:100', '/casino coinflip side:👑 Heads bet:100'],
        como: ['Eliges cara o cruz y la moneda gira en el aire. Si sale lo tuyo, ganas.', 'Pick heads or tails and the coin spins in the air. If it lands on yours, you win.'],
        paga: () => [`**×${C.MONEDA_PAGO}**`, `**×${C.MONEDA_PAGO}**`],
    },
    duelo: {
        grupo: true, corto: ['Reta a alguien: una moneda decide.', 'Challenge someone: a coin decides.'],
        emoji: '⚔️', probar: null,
        ej: ['/casino duelo rival:@Alex apuesta:500', '/casino duel rival:@Alex bet:500'],
        como: ['Retas a otra persona: tiene 60 s para pulsar **⚔️ Aceptar**. Los dos ponen lo mismo y se lanza una moneda (tú eres cara). Si no acepta, se te devuelve el oro.', 'Challenge someone: they have 60 s to press **⚔️ Accept**. You both put in the same and a coin is flipped (you’re heads). If they don’t accept, your gold is refunded.'],
        paga: () => [`El ganador se lleva el doble menos un ${Math.round(C.DUELO_COMISION * 100)} %.`, `The winner takes double minus ${Math.round(C.DUELO_COMISION * 100)}%.`],
    },
    hilo: {
        facil: true, corto: ['¿La siguiente carta, mayor o menor?', 'Will the next card be higher or lower?'],
        emoji: '🔼', probar: '',
        ej: ['/casino mayormenor apuesta:100', '/casino higherlower bet:100'],
        como: ['Sale una carta. Di si la siguiente será **⬆️ mayor** o **⬇️ menor** (A=1, J=11, Q=12, K=13). Cada acierto multiplica lo que llevas; si es igual, empate y sigues. Pulsa **💰 Retirarme** cuando quieras: si fallas, lo pierdes.', 'A card is shown. Say whether the next one will be **⬆️ higher** or **⬇️ lower** (A=1, J=11, Q=12, K=13). Each correct guess multiplies what you have; a tie changes nothing. Press **💰 Cash out** whenever you want: miss and you lose it.'],
        paga: () => ['Cada botón dice lo que paga ese acierto: lo difícil paga más (p. ej. «mayor» desde un 10 paga ×3,88). Hasta ×100.', 'Each button shows what that guess pays: harder guesses pay more (e.g. “higher” from a 10 pays ×3.88). Up to ×100.'],
    },
    plinko: {
        corto: ['Suelta la bola y mira dónde cae.', 'Drop the ball and see where it lands.'],
        emoji: '🔻', probar: 'bajo',
        ej: ['/casino plinko apuesta:100 riesgo:Alto', '/casino plinko bet:100 risk:High'],
        como: ['Dejas caer una bola desde arriba: rebota en 8 filas de clavos y cae en una casilla. Las de los bordes pagan mucho pero salen poco. Elige el riesgo: bajo (premios pequeños y seguros) o alto (todo o casi nada).', 'Drop a ball from the top: it bounces through 8 rows of pegs and lands in a slot. The edge slots pay a lot but are rare. Pick the risk: low (small, safe prizes) or high (all or almost nothing).'],
        paga: () => { const f = (r) => C.PLINKO[r].slice(0, 5).map((m) => `×${String(m).replace('.', ',')}`).join(' · '); return [`🟢 ${f('bajo')}\n🟠 ${f('medio')}\n🔴 ${f('alto')}\n(de los bordes al centro)`, `🟢 ${f('bajo').replace(/,/g, '.')}\n🟠 ${f('medio').replace(/,/g, '.')}\n🔴 ${f('alto').replace(/,/g, '.')}\n(from the edges to the middle)`]; },
    },
    rueda: {
        mapa: ['Rueda', 'Wheel'], corto: ['Elige un número de la rueda: el raro paga más.', 'Pick a number on the wheel: rarer pays more.'],
        emoji: '🛞', probar: '1',
        ej: ['/casino rueda apuesta:100 numero:5', '/casino wheel bet:100 number:5'],
        como: ['Apuestas a un número de la rueda (1, 2, 5, 10, 20 o 40) y gira. Si la flecha se para en tu número, ganas lo que paga. Cuanto menos sale un número, más paga.', 'Bet on a number on the wheel (1, 2, 5, 10, 20 or 40) and it spins. If the arrow stops on your number, you win what it pays. The rarer the number, the more it pays.'],
        paga: () => [C.RUEDA.map((r) => `**${r.n}** ×${String(r.paga).replace('.', ',')} (${r.veces}/50)`).join(' · '), C.RUEDA.map((r) => `**${r.n}** ×${r.paga} (${r.veces}/50)`).join(' · ')],
    },
    dados: {
        corto: ['Tres dados: grande, pequeño, par, impar o trío.', 'Three dice: big, small, even, odd or triple.'],
        emoji: '🎲', probar: 'grande',
        ej: ['/casino dados apuesta:100 a:Grande', '/casino dice bet:100 on:Big'],
        como: ['Se tiran **tres dados**. Apuesta a **Grande** (suma 11-17), **Pequeño** (4-10), **Par** o **Impar**; o a un **Trío** (los tres iguales) o a un **número** concreto. Ojo: si sale un trío, Grande, Pequeño, Par e Impar pierden.', 'Three **dice** are rolled. Bet on **Big** (total 11-17), **Small** (4-10), **Even** or **Odd**; or on a **Triple** (all three the same) or a specific **number**. Careful: if a triple comes up, Big, Small, Even and Odd lose.'],
        paga: () => [`Grande, Pequeño, Par, Impar ×2 · Trío ×${C.TRIO_PAGO} · Un número: ×2 si sale en un dado, ×3 en dos y ×13 en los tres`, `Big, Small, Even, Odd ×2 · Triple ×${C.TRIO_PAGO} · One number: ×2 on one die, ×3 on two and ×13 on all three`],
    },
    baccarat: {
        corto: ['Jugador o banca: quién llega más cerca de 9.', 'Player or banker: who gets closest to 9.'],
        emoji: '🎴', probar: 'jugador',
        ej: ['/casino baccarat apuesta:100 a:Banca', '/casino baccarat bet:100 on:Banker'],
        como: ['Dos manos, **Jugador** y **Banca**, reciben 2 o 3 cartas (las reparte el bot con las reglas de siempre). Gana la que se acerque más a **9**: el As vale 1, las figuras y el 10 valen 0 y solo cuenta la última cifra (7 + 8 = 5). Tú solo eliges quién gana.', 'Two hands, **Player** and **Banker**, get 2 or 3 cards (dealt by the bot with the usual rules). Whoever is closest to **9** wins: Ace is 1, face cards and 10 are 0, and only the last digit counts (7 + 8 = 5). You just pick who wins.'],
        paga: () => ['Jugador ×2 · Banca ×1,95 · Empate ×9. Si hay empate y apostaste a Jugador o Banca, recuperas lo apostado.', 'Player ×2 · Banker ×1.95 · Tie ×9. On a tie, bets on Player or Banker are returned.'],
    },
    poker: {
        grupo: true, corto: ['Texas Hold\'em de 2 a 6 en el canal.', 'Texas Hold\'em for 2 to 6 in the channel.'],
        emoji: '♠️', probar: null,
        ej: ['/casino poker entrada:1000', '/casino poker buyin:1000'],
        como: ['Abre una mesa en el canal: de 2 a 6 personas pagan la **entrada** y la reciben en fichas. Cada uno tiene 2 cartas (míralas con **👀 Mis cartas**) y en la mesa salen 5 para todos. Por turnos: **pasar**, **igualar**, **subir** o **retirarte**. Gana la mejor mano de 5 cartas o quien se queda solo. Se juegan manos seguidas; al levantarte cobras tus fichas.', 'Open a table in the channel: 2 to 6 players pay the **buy-in** and get it as chips. Everyone gets 2 cards (see them with **👀 My cards**) and 5 shared cards come out on the table. In turns: **check**, **call**, **raise** or **fold**. Best 5-card hand wins, or whoever is left alone. Hands keep coming; when you leave you cash out your chips.'],
        paga: () => ['Te llevas las fichas que ganas a los demás. La casa solo se queda un 2 % de los botes que llegan al flop. Manos, de mejor a peor: escalera de color, póker, full, color, escalera, trío, doble pareja, pareja, carta alta.', 'You keep the chips you win from others. The house only takes 2% of pots that reach the flop. Hands, best to worst: straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card.'],
    },
    bingo: {
        grupo: true, corto: ['Bingo para todo el canal: línea y bingo.', 'Bingo for the whole channel: line and bingo.'],
        emoji: '🎱', probar: null,
        ej: ['/casino bingo carton:100', '/casino bingo card:100'],
        como: ['Abre un bingo para **todo el canal**: durante 45 s cada uno compra hasta 4 cartones de 15 números. Luego salen las bolas solas y los cartones se tachan solos (míralos con **👀 Mis cartones**). El primero que completa una **fila** canta línea; el primero que llena el **cartón entero**, bingo.', 'Open a bingo for **the whole channel**: for 45 s everyone buys up to 4 cards of 15 numbers. Then balls are drawn automatically and cards mark themselves (see them with **👀 My cards**). First to complete a **row** gets the line; first to fill the **whole card**, bingo.'],
        paga: () => [`El bote es el ${Math.round(C.BOTE_BINGO * 100)} % de lo vendido: la línea se lleva el ${Math.round(C.LINEA_BINGO * 100)} % y el bingo el resto (si cantan dos a la vez, se reparte). Cuantos más cartones haya, más bote.`, `The pot is ${Math.round(C.BOTE_BINGO * 100)}% of all cards sold: the line takes ${Math.round(C.LINEA_BINGO * 100)}% and the bingo the rest (split on ties). More cards, bigger pot.`],
    },
    rasca: {
        facil: true, corto: ['Rasca 9 casillas: tres iguales y ganas.', 'Scratch 9 tiles: three of a kind wins.'],
        emoji: '🎟️', probar: '',
        ej: ['/casino rasca apuesta:100', '/casino scratch bet:100'],
        como: ['Compras un boleto con 9 casillas. Ráscalas una a una (o **✨ Rascar todo**): si salen **3 símbolos iguales**, ganas lo que paga ese símbolo.', 'You buy a ticket with 9 tiles. Scratch them one by one (or **✨ Scratch all**): if you get **3 of the same symbol**, you win what it pays.'],
        paga: () => [C.RASCA_PREMIOS.map((x) => `${x.simbolo}×3 → ×${x.mult}`).join(' · '), C.RASCA_PREMIOS.map((x) => `${x.simbolo}×3 → ×${x.mult}`).join(' · ')],
    },
    carrera: {
        grupo: true, abrir: 'carrera', corto: ['Apuesta por un corredor y mira la carrera.', 'Bet on a runner and watch the race.'],
        emoji: '🏇', probar: null,
        ej: ['/casino carrera', '/casino race'],
        como: ['Abre una carrera en el canal. Durante 45 s **cualquiera** pulsa el corredor que quiera y escribe cuánto apuesta. Luego la carrera se ve en directo y cobran los que acertaron.', 'Start a race in the channel. For 45 s **anyone** taps the runner they like and types how much to bet. Then the race plays live and whoever picked the winner gets paid.'],
        paga: () => [C.CORREDORES.map((c) => `${c.emoji} ×${C.cuota(c.id)}`).join(' · ') + '\n(Los que pagan más ganan menos veces.)', C.CORREDORES.map((c) => `${c.emoji} ×${C.cuota(c.id)}`).join(' · ') + '\n(The higher-paying ones win less often.)'],
    },
    // 1.34.1: los que faltaban en la guía.
    cohete: {
        grupo: true, abrir: 'cohete', activo: 'crash', nombre: ['Cohete del canal', 'Channel rocket'], mapa: ['Cohete', 'Rocket'], corto: ['Un crash para todos: cada uno se baja cuando quiere.', 'A crash for everyone: each one cashes out when they want.'],
        emoji: '🛸', probar: null,
        ej: ['/casino cohete', '/casino rocket'],
        como: ['Abre un cohete para **todo el canal**: durante 20 s cualquiera pulsa **🚀 Subirme** y pone su apuesta. Luego despega y el multiplicador sube. Cada uno pulsa **🪂 Retirarme** cuando quiere; quien siga dentro cuando explote, lo pierde.', 'Open a rocket for **the whole channel**: for 20 s anyone presses **🚀 Hop on** and places a bet. Then it takes off and the multiplier climbs. Everyone presses **🪂 Cash out** when they want; whoever is still on board when it blows up loses it.'],
        paga: () => ['Lo que marque cuando te retires (como el crash).', 'Whatever it shows when you cash out (like crash).'],
    },
    mesa: {
        grupo: true, abrir: 'mesaruleta', activo: 'ruleta', nombre: ['Ruleta en mesa', 'Table roulette'], corto: ['Una ruleta para todo el canal: una tirada para todos.', 'One roulette for the whole channel: one spin for all.'],
        emoji: '🪑', probar: null,
        ej: ['/casino mesa', '/casino table'],
        como: ['Abre una ruleta para **todo el canal**: durante 30 s cada uno pulsa a qué apuesta (rojo, negro, par, impar o el 0) y escribe cuánto. Luego gira **una sola vez para todos**.', 'Open a roulette for **the whole channel**: for 30 s everyone presses what they bet on (red, black, even, odd or zero) and types how much. Then it spins **once for everyone**.'],
        paga: () => ['🔴 Rojo / ⚫ Negro / Par / Impar: **×2** · 🟢 El 0: **×36**', '🔴 Red / ⚫ Black / Even / Odd: **×2** · 🟢 Zero: **×36**'],
    },
    loteria: {
        grupo: true, activo: 'loteria', nombre: ['Lotería semanal', 'Weekly lottery'], mapa: ['Lotería', 'Lottery'], corto: ['Boletos toda la semana y sorteo el domingo.', 'Tickets all week and a draw on Sunday.'],
        emoji: '🎫', probar: null,
        ej: ['/casino loteria boletos:5', '/casino lottery tickets:5'],
        como: [`Compra boletos (🪙 ${C.PRECIO_BOLETO} cada uno, hasta ${C.MAX_BOLETOS} por semana). **El domingo a las 20:00 (UTC)** se sortean 3 premios entre todos los boletos del servidor. Cuantos más boletos tengas, más posibilidades.`, `Buy tickets (🪙 ${C.PRECIO_BOLETO} each, up to ${C.MAX_BOLETOS} a week). **On Sunday at 20:00 (UTC)** 3 prizes are drawn among all the server’s tickets. The more tickets you have, the better your chances.`],
        paga: () => [`El bote es el ${Math.round(C.BOTE_LOTERIA * 100)} % de lo vendido: 1.º ${Math.round(C.REPARTO_LOTERIA[0] * 100)} %, 2.º ${Math.round(C.REPARTO_LOTERIA[1] * 100)} % y 3.º ${Math.round(C.REPARTO_LOTERIA[2] * 100)} %.`, `The pot is ${Math.round(C.BOTE_LOTERIA * 100)}% of all tickets sold: 1st ${Math.round(C.REPARTO_LOTERIA[0] * 100)}%, 2nd ${Math.round(C.REPARTO_LOTERIA[1] * 100)}% and 3rd ${Math.round(C.REPARTO_LOTERIA[2] * 100)}%.`],
    },
};

const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const nombreDe = (j, idioma) => {
    const g = GUIA[j]; const J = require('./casino.js').JUEGOS[j];
    return g?.nombre ? t(idioma, g.nombre[0], g.nombre[1]) : J ? t(idioma, J.es, J.en) : j;
};
// ¿Está apagado en este servidor? (el cohete va con el crash; la mesa, con la ruleta)
const apagado = (j, cfg) => cfg?.casino?.juegos?.[GUIA[j]?.activo || j] === false;
const visibles = (cfg) => Object.keys(GUIA).filter((j) => !apagado(j, cfg));
// En el canal del casino se puede jugar desde la guía; fuera, se ofrece ir allí.
const enCanal = (cfg, canalId) => !cfg?.casino?.canalId || !canalId || cfg.casino.canalId === canalId;
const enlaceCanal = (cfg, guildId, idioma) => (cfg?.casino?.canalId && guildId
    ? new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${guildId}/${cfg.casino.canalId}`).setEmoji('🎰').setLabel(t(idioma, 'Ir al casino', 'Go to the casino'))
    : null);

function menuJuegos(idioma, cfg, actual = null) {
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('cas_guia')
        .setPlaceholder(t(idioma, '🎮 Elige un juego para ver cómo se juega', '🎮 Pick a game to see how it works'))
        .addOptions([
            ...visibles(cfg).map((j) => ({
                label: nombreDe(j, idioma).slice(0, 100), value: j, emoji: GUIA[j].emoji, default: j === actual,
                description: `${GUIA[j].grupo ? '👥 ' : GUIA[j].facil ? '⭐ ' : ''}${t(idioma, GUIA[j].corto[0], GUIA[j].corto[1])}`.slice(0, 100),
            })),
            { label: t(idioma, 'Cofres de mascotas', 'Pet chests'), value: 'cofres', emoji: '🎁', default: actual === 'cofres', description: t(idioma, 'Abre cofres y consigue compañeros con ventajas.', 'Open chests and get companions with perks.') },
        ].slice(0, 25)));
}

// Portada de la guía. ctx = { canalId (donde se abre), guildId }.
async function guiaGeneral(idioma, cfg, { canalId = null, guildId = null } = {}) {
    const c = cfg?.casino || {};
    const min = c.apuestaMin ?? 10; const max = c.apuestaMax ?? 5000;
    const es = t(idioma, 'es', 'en') === 'es';
    const juegos = Object.keys(GUIA).map((j) => ({ j, emoji: GUIA[j].emoji, nombre: GUIA[j].mapa ? t(idioma, GUIA[j].mapa[0], GUIA[j].mapa[1]) : nombreDe(j, idioma), facil: !!GUIA[j].facil, apagado: apagado(j, cfg) }));
    const png = require('./arteVistas.js').tarjetaGuiaCasino({
        titulo: t(idioma, '🎰 CÓMO SE JUEGA', '🎰 HOW TO PLAY'),
        sub: t(idioma, 'Oro virtual: no se compra ni se cambia por dinero', 'Virtual gold: it can’t be bought or exchanged for money'),
        pasos: es ? ['🪙 Consigue oro', '🎮 Elige un juego', '🎯 Apuesta y mira'] : ['🪙 Get gold', '🎮 Pick a game', '🎯 Bet and watch'],
        grupos: [
            { titulo: t(idioma, '👤 SOLO PARA TI', '👤 JUST FOR YOU'), juegos: juegos.filter((x) => !GUIA[x.j].grupo) },
            { titulo: t(idioma, '👥 CON MÁS GENTE', '👥 WITH OTHERS'), juegos: juegos.filter((x) => GUIA[x.j].grupo) },
        ],
        pie: [
            t(idioma, '🎁 Tirada gratis cada día', '🎁 Free spin every day'),
            `🪙 ${fmt(min, idioma)} – ${fmt(max, idioma)}`,
            ...(c.limiteDiario ? [t(idioma, `🛑 Tope diario 🪙 ${fmt(c.limiteDiario, idioma)}`, `🛑 Daily cap 🪙 ${fmt(c.limiteDiario, idioma)}`)] : []),
            t(idioma, '🧘 /casino pausa', '🧘 /casino pause'),
        ],
        textos: { facil: t(idioma, 'FÁCIL', 'EASY') },
    });
    const e = new EmbedBuilder().setColor('#f59e0b').setTitle(t(idioma, '🎰 Guía del casino', '🎰 Casino guide'))
        .setDescription([
            t(idioma, 'Elige un juego en el menú: verás **cómo se juega**, **lo que paga** y un botón para **probarlo**.', 'Pick a game in the menu: you’ll see **how it works**, **what it pays** and a button to **try it**.'),
            t(idioma, '¿Nuevo? Empieza por los marcados como **FÁCIL** ⭐.', 'New? Start with the ones marked **EASY** ⭐.'),
            c.canalId ? t(idioma, `📍 Se juega en <#${c.canalId}>.`, `📍 Played in <#${c.canalId}>.`) : '',
            c.activo ? '' : t(idioma, '🔒 El casino está cerrado ahora mismo en este servidor.', '🔒 The casino is closed on this server right now.'),
        ].filter(Boolean).join('\n'));
    if (png) e.setImage('attachment://guia-casino.png');
    else e.addFields({ name: t(idioma, '🎲 Los juegos', '🎲 The games'), value: juegos.filter((x) => !x.apagado).map((x) => `${x.emoji} ${x.nombre}`).join(' · ').slice(0, 1024) });
    const botones = [];
    if (c.activo) {
        if (enCanal(cfg, canalId)) botones.push(new ButtonBuilder().setCustomId('cas_lb:diaria').setEmoji('🎁').setStyle(ButtonStyle.Success).setLabel(t(idioma, 'Tirada gratis', 'Free spin')));
        else { const l = enlaceCanal(cfg, guildId, idioma); if (l) botones.push(l); }
        botones.push(new ButtonBuilder().setCustomId('cas_lb:mio').setEmoji('💰').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mi oro', 'My gold')));
    }
    const filas = [menuJuegos(idioma, cfg)];
    if (botones.length) filas.push(new ActionRowBuilder().addComponents(botones));
    return { embeds: [e], components: filas, files: png ? [new AttachmentBuilder(png, { name: 'guia-casino.png' })] : [], attachments: [] };
}

// Ficha de un juego. ctx = { canalId, guildId }.
async function guiaJuego(juego, idioma, cfg, { canalId = null, guildId = null } = {}) {
    const c = cfg?.casino || {};
    const V = require('./arteVistas.js');
    const volver = new ButtonBuilder().setCustomId('cas_guiav').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Todos los juegos', 'All games'));
    if (juego === 'cofres') {
        const icono = V.iconoJuego('🎁', '#a855f7');
        const e = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, '🎁 Cofres de mascotas', '🎁 Pet chests'))
            .setDescription(t(idioma,
                `Abres un cofre y sale un **compañero** al azar. El que llevas equipado te da ventajas: más XP, más oro en \`/diario\` y vuelta en el casino. Los repetidos suben estrellas ★. Hay una **DIVINA** rarísima.`,
                `Open a chest and get a random **companion**. The one you wear gives you perks: more XP, more gold on \`/daily\` and casino cashback. Duplicates add stars ★. There’s an ultra-rare **DIVINE** one.`))
            .addFields(
                { name: t(idioma, '💰 Precios', '💰 Prices'), value: `📦 ${fmt(K.COFRES.basico.precio, idioma)} · 💜 ${fmt(K.COFRES.epico.precio, idioma)} · 👑 ${fmt(K.COFRES.legendario.precio, idioma)}`, inline: true },
                { name: t(idioma, '✍️ Escríbelo así', '✍️ Type it like this'), value: t(idioma, '`/jugar cofre abrir` · `/jugar cofre coleccion`', '`/games chest open` · `/games chest collection`'), inline: true },
            );
        if (icono) e.setThumbnail('attachment://icono.png');
        const fila = new ActionRowBuilder().addComponents(
            ...(c.activo && c.cofres !== false ? [new ButtonBuilder().setCustomId('cof_otro:basico').setEmoji('📦').setStyle(ButtonStyle.Success).setLabel(t(idioma, `Abrir uno (🪙 ${fmt(K.COFRES.basico.precio, idioma)})`, `Open one (🪙 ${fmt(K.COFRES.basico.precio, idioma)})`))] : []),
            volver);
        return { embeds: [e], components: [fila, menuJuegos(idioma, cfg, 'cofres')], files: icono ? [new AttachmentBuilder(icono, { name: 'icono.png' })] : [], attachments: [] };
    }
    const g = GUIA[juego];
    if (!g) return guiaGeneral(idioma, cfg, { canalId, guildId });
    const off = apagado(juego, cfg);
    const color = g.grupo ? '#8b5cf6' : g.facil ? '#16a34a' : '#f59e0b';
    const icono = V.iconoJuego(g.emoji, color);
    const etiquetas = [g.grupo ? t(idioma, '👥 Con más gente', '👥 With others') : t(idioma, '👤 Solo para ti', '👤 Just for you'), g.facil ? t(idioma, '⭐ Fácil para empezar', '⭐ Easy to start') : '', off ? t(idioma, '🚫 Desactivado en este servidor', '🚫 Turned off on this server') : ''].filter(Boolean).join('  ·  ');
    const e = new EmbedBuilder().setColor(off ? '#475569' : color).setTitle(`${g.emoji} ${nombreDe(juego, idioma)}`)
        .setDescription(`-# ${etiquetas}\n${t(idioma, g.como[0], g.como[1])}`)
        .addFields(
            { name: t(idioma, '💰 Lo que paga', '💰 Payouts'), value: t(idioma, ...g.paga()).slice(0, 1024) },
            { name: t(idioma, '✍️ Escríbelo así', '✍️ Type it like this'), value: `\`${t(idioma, g.ej[0], g.ej[1]).split('   ')[0]}\``.slice(0, 1024) },
        );
    if (icono) e.setThumbnail('attachment://icono.png');
    // Botones que de verdad funcionan aquí: jugar solo en el canal del casino (si no, ir allí).
    const botones = [];
    if (c.activo && !off && juego === 'loteria') {
        // Los boletos se compran desde cualquier canal (la respuesta es privada).
        botones.push(new ButtonBuilder().setCustomId('cas_lot:1').setEmoji('🎫').setStyle(ButtonStyle.Success).setLabel(t(idioma, `Comprar 1 boleto (🪙 ${fmt(C.PRECIO_BOLETO, idioma)})`, `Buy 1 ticket (🪙 ${fmt(C.PRECIO_BOLETO, idioma)})`)));
    } else if (c.activo && !off) {
        if (enCanal(cfg, canalId)) {
            const min = c.apuestaMin ?? 10;
            if (g.probar !== null && g.probar !== undefined) botones.push(new ButtonBuilder().setCustomId(`cas_rep:${juego}:${min}${g.probar ? `:${g.probar}` : ''}`).setStyle(ButtonStyle.Success).setEmoji('▶️').setLabel(t(idioma, `Probar con 🪙 ${fmt(min, idioma)}`, `Try it with 🪙 ${fmt(min, idioma)}`)));
            else if (g.abrir) botones.push(new ButtonBuilder().setCustomId(`cas_lb:${g.abrir}`).setStyle(ButtonStyle.Success).setEmoji(g.emoji).setLabel(t(idioma, 'Abrir ahora', 'Start now')));
        } else { const l = enlaceCanal(cfg, guildId, idioma); if (l) botones.push(l); }
    }
    botones.push(volver);
    return { embeds: [e], components: [new ActionRowBuilder().addComponents(botones), menuJuegos(idioma, cfg, juego)], files: icono ? [new AttachmentBuilder(icono, { name: 'icono.png' })] : [], attachments: [] };
}

// Responde a la guía (menú y «Todos los juegos»). En un mensaje solo para ti, lo cambia; en la guía
// pública fija del canal, te contesta a ti en privado (si no, cambiaría el mensaje para todos).
async function manejarGuia(interaction, payload) {
    const privado = interaction.message?.flags?.has?.(64) ?? false;
    if (privado) return interaction.update(payload);
    return interaction.reply({ ...payload, flags: 64 });
}

module.exports = { GUIA, guiaGeneral, guiaJuego, manejarGuia, menuJuegos };
