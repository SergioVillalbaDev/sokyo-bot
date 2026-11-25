// /empezar (1.29.0): la guía para quien NO tiene ni idea. Explica con palabras sencillas el oro,
// las mascotas, la granja, las cartas, el casino y el pase, y sobre todo dice «¿Qué hago ahora?»:
// mira cómo va la persona y le da UN paso concreto con su botón. Botones emp:<qué>.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const G = require('./granjaNucleo.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.floor(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const HORA = 3600000;

// El siguiente paso, en orden de importancia. Pura: recibe el usuario (oro, diario), la colección y la config.
function siguientePaso({ usuario = {}, col = null, cfg = null, ahora = Date.now() } = {}) {
    const horasDiario = require('./economia.js').HORAS_DAILY || 20;
    const diarioListo = !usuario.ultimoDaily || (ahora - new Date(usuario.ultimoDaily).getTime()) / HORA >= horasDiario;
    const oro = usuario.balance || 0;
    const mascotas = col?.mascotas || [];
    const cofres = cfg?.casino?.activo && cfg?.casino?.cofres !== false;
    const cartas = !!cfg?.compis?.anime;
    const tickets = Object.entries(col?.tickets || {}).filter(([, v]) => v > 0);
    if (diarioListo) return { id: 'diario' };
    if (!mascotas.length) return cofres ? (oro >= K.COFRES.basico.precio ? { id: 'primerCofre' } : { id: 'ahorrar', falta: K.COFRES.basico.precio - oro }) : { id: 'sinCofres' };
    if (tickets.length) return { id: 'tickets', clave: tickets[0][0] };
    const a = G.acumulado(col, ahora);
    if (a.nueva) return { id: 'granjaEmpezar' };
    if (a.lleno || a.oro >= Math.max(30, a.porHora * 4)) return { id: 'granjaRecoger', oro: a.oro };
    const eq = mascotas.find((m) => m.id === col.equipada) || mascotas[0];
    if (P.expedicionLista(eq, ahora)) return { id: 'volvio', m: eq.id };
    const e = P.estado(eq, ahora);
    if (!P.expedicionActiva(eq, ahora) && Math.min(e.hambre, e.alegria) < 50) return { id: 'cuidar', m: eq.id };
    const dia = P.diaDe(ahora);
    if (!col.misiones || col.misiones.dia !== dia || !col.misiones.todas) return { id: 'misiones', m: eq.id };
    if (cartas && !(col.cartas || []).length) return oro >= 300 ? { id: 'primerSobre' } : { id: 'pase' };
    if (!P.expedicionActiva(eq, ahora) && (col.expHoy?.dia !== dia || (col.expHoy.n || 0) < P.EXPEDICIONES_DIA) && e.energia >= 20) return { id: 'expedicion', m: eq.id };
    return { id: 'pase' };
}

const TEMAS = ['oro', 'mascotas', 'granja', 'cartas', 'combate', 'casino', 'pase', 'rutina'];
const TEMA = {
    oro: { emoji: '🪙', es: 'El oro: qué es y cómo conseguirlo', en: 'Gold: what it is and how to get it' },
    mascotas: { emoji: '🐾', es: 'Mascotas: conseguirlas y cuidarlas', en: 'Pets: getting and caring for them' },
    granja: { emoji: '🧺', es: 'La granja: oro mientras no estás', en: 'The farm: gold while you’re away' },
    cartas: { emoji: '🃏', es: 'Cartas de anime: sobres y poderes', en: 'Anime cards: packs and powers' },
    combate: { emoji: '⚔️', es: 'Combates: retos, torre y jefe', en: 'Battles: challenges, tower and boss' },
    casino: { emoji: '🎰', es: 'El casino: cómo se juega', en: 'The casino: how to play' },
    pase: { emoji: '🎟️', es: 'Pase, logros y misiones', en: 'Pass, achievements and missions' },
    rutina: { emoji: '⏱️', es: 'Tu rutina de 5 minutos al día', en: 'Your 5-minute daily routine' },
};

