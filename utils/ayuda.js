// Ayuda interactiva (/ayuda y !help): un menú con las categorías; al elegir una
// salen sus comandos explicados en una línea y un botón a su sección del panel.
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { botonPanel } = require('./enlacesPanel.js');
const { botonAbrirCuenta } = require('./cuenta.js');
const { t } = require('./i18n.js');

// 's' = comando de barra (/), 'p' = con el prefijo del servidor, 'c' = clic derecho.
// [nombre, tipo, nombre en español (si cambia), qué hace (es), qué hace (en)]
const CATEGORIAS = [
    { id: 'empezar', emoji: '✨', titulo: ['Lo básico', 'The basics'], tab: null, cmds: [
        ['help', 's', 'ayuda', 'Esta ayuda.', 'This help.'],
        ['account', 's', 'cuenta', 'Tu web personal: tickets, oro, tienda, música y tarjeta.', 'Your personal web: tickets, gold, shop, music and card.'],
        ['preferences', 's', 'preferencias', 'Tu idioma y qué mensajes privados quieres del bot.', 'Your language and which DMs you want from the bot.'],
        ['remind', 's', 'recordar', 'Que el bot te recuerde algo dentro de un rato.', 'Have the bot remind you of something later.'],
        ['reminders', 's', 'recordatorios', 'Tus recordatorios pendientes (y borrarlos).', 'Your pending reminders (and delete them).'],
    ] },
    { id: 'musica', emoji: '🎵', titulo: ['Música', 'Music'], tab: 'musica', cmds: [
        ['play', 's', null, 'Pon una canción (escribe el nombre y elige de la lista).', 'Play a song (type the name and pick from the list).'],
        ['queue', 's', 'cola', 'Lo que va a sonar, por páginas.', 'What’s coming up, page by page.'],
        ['nowplaying', 's', 'sonando', 'Lo que suena ahora, con sus botones.', 'What’s playing now, with its buttons.'],
        ['skip', 's', 'saltar', 'Siguiente canción (si hay más gente, se vota).', 'Next song (with more people, it’s a vote).'],
        ['lyrics', 's', 'letra', 'La letra de la canción que suena.', 'The lyrics of the current song.'],
        ['pause', 's', 'pausar', 'Pausar.', 'Pause.'], ['resume', 's', 'seguir', 'Seguir.', 'Resume.'],
        ['stop', 's', 'parar', 'Parar y vaciar la cola.', 'Stop and clear the queue.'],
        ['volume', 's', 'volumen', 'Cambiar el volumen.', 'Change the volume.'],
        ['filter', 's', 'filtro', 'Efectos de sonido (Pro).', 'Sound effects (Pro).'],
        ['247', 's', null, 'Que el bot se quede en el canal (Pro).', 'Keep the bot in the channel (Pro).'],
    ] },
    { id: 'social', emoji: '🎉', titulo: ['Comunidad', 'Community'], tab: 'com-grupos', cmds: [
        ['group', 's', 'grupo', 'Busca gente para jugar: los demás se apuntan con un botón.', 'Look for people to play with: others join with a button.'],
        ['clan', 's', null, 'Funda un clan o únete a uno; cada semana gana el que más XP suma.', 'Found or join a clan; each week the one with the most XP wins.'],
        ['birthday', 's', 'cumple', 'Guarda tu cumpleaños y el servidor te felicitará.', 'Save your birthday and the server will congratulate you.'],
        ['confess', 's', 'confesar', 'Una confesión anónima: nadie sabrá que es tuya.', 'An anonymous confession: nobody will know it’s yours.'],
        ['afk', 's', 'ausente', 'Avisa de que no estás si alguien te menciona.', 'Let people know you’re away if they mention you.'],
        ['Traducir / Translate', 'c', null, 'Clic derecho en un mensaje → Apps: tradúcelo a tu idioma.', 'Right-click a message → Apps: translate it into your language.'],
    ] },
    { id: 'economia', emoji: '🪙', titulo: ['Oro y tienda', 'Gold and shop'], tab: 'com-dinamicas', cmds: [
        ['daily', 's', 'diario', 'Tu recompensa diaria de oro.', 'Your daily gold reward.'],
        ['shop', 's', 'tienda', 'Comprar objetos con oro.', 'Buy items with gold.'],
        ['inventory', 's', 'inventario', 'Tu oro y tus objetos.', 'Your gold and items.'],
        ['use', 's', 'usar', 'Usar un objeto de tu mochila.', 'Use an item from your bag.'],
        ['rich', 's', 'ricos', 'Quién tiene más oro.', 'Who has the most gold.'],
        ['givegold', 's', 'daroro', '(Admin) Dar o quitar oro.', '(Admin) Give or take gold.'],
    ] },
    { id: 'niveles', emoji: '📈', titulo: ['Niveles', 'Levels'], tab: 'config-niveles', cmds: [
        ['level', 'p', 'nivel', 'Tu nivel y tu tarjeta.', 'Your level and card.'],
        ['ranking', 'p', null, 'Los que más XP tienen.', 'Who has the most XP.'],
        ['xp', 'p', null, 'Cuánta XP te falta para subir.', 'How much XP you need to level up.'],
    ] },
    { id: 'crecimiento', emoji: '🚀', titulo: ['Invitaciones', 'Invites'], tab: 'crec-invitaciones', cmds: [
        ['invites', 's', 'invitaciones', 'A cuánta gente has invitado y el top.', 'How many people you invited and the top.'],
    ] },
    { id: 'moderacion', emoji: '🛡️', titulo: ['Moderación', 'Moderation'], tab: 'mod-miembros', cmds: [
        ['Sancionar / Sanction', 'c', null, 'Clic derecho en alguien → Apps: avisar, aislar, expulsar o banear.', 'Right-click someone → Apps: warn, time out, kick or ban.'],
        ['Ver ficha / View profile', 'c', null, 'Clic derecho en alguien → Apps: sus sanciones, nivel y desde cuándo está.', 'Right-click someone → Apps: their sanctions, level and join date.'],
        ['Reportar mensaje / Report message', 'c', null, 'Clic derecho en un mensaje → Apps: avisar al staff.', 'Right-click a message → Apps: tell the staff.'],
        ['ban', 'p', 'banear', 'Banear (pide confirmación y se puede deshacer).', 'Ban (asks to confirm and can be undone).'],
        ['kick', 'p', 'expulsar', 'Expulsar (pide confirmación).', 'Kick (asks to confirm).'],
        ['timeout', 'p', 'aislar', 'Aislar un rato.', 'Time out for a while.'],
        ['warn', 'p', 'avisar', 'Avisar.', 'Warn.'], ['unban', 'p', 'desbanear', 'Quitar un ban.', 'Unban.'],
        ['history', 'p', 'historial', 'Las sanciones de alguien.', 'Someone’s sanctions.'],
        ['report', 'p', 'reportar', 'Reportar a alguien al staff.', 'Report someone to the staff.'],
    ] },
    { id: 'tickets', emoji: '🎫', titulo: ['Ayuda del staff (tickets)', 'Staff help (tickets)'], tab: 'tickets-gestion', cmds: [
        ['Abrir ticket con esto / Open ticket about this', 'c', null, 'Clic derecho en un mensaje → Apps: pedir ayuda sobre él.', 'Right-click a message → Apps: ask for help about it.'],
        ['account-panel', 's', 'panel-cuenta', '(Admin) Publicar el botón «Abrir mi cuenta» en un canal.', '(Admin) Post the “Open my account” button in a channel.'],
    ] },
    { id: 'utilidades', emoji: '🧰', titulo: ['Utilidades', 'Utility'], tab: null, cmds: [
        ['ping', 'p', null, 'Si el bot responde y lo rápido que va.', 'Whether the bot answers and how fast.'],
        ['user', 'p', 'usuario', 'Información de alguien.', 'Info about someone.'],
        ['activity', 'p', 'actividad', 'Tu actividad en el servidor.', 'Your activity on the server.'],
        ['role', 'p', 'rol', 'Información de un rol.', 'Info about a role.'],
        ['emoji', 'p', null, 'Ver un emoji en grande.', 'See an emoji big.'],
        ['dice', 'p', 'dado', 'Tirar un dado.', 'Roll a die.'],
        ['setup', 'p', null, '(Admin) Primeros pasos del bot.', '(Admin) Bot first steps.'],
    ] },
];

