// 🗂️ Catálogo de funciones (1.34.0): LA lista de todo lo que hace el bot, en un solo sitio.
// De aquí salen los comandos que ve cada servidor (utils/comandosServidor.js), las puertas (/jugar, /mascotas,
// /comunidad: utils/puertas.js), /menu, /ayuda, el botón ❔ de cada mensaje (utils/navegacion.js), la guía
// automática del canal «📖 Cómo funciona» (utils/guiaServidor.js), /configurar, la web /ayuda, el panel (cabecera
// de cada sección) y la Actividad. Si añades una función: apúntala aquí y todo lo demás la conoce.
//
// Cada módulo: id, emoji, nombre {es,en}, zona, activo(cfg), comandos (comandos sueltos, por su nombre en inglés),
// partes (subcomandos dentro de una puerta: [puerta, comando]), tab (sección del panel), campo (el ajuste que lo
// enciende/apaga), activar (cómo se enciende desde Discord: 'setup:<clave>' = el setup rápido, que deja canales y
// todo listo; 'campo' = basta con poner `campo` a true; sin `activar`, se configura en el panel), frase {es,en} (qué es,
// una línea) y pasos {es:[…], en:[…]} (cómo se usa, 2-4 líneas cortas, con los comandos de verdad).
const { t } = require('./i18n.js');

const ZONAS = {
    jugar: { emoji: '🎮', es: 'Jugar', en: 'Play', color: '#f59e0b', puerta: 'games' },
    mascotas: { emoji: '🐾', es: 'Mis mascotas', en: 'My pets', color: '#22c55e', puerta: 'pets' },
    comunidad: { emoji: '🏘️', es: 'Comunidad', en: 'Community', color: '#3b82f6', puerta: 'community' },
    musica: { emoji: '🎵', es: 'Música', en: 'Music', color: '#ec4899' },
    crecimiento: { emoji: '🚀', es: 'Crecimiento', en: 'Growth', color: '#8b5cf6' },
    staff: { emoji: '🛡️', es: 'Staff y moderación', en: 'Staff and moderation', color: '#64748b' },
    basico: { emoji: '✨', es: 'Lo básico', en: 'The basics', color: '#a855f7' },
};

const activoSi = (f) => (cfg) => { try { return !!f(cfg || {}); } catch { return false; } };
const conCofres = (c) => c.casino?.activo && c.casino?.cofres !== false;