// Texto de cada tema: muy sencillo, en pasos.
function textoTema(tema, idioma, cfg) {
    const c = cfg?.casino || {};
    const canal = c.canalId ? `<#${c.canalId}>` : t(idioma, 'el canal del casino', 'the casino channel');
    const ES = {
        oro: [
            '🪙 **El oro es la moneda de este servidor.** Es gratis y no se compra con dinero: se gana jugando. Cada servidor tiene el suyo.',
            '',
            '**Cómo conseguirlo:**',
            '1️⃣ `/diario` cada día → oro gratis (y más si no fallas ningún día: racha).',
            '2️⃣ La **granja**: tus mascotas producen oro solas (`/granja`).',
            '3️⃣ Las **expediciones** de tus mascotas traen oro (`/compi` → 🧭).',
            '4️⃣ **Misiones** del día y de la semana, **logros** y el **pase** (`/pase`).',
            '5️⃣ El casino, si te sale bien (¡y si no, también se pierde!).',
            '',
            '**¿En qué se gasta?** Cofres de mascotas, sobres de cartas, bromas, la Liga… Mira cuánto tienes con `/inventario` o con el botón 🪙 del casino.',
        ],
        mascotas: [
            '🐾 **Cada persona tiene sus propias mascotas en este servidor.** En cada servidor se empieza de cero: aquí compites con la gente de aquí.',
            '',
            '1️⃣ **Consíguelas en cofres:** `/cofre abrir`. Sale una al azar: común, rara, épica, legendaria, mítica… y una **divina** rarísima.',
            '2️⃣ **Míralas y cuídalas:** `/compi`. Botones: 🍖 comer, 🎾 jugar, 🤗 mimar, 💬 hablar. Si las cuidas, suben de nivel.',
            '3️⃣ **Equipa tu favorita** (botón ✅): te da ventajas (más XP, más oro en /diario…). Cada una tiene una **habilidad exclusiva**.',
            '4️⃣ **Mándalas de expedición** (menú 🧭): vuelven con oro y recuerdos.',
            '5️⃣ **Repetidas = estrellas** ★: la misma mascota otra vez sube de estrellas y es más fuerte.',
            '6️⃣ **Guardería** (`/guarderia`): dos de nivel 10 tienen un huevo; a veces sale una más rara o brillante.',
            '7️⃣ **Casa** (`/casa`): compra muebles y decórala; cuanto más cómoda, más produce tu granja.',
            '8️⃣ **Expedición en grupo** (`/expedicion`): todo el canal manda a sus mascotas juntas; cuantos más, más oro.',
            '',
            '💡 Si no las cuidas no les pasa nada malo, pero producen menos en la granja.',
        ],
        granja: [
            '🧺 **Tus mejores mascotas trabajan solas en tu granja** y producen oro aunque no estés.',
            '',
            '1️⃣ Abre `/granja` y pulsa **Empezar** (solo la primera vez).',
            '2️⃣ Vuelve cuando quieras y pulsa **Recoger**. Guarda hasta **12 horas**: pásate un par de veces al día.',
            '3️⃣ Producen más si son más raras, con más ★, más nivel y **bien cuidadas**.',
            '4️⃣ El **📖 Álbum**: cuantas más mascotas distintas tengas, más premios y más huecos en la granja.',
        ],
        cartas: cfg?.compis?.anime ? [
            '🃏 **Las cartas son personajes de anime que potencian a tu mascota.**',
            '',
            '1️⃣ **Abre sobres:** `/carta abrir` (3 cartas por sobre).',
            '2️⃣ **Úsalas:** en `/compi` pulsa **🃏 Cartas** y elige una. Cada carta tiene su poder (oro, energía, más ventajas…). Hasta 3 al día.',
            '3️⃣ **Completa series** (todas las cartas de un anime): ganas oro y esas cartas son más fuertes para siempre.',
            '4️⃣ Mira tu colección con `/carta album` y regala repetidas con `/carta regalar`.',
        ] : ['🃏 Las cartas de anime no están activadas en este servidor. Un admin puede encenderlas en el panel (Mascotas y cartas).'],
        casino: c.activo ? [
            `🎰 **El casino se juega con oro en ${canal}.** Allí hay un mensaje con un **desplegable**: elige el juego y te abre una mesa solo para ti.`,
            '',
            '**Lo más fácil para empezar:**',
            '🎁 **Tirada gratis** cada día (botón del lobby) → no gastas nada.',
            '🪙 **Cara o cruz**: apuestas, eliges cara o cruz y doblas o pierdes.',
            '🎰 **Tragaperras**: 3 iguales y ganas; el **bote** crece con cada tirada.',
            '🔼 **Mayor o menor**: ¿la siguiente carta será mayor o menor? Retírate a tiempo.',
            '',
            'Más juegos: ruleta, blackjack, crash, minas, rasca y gana, dados, baccarat, plinko, duelos y carreras. Con más gente: **póker**, **bingo**, el **cohete** y la ruleta en mesa. Cada mesa te explica arriba **🎮 cómo se juega** y eliges cuánto apostar con las fichas.',
            '',
            '⚠️ **Apuesta poco.** El casino a la larga se queda un poco de lo que apuestas. Hay un límite de pérdidas al día y puedes ponerte una **pausa** desde el lobby.',
        ] : ['🎰 El casino no está activado en este servidor. Un admin puede encenderlo en el panel (Diversión → Casino).'],
        pase: [
            '🎟️ **El pase es gratis y dura un mes.** Casi todo lo que haces da XP: cuidar, expediciones, granja, cartas, cofres, misiones…',
            '',
            '1️⃣ Cada nivel da **oro**. Cada 5 niveles, un **sobre gratis**; cada 10, un **cofre épico gratis**. El 50 da lo mejor.',
            '2️⃣ Los tickets gratis se abren desde `/pase` con un botón.',
            '3️⃣ **Logros** (`/pase ver:Logros`): metas grandes con premio, como completar 10 series o sacar la divina.',
            '4️⃣ **Misiones del día** (en `/compi`) y **de la semana** (en `/granja`).',
        ],
        combate: [
            '⚔️ **Tu mascota equipada es tu luchadora.** Cuanto mejor la cuidas (nivel de afinidad, estrellas, que esté feliz), más fuerte pelea.',
            '',
            '1️⃣ `/combate retar @alguien` → combate por turnos: ⚔️ atacar, 🛡️ defender, ✨ especial de su elemento o 🃏 una carta.',
            '2️⃣ `/combate mazo` → elige 3 cartas de anime: cada una es una técnica (curar, congelar, quemar…).',
            '3️⃣ `/combate torre` → 50 pisos al mes, con premios y tickets gratis.',
            '4️⃣ `/combate jefe` → todo el servidor contra un jefe cada semana (3 ataques al día).',
            '5️⃣ `/combate perfil` → tu rango (de Bronce a Maestro) y `/perfil` tu tarjeta de jugador.',
            '6️⃣ ¿Estás en un clan? `/clan guerra`: cada combate que ganes a alguien del clan rival suma **+300** para la guerra de la semana.',
            '',
            '💡 Elementos: 🔥 gana a 🌿, 🌿 a 💧, 💧 a 🔥… `/combate ayuda` lo explica todo.',
        ],
        rutina: [
            '⏱️ **Si solo tienes 5 minutos al día:**',
            '',
            '1️⃣ `/diario` → oro gratis (y un regalo a los 3, 7, 14 y 30 días seguidos).',
            '2️⃣ `/granja` → **Recoger**.',
            '3️⃣ `/compi` → 🍖 🎾 🤗 a tu mascota, un minijuego 🎮 y mándala de **expedición** 🧭.',
            '4️⃣ Tus 3 ataques al **jefe de la semana** (`/combate jefe`) y un piso de la **torre**.',
            '5️⃣ La **tirada gratis** del casino.',
            '6️⃣ Mira `/pase` por si tienes tickets gratis.',
            '',
            '🔁 Repite mañana: la **racha** te da más premios cada día seguido.',
        ],
    };
    const EN = {
        oro: [
            '🪙 **Gold is this server’s currency.** It’s free and can’t be bought with money: you earn it by playing. Each server has its own.',
            '',
            '**How to get it:**',
            '1️⃣ `/daily` every day → free gold (more if you don’t miss a day: streak).',
            '2️⃣ The **farm**: your pets make gold on their own (`/farm`).',
            '3️⃣ Your pets’ **expeditions** bring gold (`/companion` → 🧭).',
            '4️⃣ Daily and weekly **missions**, **achievements** and the **pass** (`/pass`).',
            '5️⃣ The casino, if it goes well (and if not, you lose some!).',
            '',
            '**What’s it for?** Pet chests, card packs, pranks, the League… See how much you have with `/inventory` or the 🪙 button in the casino.',
        ],
        mascotas: [
            '🐾 **Everyone has their own pets on this server.** Every server starts from zero: here you compete with the people here.',
            '',
            '1️⃣ **Get them from chests:** `/chest open`. A random one drops: common, rare, epic, legendary, mythic… and an ultra-rare **divine**.',
            '2️⃣ **See and care for them:** `/companion`. Buttons: 🍖 feed, 🎾 play, 🤗 cuddle, 💬 talk. Care makes them level up.',
            '3️⃣ **Equip your favourite** (✅ button): it gives you perks (more XP, more /daily gold…). Each has an **exclusive ability**.',
            '4️⃣ **Send them on expeditions** (🧭 menu): they come back with gold and souvenirs.',
            '5️⃣ **Duplicates = stars** ★: the same pet again gains stars and gets stronger.',
            '6️⃣ **Nursery** (`/nursery`): two level-10 pets have an egg; sometimes a rarer or shiny one hatches.',
            '7️⃣ **House** (`/house`): buy furniture and decorate it; the comfier it is, the more your farm makes.',
            '8️⃣ **Group expedition** (`/expedition`): the whole channel sends their pets together; the more, the more gold.',
            '',
            '💡 Nothing bad happens if you don’t care for them, but they make less on the farm.',
        ],
        granja: [
            '🧺 **Your best pets work on their own on your farm** and make gold even when you’re away.',
            '',
            '1️⃣ Open `/farm` and press **Start** (first time only).',
            '2️⃣ Come back whenever and press **Collect**. It holds up to **12 hours**: drop by a couple of times a day.',
            '3️⃣ They make more if rarer, with more ★, higher level and **well cared for**.',
            '4️⃣ The **📖 Album**: the more different pets you have, the more rewards and farm slots.',
        ],
        cartas: cfg?.compis?.anime ? [
            '🃏 **Cards are anime characters that power up your pet.**',
            '',
            '1️⃣ **Open packs:** `/card open` (3 cards per pack).',
            '2️⃣ **Use them:** in `/companion` press **🃏 Cards** and pick one. Each card has its power (gold, energy, more perks…). Up to 3 a day.',
            '3️⃣ **Complete series** (every card of an anime): you get gold and those cards get stronger forever.',
            '4️⃣ See your collection with `/card album` and gift duplicates with `/card gift`.',
        ] : ['🃏 Anime cards aren’t turned on on this server. An admin can turn them on in the panel (Pets and cards).'],
        casino: c.activo ? [
            `🎰 **The casino is played with gold in ${canal}.** There’s a message with a **dropdown**: pick a game and it opens a table just for you.`,
            '',
            '**Easiest to start:**',
            '🎁 **Free spin** every day (lobby button) → costs nothing.',
            '🪙 **Coin flip**: bet, pick heads or tails and double or lose.',
            '🎰 **Slots**: 3 matching wins; the **jackpot** grows with every spin.',
            '🔼 **Higher or lower**: will the next card be higher or lower? Cash out in time.',
            '',
            'More games: roulette, blackjack, crash, mines, scratch cards, dice, baccarat, plinko, duels and races. With more people: **poker**, **bingo**, the **rocket** and table roulette. Each table explains **🎮 how to play** at the top and you pick your bet with the chips.',
            '',
            '⚠️ **Bet small.** In the long run the casino keeps a bit of what you bet. There’s a daily loss limit and you can take a **break** from the lobby.',
        ] : ['🎰 The casino isn’t turned on on this server. An admin can turn it on in the panel (Fun → Casino).'],
        pase: [
            '🎟️ **The pass is free and lasts a month.** Almost everything you do gives XP: care, expeditions, farm, cards, chests, missions…',
            '',
            '1️⃣ Each level gives **gold**. Every 5 levels, a **free pack**; every 10, a **free epic chest**. Level 50 gives the best.',
            '2️⃣ Free tickets are opened from `/pass` with a button.',
            '3️⃣ **Achievements** (`/pass view:Achievements`): big goals with rewards, like completing 10 series or pulling the divine.',
            '4️⃣ **Daily missions** (in `/companion`) and **weekly ones** (in `/farm`).',
        ],
        combate: [
            '⚔️ **Your equipped pet is your fighter.** The better you care for it (affinity level, stars, keeping it happy), the stronger it fights.',
            '',
            '1️⃣ `/fight challenge @someone` → turn-based battle: ⚔️ attack, 🛡️ defend, ✨ its element’s special or 🃏 a card.',
            '2️⃣ `/fight deck` → pick 3 anime cards: each one is a technique (heal, freeze, burn…).',
            '3️⃣ `/fight tower` → 50 floors a month, with rewards and free tickets.',
            '4️⃣ `/fight boss` → the whole server against a boss every week (3 attacks a day).',
            '5️⃣ `/fight profile` → your rank (Bronze to Master) and `/profile` your player card.',
            '6️⃣ In a clan? `/clan war`: every fight you win against someone from the rival clan adds **+300** to this week’s war.',
            '',
            '💡 Elements: 🔥 beats 🌿, 🌿 beats 💧, 💧 beats 🔥… `/fight help` explains everything.',
        ],
        rutina: [
            '⏱️ **If you only have 5 minutes a day:**',
            '',
            '1️⃣ `/daily` → free gold (and a gift at 3, 7, 14 and 30 days in a row).',
            '2️⃣ `/farm` → **Collect**.',
            '3️⃣ `/companion` → 🍖 🎾 🤗 your pet, a minigame 🎮 and send it on an **expedition** 🧭.',
            '4️⃣ Your 3 attacks on the **weekly boss** (`/fight boss`) and a **tower** floor.',
            '5️⃣ The casino’s **free spin**.',
            '6️⃣ Check `/pass` for free tickets.',
            '',
            '🔁 Repeat tomorrow: the **streak** gives you more each day in a row.',
        ],
    };
    return (t(idioma, 'es', 'en') === 'es' ? ES : EN)[tema].join('\n');
}