function nombreComando(cmd, idioma, prefijo) {
    const [nombre, tipo, es] = cmd;
    if (tipo === 'c') return `🖱️ ${t(idioma, nombre.split(' / ')[0], nombre.split(' / ')[1] || nombre)}`;
    return `\`${tipo === 's' ? '/' : prefijo}${(es && t(idioma, es, nombre)) || nombre}\``;
}

// Portada: qué es cada categoría y el menú para elegir.
function mensajeAyuda(idioma, prefijo = '!', { categoria = null } = {}) {
    const cat = CATEGORIAS.find((c) => c.id === categoria);
    const embed = new EmbedBuilder().setColor('#a855f7');
    if (!cat) {
        embed.setTitle(t(idioma, '📖 ¿Qué puedo hacer?', '📖 What can I do?'))
            .setDescription(t(idioma,
                `Elige una categoría en el menú de abajo y te explico sus comandos.\n\n• Los que empiezan por **/** se escriben y Discord te ayuda a rellenarlos.\n• Los de **${prefijo}** se escriben tal cual.\n• 🖱️ Los de **clic derecho**: sobre una persona o un mensaje → **Apps**.\n\n✨ Todo lo tuyo (tickets, oro, tienda, tarjeta) está también en tu web: \`/cuenta\`.`,
                `Pick a category in the menu below and I’ll explain its commands.\n\n• Commands starting with **/** are typed and Discord helps you fill them in.\n• The **${prefijo}** ones are typed as they are.\n• 🖱️ The **right-click** ones: on a person or a message → **Apps**.\n\n✨ All your stuff (tickets, gold, shop, card) is also on your web: \`/account\`.`))
            .addFields(CATEGORIAS.map((c) => ({ name: `${c.emoji} ${t(idioma, c.titulo[0], c.titulo[1])}`, value: c.cmds.slice(0, 4).map((x) => nombreComando(x, idioma, prefijo)).join(' · ') + (c.cmds.length > 4 ? ' …' : ''), inline: false })));
    } else {
        embed.setTitle(`${cat.emoji} ${t(idioma, cat.titulo[0], cat.titulo[1])}`)
            .setDescription(cat.cmds.map((x) => `${nombreComando(x, idioma, prefijo)} — ${t(idioma, x[3], x[4])}`).join('\n'));
    }
    const menu = new StringSelectMenuBuilder()
        .setCustomId('ayuda:cat')
        .setPlaceholder(t(idioma, 'Elige una categoría…', 'Pick a category…'))
        .addOptions([
            { label: t(idioma, 'Portada', 'Overview'), value: 'inicio', emoji: '📖', default: !cat },
            ...CATEGORIAS.map((c) => ({ label: t(idioma, c.titulo[0], c.titulo[1]), value: c.id, emoji: c.emoji, default: cat?.id === c.id })),
        ]);
    const filas = [new ActionRowBuilder().addComponents(menu)];
    const botones = [botonAbrirCuenta(idioma)];
    botones.push(botonPanel(idioma, cat?.tab || null, cat?.tab ? t(idioma, 'Configurarlo en el panel', 'Set it up in the panel') : t(idioma, 'Panel de control', 'Control panel')));
    filas.push(new ActionRowBuilder().addComponents(botones));
    return { embeds: [embed], components: filas };
}

module.exports = { mensajeAyuda, CATEGORIAS };