const MODULOS = [
    // ---------------- 🎮 Jugar ----------------
    { id: 'casino', campo: 'casino.activo', emoji: '🎰', zona: 'jugar', es: 'Casino', en: 'Casino', tab: 'com-casino', activar: 'setup:casino',
        activo: activoSi((c) => c.casino?.activo), comandos: ['casino'],
        frase: { es: 'Juegos con oro: tragaperras, ruleta, blackjack, póker, bingo y más.', en: 'Games with gold: slots, roulette, blackjack, poker, bingo and more.' },
        pasos: { es: ['`/casino menu` abre el lobby: eliges un juego y la apuesta con fichas.', '🎁 Una **tirada gratis** al día (`/casino diaria`).', '⚠️ A la larga la casa se queda un poco: apuesta poco. `/casino pausa` si necesitas un descanso.'],
            en: ['`/casino menu` opens the lobby: pick a game and your bet with chips.', '🎁 A **free spin** every day (`/casino daily`).', '⚠️ In the long run the house keeps a little: bet small. `/casino pause` if you need a break.'] } },
    { id: 'cofres', campo: 'casino.cofres', emoji: '🎁', zona: 'jugar', es: 'Cofres de mascotas', en: 'Pet chests', tab: 'com-compis', activar: 'setup:casino',
        activo: activoSi(conCofres), partes: [['jugar', 'chest']],
        frase: { es: 'Abre cofres con oro y consigue mascotas, cada una con su habilidad.', en: 'Open chests with gold and get pets, each with its own ability.' },
        pasos: { es: ['`/jugar cofre abrir` → sale una mascota al azar (común… divina).', 'Una repetida sube de ★. A los 10 cofres sin épica, la siguiente es segura.', 'Mírala y cuídala en `/compi`.'],
            en: ['`/games chest open` → a random pet (common… divine).', 'A duplicate gains ★. After 10 chests without an epic, the next is guaranteed.', 'See and care for it in `/companion`.'] } },
    { id: 'cartas', campo: 'compis.anime', activar: 'campo', emoji: '🃏', zona: 'jugar', es: 'Cartas de anime', en: 'Anime cards', tab: 'com-compis',
        activo: activoSi((c) => c.compis?.anime), partes: [['jugar', 'card'], ['jugar', 'market']],
        frase: { es: 'Sobres de cartas que dan poderes a tu mascota y técnicas de combate.', en: 'Card packs that power up your pet and give battle techniques.' },
        pasos: { es: ['`/jugar carta abrir` → un sobre de 3 cartas.', 'Úsalas en tu mascota desde `/compi` (🃏 Cartas) o en tu mazo de combate.', 'Repetidas: desencántalas en polvo, intercámbialas o véndelas en `/jugar mercado`.'],
            en: ['`/games card open` → a pack of 3 cards.', 'Use them on your pet from `/companion` (🃏 Cards) or in your battle deck.', 'Duplicates: disenchant into dust, trade them or sell them in `/games market`.'] } },
    { id: 'combates', campo: 'combate.activo', activar: 'campo', necesita: 'cofres', emoji: '⚔️', zona: 'jugar', es: 'Combates', en: 'Battles', tab: 'com-casino',
        activo: activoSi((c) => conCofres(c) && c.combate?.activo !== false), partes: [['jugar', 'fight']],
        frase: { es: 'Combates por turnos con tu mascota: retos, torre y jefe semanal.', en: 'Turn-based battles with your pet: challenges, tower and weekly boss.' },
        pasos: { es: ['`/jugar combate retar` a alguien (con apuesta si quieres).', '`/jugar combate torre`: 50 pisos al mes · `/jugar combate jefe`: todo el servidor contra uno.', 'Cuanto mejor cuidas a tu mascota, más fuerte pelea.'],
            en: ['`/games fight challenge` someone (with a bet if you want).', '`/games fight tower`: 50 floors a month · `/games fight boss`: the whole server against one.', 'The better you care for your pet, the stronger it fights.'] } },
    { id: 'pase', emoji: '🎟️', zona: 'jugar', es: 'Pase y perfil', en: 'Pass and profile', tab: null,
        activo: activoSi(() => true), partes: [['jugar', 'pass'], ['jugar', 'profile']],
        frase: { es: 'Tu pase de temporada gratis, tus logros y tu tarjeta de jugador.', en: 'Your free season pass, your achievements and your player card.' },
        pasos: { es: ['Casi todo lo que haces da XP del pase: cada nivel da oro, sobres y cofres gratis.', '`/jugar pase` para verlo y abrir tus tickets gratis.', '`/jugar perfil` es tu tarjeta para presumir.'],
            en: ['Almost everything you do gives pass XP: each level gives gold, free packs and chests.', '`/games pass` to see it and open your free tickets.', '`/games profile` is your card to show off.'] } },
    { id: 'oro', emoji: '🪙', zona: 'jugar', es: 'Oro y tienda del servidor', en: 'Gold and server shop', tab: 'com-tienda',
        activo: activoSi(() => true), comandos: ['daily', 'shop', 'rich'],
        frase: { es: 'El oro de este servidor: se gana jugando y se gasta en cofres, cartas, la casa y la tienda del servidor.', en: 'This server’s gold: earned by playing, spent on chests, cards, the house and the server shop.' },
        pasos: { es: ['`/diario` cada día: oro gratis y más si no fallas ningún día (racha).', '`/votar` cada 12 h: más oro y un cofre gratis.', '`/tienda`: roles especiales que ponen los admins, comprados con tu oro.', 'El oro es virtual: no se compra ni se cambia por dinero, y nadie puede regalarlo.'],
            en: ['`/daily` every day: free gold, and more if you don’t miss a day (streak).', '`/vote` every 12 h: more gold and a free chest.', '`/shop`: special roles the admins put up, bought with your gold.', 'Gold is virtual: it can’t be bought or exchanged for money, and nobody can gift it.'] } },
    // ---------------- 🐾 Mis mascotas ----------------
    { id: 'mascotas', emoji: '🐾', zona: 'mascotas', es: 'Mis mascotas', en: 'My pets', tab: 'com-compis', activar: 'setup:casino',
        activo: activoSi(conCofres), comandos: ['companion'],
        partes: [['mascotas', 'companion'], ['mascotas', 'farm'], ['mascotas', 'house'], ['mascotas', 'nursery'], ['mascotas', 'expedition']],
        frase: { es: 'Tus mascotas: cuídalas, mándalas de expedición, su granja, su casa y su guardería.', en: 'Your pets: care for them, send them on expeditions, their farm, house and nursery.' },
        pasos: { es: ['`/compi`: dale de comer, juega y mímala. Si la cuidas, sube de nivel.', '`/mascotas granja`: producen oro solas · `/mascotas casa`: decórala y produce más.', '`/mascotas guarderia`: dos de nivel 10 tienen un huevo · `/mascotas expedicion`: todo el canal junto.'],
            en: ['`/companion`: feed it, play and cuddle it. Care makes it level up.', '`/pets farm`: they make gold on their own · `/pets house`: decorate it and they make more.', '`/pets nursery`: two level-10 pets have an egg · `/pets expedition`: the whole channel together.'] } },
    // ---------------- 🏘️ Comunidad ----------------
    { id: 'mascotaServidor', campo: 'mascota.activo', emoji: '🐉', zona: 'comunidad', es: 'Mascota del servidor', en: 'Server pet', tab: 'com-mascota', activar: 'setup:mascota',
        activo: activoSi((c) => c.mascota?.activo), partes: [['comunidad', 'pet']],
        frase: { es: 'Una mascota que es de todo el servidor: la cuidáis entre todos.', en: 'A pet that belongs to the whole server: you all look after it together.' },
        pasos: { es: ['`/comunidad mascota ver` cómo está: hablar en el servidor la alegra.', 'Dale de comer y juega con ella con oro; sube de nivel y da ventajas a todos.', 'Pelea cada día en la Liga contra mascotas de otros servidores.'],
            en: ['`/community pet view` how it is: chatting on the server cheers it up.', 'Feed it and play with it using gold; it levels up and gives everyone perks.', 'It fights every day in the League against other servers’ pets.'] } },
    { id: 'liga', campo: 'liga.activo', emoji: '🏅', zona: 'comunidad', es: 'Liga Sokyo', en: 'Sokyo League', tab: 'crec-liga', activar: 'setup:liga',
        activo: activoSi((c) => c.liga?.activo), partes: [['comunidad', 'league']],
        frase: { es: 'Los servidores compiten cada mes; la mascota del servidor pelea cada día.', en: 'Servers compete every month; the server pet fights every day.' },
        pasos: { es: ['Cada día a las 17:00 (UTC) se anuncia el combate: **animad** y **votad la táctica**.', 'Votar por el bot y los impulsos con oro suman puntos (`/comunidad liga impulsar`).', 'El podio del mes sale destacado en la web de servidores.'],
            en: ['Every day at 17:00 (UTC) the battle is announced: **cheer** and **vote the tactic**.', 'Voting for the bot and gold boosts add points (`/community league boost`).', 'The month’s podium is featured on the servers website.'] } },
    { id: 'clanes', campo: 'clanes.activo', emoji: '🛡️', zona: 'comunidad', es: 'Clanes', en: 'Clans', tab: 'com-clanes', activar: 'setup:clanes',
        activo: activoSi((c) => c.clanes?.activo), comandos: ['clan'],
        frase: { es: 'Equipos que compiten cada semana, con guerra contra un clan rival.', en: 'Teams that compete every week, with a war against a rival clan.' },
        pasos: { es: ['`/clan crear` o `/clan unirme`. Cada XP que ganáis suma para el clan.', '`/clan guerra`: vuestro rival de la semana; cada combate ganado a uno de ellos, +300.', 'El lunes gana el que más suma: copa y oro para cada miembro.'],
            en: ['`/clan create` or `/clan join`. Every XP you earn adds up for the clan.', '`/clan war`: this week’s rival; every fight won against one of them, +300.', 'On Monday the top clan wins: a cup and gold for each member.'] } },
    { id: 'bromas', campo: 'bromas.activo', emoji: '😜', zona: 'comunidad', es: 'Bromas de oro', en: 'Gold pranks', tab: 'com-bromas', activar: 'setup:bromas',
        activo: activoSi((c) => c.bromas?.activo), partes: [['comunidad', 'prank']],
        frase: { es: 'Gasta oro en bromas inofensivas a tus amigos (y protégete con escudos).', en: 'Spend gold on harmless pranks on your friends (and protect yourself with shields).' },
        pasos: { es: ['`/comunidad broma apodo`, `payaso`, `reaccion` o `loro`: elige a quién y paga con oro.', 'Se le pueden devolver una vez pagando el doble.', '`/comunidad broma salir` si no quieres participar.'],
            en: ['`/community prank nickname`, `clown`, `reaction` or `parrot`: pick who and pay with gold.', 'They can pay double to send it back once.', '`/community prank optout` if you don’t want to take part.'] } },
    { id: 'temporadas', campo: 'temporadas.activo', activar: 'setup:temporadas', emoji: '🏆', zona: 'comunidad', es: 'Temporadas', en: 'Seasons', tab: 'com-temporadas',
        activo: activoSi((c) => c.temporadas?.activo), partes: [['comunidad', 'season']],
        frase: { es: 'Un ranking de XP que se reinicia cada mes o semana, con premios.', en: 'An XP ranking that resets every month or week, with prizes.' },
        pasos: { es: ['Habla y participa: tu XP de temporada sube.', '`/comunidad temporada` para ver cómo va.', 'Al cerrar, el top 3 gana oro y el primero un rol de campeón.'],
            en: ['Chat and take part: your season XP goes up.', '`/community season` to see the standings.', 'When it closes, the top 3 win gold and the first a champion role.'] } },
    { id: 'niveles', campo: 'nivelesActivo', emoji: '📈', zona: 'comunidad', es: 'Niveles', en: 'Levels', tab: 'config-niveles', activar: 'setup:niveles',
        activo: activoSi((c) => c.nivelesActivo), comandos: ['level', 'ranking', 'xp'],
        frase: { es: 'Gana XP hablando y en voz, sube de nivel y consigue roles.', en: 'Earn XP by chatting and in voice, level up and get roles.' },
        pasos: { es: ['Escribir y estar en voz da XP.', '`/nivel` para tu tarjeta y `/ranking` para el top.', 'Algunos niveles dan roles (los pone el staff en el panel).'],
            en: ['Chatting and being in voice gives XP.', '`/level` for your card and `/ranking` for the top.', 'Some levels give roles (set by the staff in the panel).'] } },
    { id: 'grupos', campo: 'grupos.activo', activar: 'campo', emoji: '👥', zona: 'comunidad', es: 'Buscar grupo', en: 'Find a group', tab: 'com-grupos',
        activo: activoSi((c) => !c.grupos || c.grupos.activo !== false), comandos: ['group'],
        frase: { es: 'Busca gente para jugar; al llenarse, el bot crea una sala de voz.', en: 'Find people to play with; when it fills up, the bot creates a voice room.' },
        pasos: { es: ['`/grupo`: dices a qué, cuántos y cuándo.', 'Los demás se apuntan con un botón.', 'Lleno → sala de voz para el grupo.'],
            en: ['`/group`: say what, how many and when.', 'Others join with a button.', 'Full → a voice room for the group.'] } },
    { id: 'cumpleanos', campo: 'cumpleanos.activo', activar: 'setup:cumpleanos', emoji: '🎂', zona: 'comunidad', es: 'Cumpleaños', en: 'Birthdays', tab: 'com-cumpleanos',
        activo: activoSi((c) => c.cumpleanos?.activo), comandos: ['birthday'],
        frase: { es: 'Guarda tu cumpleaños y el servidor te felicita.', en: 'Save your birthday and the server congratulates you.' },
        pasos: { es: ['`/cumple guardar` tu fecha.', 'Ese día sale la felicitación (y quizá un rol especial).'], en: ['`/birthday set` your date.', 'On the day the greeting goes out (and maybe a special role).'] } },
    { id: 'confesiones', campo: 'confesiones.activo', emoji: '🤫', zona: 'comunidad', es: 'Confesiones', en: 'Confessions', tab: 'com-confesiones',
        activo: activoSi((c) => c.confesiones?.activo), comandos: ['confess'],
        frase: { es: 'Confesiones anónimas: nadie sabe que son tuyas.', en: 'Anonymous confessions: nobody knows they’re yours.' },
        pasos: { es: ['`/confesar` y escribe.', 'Sale en el canal de confesiones sin tu nombre.'], en: ['`/confess` and write.', 'It goes to the confessions channel without your name.'] } },
    { id: 'ausente', campo: 'ausente.activo', activar: 'campo', emoji: '💤', zona: 'comunidad', es: 'Modo ausente', en: 'Away mode', tab: 'prod-ausente',
        activo: activoSi((c) => !c.ausente || c.ausente.activo !== false), comandos: ['afk'],
        frase: { es: 'Avisa de que no estás cuando alguien te menciona.', en: 'Let people know you’re away when they mention you.' },
        pasos: { es: ['`/ausente` con un motivo.', 'Se quita solo cuando vuelves a escribir.'], en: ['`/afk` with a reason.', 'It turns off by itself when you write again.'] } },
    // ---------------- 🎵 Música ----------------
    { id: 'musica', campo: 'musica.activo', activar: 'campo', emoji: '🎵', zona: 'musica', es: 'Música', en: 'Music', tab: 'musica',
        activo: activoSi((c) => !c.musica || c.musica.activo !== false), comandos: ['play', 'queue', 'nowplaying', 'skip', 'lyrics', 'pause', 'resume', 'stop', 'volume', 'filter', '247'],
        frase: { es: 'Pon música en un canal de voz.', en: 'Play music in a voice channel.' },
        pasos: { es: ['Entra en un canal de voz y escribe `/play` con el nombre de la canción.', '`/cola` para ver lo que viene y `/saltar` para pasar.', '`/letra` para la letra de lo que suena.'],
            en: ['Join a voice channel and type `/play` with the song name.', '`/queue` to see what’s next and `/skip` to move on.', '`/lyrics` for the lyrics of what’s playing.'] } },
    // ---------------- 🚀 Crecimiento ----------------
    { id: 'invitaciones', campo: 'crecimiento.invitaciones.activo', emoji: '📨', zona: 'crecimiento', es: 'Invitaciones', en: 'Invites', tab: 'crec-invitaciones',
        activo: activoSi((c) => c.crecimiento?.invitaciones?.activo), comandos: ['invites'],
        frase: { es: 'Cuenta a quién invita cada uno, con premios.', en: 'Counts who invites whom, with rewards.' },
        pasos: { es: ['Invita gente con tu enlace.', '`/invitaciones` para ver cuántos llevas y el top.'], en: ['Invite people with your link.', '`/invites` to see how many and the top.'] } },
    { id: 'votos', campo: 'crecimiento.votos.activo', activar: 'setup:votos', emoji: '🗳️', zona: 'crecimiento', es: 'Votos', en: 'Votes', tab: 'crec-votos',
        activo: activoSi((c) => c.crecimiento?.votos?.activo), comandos: ['vote'],
        frase: { es: 'Vota por el bot cada 12 h y gana oro.', en: 'Vote for the bot every 12 h and earn gold.' },
        pasos: { es: ['`/votar` te da el enlace.', 'Al votar, oro (el doble en fin de semana).'], en: ['`/vote` gives you the link.', 'When you vote, gold (double at weekends).'] } },
    { id: 'referidos', emoji: '🤝', zona: 'crecimiento', es: 'Recomendar Sokyo', en: 'Recommend Sokyo', tab: null,
        activo: activoSi(() => true), comandos: ['referrals'],
        frase: { es: 'Recomienda el bot a otros servidores y gana días de Premium.', en: 'Recommend the bot to other servers and earn Premium days.' },
        pasos: { es: ['`/referidos ver` tu código.', 'Si otro servidor lo canjea y se queda, ganas Premium.'], en: ['`/referrals view` your code.', 'If another server redeems it and stays, you earn Premium.'] } },
    // ---------------- 🛡️ Staff ----------------
    { id: 'moderacion', emoji: '🛡️', zona: 'staff', es: 'Moderación', en: 'Moderation', tab: 'mod-miembros',
        activo: activoSi(() => true), comandos: ['ban', 'kick', 'timeout', 'warn', 'sanction', 'unban', 'history', 'Sanction', 'View profile'],
        frase: { es: 'Avisar, aislar, expulsar y banear, con historial y «Deshacer».', en: 'Warn, time out, kick and ban, with history and “Undo”.' },
        pasos: { es: ['Clic derecho en alguien → Apps → Sancionar.', '`/historial` para ver sus sanciones.'], en: ['Right-click someone → Apps → Sanction.', '`/history` to see their sanctions.'] } },
    { id: 'reportes', campo: 'reportes.activo', emoji: '🚩', zona: 'staff', es: 'Reportes', en: 'Reports', tab: 'mod-reportes',
        activo: activoSi((c) => c.reportes?.activo), comandos: ['report', 'Report message'],
        frase: { es: 'Avisar al staff de un mensaje o de alguien.', en: 'Tell the staff about a message or someone.' },
        pasos: { es: ['Clic derecho en un mensaje → Apps → Reportar mensaje.', 'O `/reportar` a alguien.'], en: ['Right-click a message → Apps → Report message.', 'Or `/report` someone.'] } },
    { id: 'tickets', emoji: '🎫', zona: 'staff', es: 'Tickets', en: 'Tickets', tab: 'tickets-gestion',
        activo: activoSi(() => true), comandos: ['support-panel', 'user', 'account-panel', 'Open ticket about this'],
        frase: { es: 'Pedir ayuda al staff en un canal privado.', en: 'Ask the staff for help in a private channel.' },
        pasos: { es: ['Pulsa «Abrir ticket» en el panel de soporte.', 'O clic derecho en un mensaje → Apps → Abrir ticket con esto.'], en: ['Press “Open ticket” on the support panel.', 'Or right-click a message → Apps → Open ticket about this.'] } },
    { id: 'herramientas', emoji: '🧰', zona: 'staff', es: 'Herramientas', en: 'Tools', tab: null,
        activo: activoSi(() => true), comandos: ['configure', 'ping', 'activity', 'role', 'emoji', 'sticker', 'language', 'setup', 'quicksetup', 'system'],
        frase: { es: 'Configurar el bot, roles, emojis y utilidades.', en: 'Set up the bot, roles, emojis and utilities.' },
        pasos: { es: ['`/configurar` para encender o apagar funciones desde Discord.', '`/setup-rapido` deja el bot listo con unas preguntas.'], en: ['`/configure` to turn features on or off from Discord.', '`/quicksetup` gets the bot ready with a few questions.'] } },
    // ---------------- ✨ Lo básico ----------------
    { id: 'basico', emoji: '✨', zona: 'basico', es: 'Lo básico', en: 'The basics', tab: null,
        activo: activoSi(() => true), comandos: ['menu', 'start', 'help', 'account', 'preferences', 'remind', 'reminders', 'Translate'],
        frase: { es: 'Tu menú, la guía para empezar, tu cuenta y tus preferencias.', en: 'Your menu, the getting-started guide, your account and your preferences.' },
        pasos: { es: ['`/menu`: todo lo tuyo y a dónde ir, con botones.', '`/empezar`: si no sabes por dónde empezar.', '`/preferencias`: idioma y qué avisos quieres.'],
            en: ['`/menu`: all your stuff and where to go, with buttons.', '`/start`: if you don’t know where to begin.', '`/preferences`: language and which notices you want.'] } },
];