// Texto y botón del siguiente paso.
function pasoUI(paso, userId, idioma) {
    const b = (id, emoji, es, en, estilo = ButtonStyle.Success) => new ButtonBuilder().setCustomId(id).setEmoji(emoji).setStyle(estilo).setLabel(t(idioma, es, en));
    switch (paso.id) {
    case 'diario': return { texto: t(idioma, '🪙 **Reclama tu oro gratis de hoy.** Es lo primero cada día.', '🪙 **Claim today’s free gold.** It’s the first thing every day.'), boton: b(`emp:diario:${userId}`, '🪙', 'Reclamar oro gratis', 'Claim free gold') };
    case 'primerCofre': return { texto: t(idioma, `🎁 **Consigue tu primera mascota.** Un cofre básico cuesta 🪙 ${fmt(K.COFRES.basico.precio, idioma)} y ya los tienes.`, `🎁 **Get your first pet.** A basic chest costs 🪙 ${fmt(K.COFRES.basico.precio, idioma)} and you have it.`), boton: b('cof_otro:basico', '📦', 'Abrir mi primer cofre', 'Open my first chest') };
    case 'ahorrar': return { texto: t(idioma, `🪙 **Te faltan 🪙 ${fmt(paso.falta, idioma)} para tu primer cofre de mascota.** Vuelve mañana a por el /diario, prueba la tirada gratis del casino o habla en el servidor.`, `🪙 **You need 🪙 ${fmt(paso.falta, idioma)} more for your first pet chest.** Come back tomorrow for /daily, try the casino’s free spin or chat on the server.`), boton: b(`emp:tema:casino:${userId}`, '🎰', 'Ver la tirada gratis', 'See the free spin', ButtonStyle.Primary) };
    case 'sinCofres': return { texto: t(idioma, '🐾 Aquí los cofres de mascotas están apagados. Pide a un admin que active el casino y los cofres en el panel.', '🐾 Pet chests are off here. Ask an admin to turn on the casino and chests in the panel.'), boton: null };
    case 'tickets': return { texto: t(idioma, '🎫 **¡Tienes tickets gratis del pase!** Ábrelos: no cuestan nada.', '🎫 **You have free pass tickets!** Open them: they cost nothing.'), boton: b(`pse:abrir:${userId}`, '🎟️', 'Ver mis tickets', 'See my tickets') };
    case 'granjaEmpezar': return { texto: t(idioma, '🧺 **Pon en marcha tu granja.** Tus mascotas empezarán a producir oro solas.', '🧺 **Start your farm.** Your pets will start making gold on their own.'), boton: b(`grj:abrir:${userId}`, '🧺', 'Abrir mi granja', 'Open my farm') };
    case 'granjaRecoger': return { texto: t(idioma, `🧺 **Tu granja tiene 🪙 ${fmt(paso.oro, idioma)} esperando.** Recógelos.`, `🧺 **Your farm has 🪙 ${fmt(paso.oro, idioma)} waiting.** Collect it.`), boton: b(`grj:abrir:${userId}`, '🧺', 'Ir a recoger', 'Go collect') };
    case 'volvio': return { texto: t(idioma, '🧭 **Tu mascota ha vuelto de la expedición** con oro. Ve a verla para recogerlo.', '🧭 **Your pet is back from its expedition** with gold. Go see it to collect.'), boton: b(`cmp:ver:${userId}:${paso.m}`, '🐾', 'Ver a mi mascota', 'See my pet') };
    case 'cuidar': return { texto: t(idioma, '🍖 **Tu mascota tiene hambre o está triste.** Dale de comer y juega con ella: producirá más.', '🍖 **Your pet is hungry or sad.** Feed it and play with it: it’ll produce more.'), boton: b(`cmp:ver:${userId}:${paso.m}`, '🐾', 'Cuidar a mi mascota', 'Care for my pet') };
    case 'misiones': return { texto: t(idioma, '📋 **Haz las misiones de hoy** en `/compi`: son fáciles y dan oro y XP del pase.', '📋 **Do today’s missions** in `/companion`: they’re easy and give gold and pass XP.'), boton: b(`cmp:ver:${userId}:${paso.m}`, '📋', 'Ver mis misiones', 'See my missions') };
    case 'primerSobre': return { texto: t(idioma, '🃏 **Abre tu primer sobre de cartas.** Las cartas potencian a tu mascota.', '🃏 **Open your first card pack.** Cards power up your pet.'), boton: b('crt_otro:normal', '🃏', 'Abrir un sobre', 'Open a pack') };
    case 'expedicion': return { texto: t(idioma, '🧭 **Manda a tu mascota de expedición:** vuelve con oro y quizá un recuerdo.', '🧭 **Send your pet on an expedition:** it comes back with gold and maybe a souvenir.'), boton: b(`cmp:ver:${userId}:${paso.m}`, '🧭', 'Mandarla', 'Send it') };
    default: return { texto: t(idioma, '🎟️ **¡Vas genial!** Mira tu pase: qué te falta para el siguiente premio y tus logros.', '🎟️ **You’re doing great!** Check your pass: what’s left for the next reward and your achievements.'), boton: b(`pse:abrir:${userId}`, '🎟️', 'Ver mi pase', 'See my pass') };
    }
}