// Comandos que van en TODOS los sitios (también por privado): se registran globales. El resto, por servidor.
const GLOBALES = new Set(['account', 'preferences', 'remind', 'reminders', 'help', 'Translate']);

const modulo = (id) => MODULOS.find((m) => m.id === id) || null;
const nombre = (m, idioma) => t(idioma, m.es, m.en);
const activos = (cfg) => MODULOS.filter((m) => m.activo(cfg));
// Módulo al que pertenece un comando suelto o una parte de puerta (por el nombre en inglés del comando).
function moduloDeComando(nombreCmd) {
    return MODULOS.find((m) => (m.comandos || []).includes(nombreCmd) || (m.partes || []).some(([, c]) => c === nombreCmd)) || null;
}
// ¿Está disponible ese comando en este servidor? (los que no están en el catálogo, siempre)
const comandoActivo = (nombreCmd, cfg) => { const m = moduloDeComando(nombreCmd); return !m || m.activo(cfg); };
// Comandos que se quitaron de la lista de «/» porque ahora van dentro de una puerta.
const EN_PUERTA = new Set(MODULOS.flatMap((m) => (m.partes || []).map(([, c]) => c)).filter((c) => c !== 'companion'));

module.exports = { ZONAS, MODULOS, GLOBALES, EN_PUERTA, modulo, nombre, activos, moduloDeComando, comandoActivo };