function menuTemas(userId, idioma, actual = null) {
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`emp:menu:${userId}`)
        .setPlaceholder(t(idioma, '📚 ¿Qué quieres aprender?', '📚 What do you want to learn?'))
        .addOptions(TEMAS.map((k) => ({ value: k, emoji: TEMA[k].emoji, label: t(idioma, TEMA[k].es, TEMA[k].en), default: k === actual }))));
}

async function vistaInicio(guildId, userId, idioma, cfg, mensajes = []) {
    const usuario = await require('./economia.js').en(guildId).obtenerUsuario(userId);
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    const paso = siguientePaso({ usuario, col, cfg });
    const ui = pasoUI(paso, userId, idioma);
    const e = new EmbedBuilder().setColor('#22c55e').setTitle(t(idioma, '👋 Empieza aquí', '👋 Start here'))
        .setDescription([
            ...mensajes,
            t(idioma, 'Aquí puedes **coleccionar mascotas**, **cuidarlas**, juntar **cartas de anime**, ganar **oro** y jugar al **casino**. Todo es gratis.', 'Here you can **collect pets**, **care for them**, gather **anime cards**, earn **gold** and play the **casino**. It’s all free.'),
            '',
            t(idioma, '**👉 Lo siguiente que te toca:**', '**👉 Your next step:**'),
            ui.texto,
            '',
            t(idioma, `Tienes **🪙 ${fmt(usuario.balance, idioma)}** · ${(col?.mascotas || []).length} mascotas · ${(col?.cartas || []).length} cartas`, `You have **🪙 ${fmt(usuario.balance, idioma)}** · ${(col?.mascotas || []).length} pets · ${(col?.cartas || []).length} cards`),
            t(idioma, '¿Dudas? Elige un tema abajo: te lo explico paso a paso.', 'Questions? Pick a topic below: I’ll explain it step by step.'),
        ].join('\n'));
    const fila = new ActionRowBuilder().addComponents(
        ...(ui.boton ? [ui.boton] : []),
        new ButtonBuilder().setCustomId(`emp:ver:${userId}`).setEmoji('🔄').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, '¿Y después?', 'And then?')),
        new ButtonBuilder().setCustomId(`emp:tema:rutina:${userId}`).setEmoji('⏱️').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Rutina de 5 min', '5-min routine')),
    );
    return { content: null, embeds: [e], components: [fila, menuTemas(userId, idioma)], allowedMentions: { parse: [] } };
}

function vistaTema(tema, userId, idioma, cfg) {
    const d = TEMA[tema];
    const e = new EmbedBuilder().setColor('#3b82f6').setTitle(`${d.emoji} ${t(idioma, d.es, d.en)}`).setDescription(textoTema(tema, idioma, cfg).slice(0, 4000));
    const b = (id, emoji, es, en) => new ButtonBuilder().setCustomId(id).setEmoji(emoji).setStyle(ButtonStyle.Success).setLabel(t(idioma, es, en));
    const acciones = {
        oro: [b(`emp:diario:${userId}`, '🪙', 'Reclamar oro gratis', 'Claim free gold')],
        mascotas: [b('cof_otro:basico', '📦', `Abrir cofre (🪙 ${K.COFRES.basico.precio})`, `Open chest (🪙 ${K.COFRES.basico.precio})`)],
        granja: [b(`grj:abrir:${userId}`, '🧺', 'Mi granja', 'My farm')],
        cartas: cfg?.compis?.anime ? [b('crt_otro:normal', '🃏', 'Abrir un sobre (🪙 300)', 'Open a pack (🪙 300)')] : [],
        casino: cfg?.casino?.activo ? [b('cas_lb:guia', '❓', 'Guía de todos los juegos', 'Guide to every game')] : [],
        pase: [b(`pse:abrir:${userId}`, '🎟️', 'Mi pase', 'My pass')],
        rutina: [b(`emp:diario:${userId}`, '🪙', 'Empezar: oro gratis', 'Start: free gold')],
    }[tema] || [];
    const fila = new ActionRowBuilder().addComponents(...acciones,
        new ButtonBuilder().setCustomId(`emp:ver:${userId}`).setEmoji('👉').setStyle(ButtonStyle.Primary).setLabel(t(idioma, '¿Qué hago ahora?', 'What do I do now?')));
    return { content: null, embeds: [e], components: [fila, menuTemas(userId, idioma, tema)], allowedMentions: { parse: [] } };
}

async function manejar(interaction) {
    const p = (interaction.customId || '').split(':');
    const que = p[1];
    const owner = que === 'tema' ? p[3] : p[2];
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const userId = interaction.user.id;
    const ajeno = !owner || owner !== userId;
    const responder = async (payload) => (ajeno ? interaction.reply({ ...payload, flags: 64 }) : interaction.update(payload));
    if (que === 'diario') {
        const r = await require('./economia.js').en(interaction.guildId).reclamarDaily(userId);
        const msj = r.ok
            ? t(idioma, `✅ **+🪙 ${fmt(r.total, idioma)}** de oro gratis (racha de ${r.racha} día${r.racha === 1 ? '' : 's'}).`, `✅ **+🪙 ${fmt(r.total, idioma)}** free gold (${r.racha}-day streak).`)
            : t(idioma, `⏳ Ya lo cogiste: vuelve en ${Math.ceil(r.esperaHoras)} h.`, `⏳ Already claimed: come back in ${Math.ceil(r.esperaHoras)} h.`);
        await responder(await vistaInicio(interaction.guildId, userId, idioma, cfg, [msj, '']));
        return true;
    }
    if (que === 'menu') { await responder(vistaTema(interaction.values[0], userId, idioma, cfg)); return true; }
    if (que === 'tema' && TEMA[p[2]]) { await responder(vistaTema(p[2], userId, idioma, cfg)); return true; }
    await responder(await vistaInicio(interaction.guildId, userId, idioma, cfg));
    return true;
}

module.exports = { siguientePaso, pasoUI, textoTema, TEMAS, vistaInicio, vistaTema, manejar };
