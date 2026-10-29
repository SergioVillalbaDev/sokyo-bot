// Tickets por privado: quien escribe al bot por privado puede abrir un ticket sin
// buscar el botón en el servidor. Lo que escribe después por privado llega al
// ticket, y lo que el staff escribe en el ticket (en Discord o desde el panel) le
// llega por privado. También tiene acceso al canal del ticket, como siempre.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const { getConfigCached } = require('./config.js');
const { idiomaMiembro } = require('./preferencias.js');
const { t } = require('./i18n.js');

const VIGENCIA = 15 * 60 * 1000;
const pendientes = new Map();   // userId -> { texto, adjuntos, momento }
const sinServidor = new Map();  // userId -> último «aquí no puedo abrir tickets» (para no repetirlo)
const MAX_ADJUNTOS = 10;

const ticketAbierto = (userId) => Ticket.findOne({ creadorId: userId, porPrivado: true, estado: { $ne: 'Cerrado' } }).sort({ fechaCreacion: -1 });

// Servidores (en común con el bot) que tienen los tickets por privado activados. Solo
// se mira en los que lo tienen activado, y lo de cada persona se recuerda un momento:
// así unos cuantos privados seguidos no hacen una consulta a Discord por servidor.
const RECORDAR_SERVIDORES = 30 * 1000;
const servidoresDe = new Map(); // userId -> { momento, lista }
async function servidoresDisponibles(client, userId) {
    const guardado = servidoresDe.get(userId);
    if (guardado && Date.now() - guardado.momento < RECORDAR_SERVIDORES) return guardado.lista;
    const ServidorConfig = require('../models/ServidorConfig.js');
    const activos = await ServidorConfig.find({ 'ticketsPrivado.activo': true }).select('guildId').lean();
    const out = [];
    for (const { guildId } of activos) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
        if (member) out.push({ guild, cfg: await getConfigCached(guildId).catch(() => null) });
        if (out.length >= 25) break;
    }
    if (servidoresDe.size > 5000) servidoresDe.clear();
    servidoresDe.set(userId, { momento: Date.now(), lista: out });
    return out;
}

const urlsAdjuntos = (message) => [...message.attachments.values()].slice(0, MAX_ADJUNTOS).map((a) => a.url);

// Pasa al ticket lo que la persona escribe por privado.
async function alTicket(client, ticket, message) {
    const canal = client.channels.cache.get(ticket.canalId) || await client.channels.fetch(ticket.canalId).catch(() => null);
    if (!canal?.isTextBased()) return false;
    const adjuntos = urlsAdjuntos(message);
    const cfg = await getConfigCached(ticket.guildId).catch(() => null);
    const cabecera = t(cfg, `✉️ **${message.author.username}** (por privado):`, `✉️ **${message.author.username}** (via DM):`);
    const enviado = await canal.send({ content: `${cabecera} ${message.content || ''}`.slice(0, 2000), files: adjuntos, allowedMentions: { parse: [] } }).catch(() => null);
    if (!enviado) return false;
    await Mensaje.create({ ticketId: ticket.canalId, usuario: message.author.username, usuarioId: message.author.id, contenido: message.content || '', imagenes: adjuntos }).catch(() => {});
    await Ticket.updateOne({ canalId: ticket.canalId }, { $set: { esperaRespuesta: true, ultimoMensajeUsuario: new Date(), avisoSinRespuesta: null } }).catch(() => {});
    return true;
}

// Lo que el staff escribe en el ticket le llega por privado a quien lo abrió.
async function alUsuario(client, ticket, { autor, texto, adjuntos = [] }) {
    const user = await client.users.fetch(ticket.creadorId).catch(() => null);
    if (!user || user.bot) return false;
    const cfg = await getConfigCached(ticket.guildId).catch(() => null);
    const idioma = await idiomaMiembro(ticket.creadorId, { cfg });
    const guild = client.guilds.cache.get(ticket.guildId);
    const cabecera = t(idioma, `💬 **${autor}** (staff${guild ? ` de ${guild.name}` : ''}):`, `💬 **${autor}** (staff${guild ? ` of ${guild.name}` : ''}):`);
    return !!(await user.send({ content: `${cabecera} ${texto || ''}`.slice(0, 2000), files: adjuntos.slice(0, MAX_ADJUNTOS), allowedMentions: { parse: [] } }).catch(() => null));
}

function botonesServidores(lista, idioma) {
    if (lista.length <= 4) {
        return [new ActionRowBuilder().addComponents(
            ...lista.map(({ guild }) => new ButtonBuilder().setCustomId(`tkpriv_abrir:${guild.id}`).setStyle(ButtonStyle.Primary).setEmoji('📩').setLabel(t(idioma, `Abrir en ${guild.name}`, `Open on ${guild.name}`).slice(0, 80))),
            new ButtonBuilder().setCustomId('tkpriv_cancelar').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'No, gracias', 'No, thanks')),
        )];
    }
    return [
        new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('tkpriv_srv')
            .setPlaceholder(t(idioma, 'Elige el servidor', 'Pick the server'))
            .addOptions(lista.map(({ guild }) => ({ label: guild.name.slice(0, 100), value: guild.id })))),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tkpriv_cancelar').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'No, gracias', 'No, thanks'))),
    ];
}

// Para cada mensaje privado (que no sea un comando).
async function alMensajePrivado(message, client) {
    const userId = message.author.id;
    const abierto = await ticketAbierto(userId);
    if (abierto) {
        if (await alTicket(client, abierto, message)) { await message.react('✅').catch(() => {}); return; }
        // El canal ya no existe: ese ticket ya no sirve.
        await Ticket.updateOne({ _id: abierto._id }, { $set: { estado: 'Cerrado', fechaCierre: new Date() } }).catch(() => {});
    }
    const lista = await servidoresDisponibles(client, userId);
    // Por privado no se sabe el idioma de su Discord: el que eligió o el de su servidor.
    const idioma = await idiomaMiembro(userId, { cfg: lista[0] ? lista[0].cfg : null });
    if (!lista.length) {
        // Sin servidores con esto activado: se dice una vez cada 6 horas como mucho.
        if (Date.now() - (sinServidor.get(userId) || 0) < 6 * 3600 * 1000) return;
        sinServidor.set(userId, Date.now());
        if (sinServidor.size > 5000) sinServidor.clear();
        await message.reply(t(idioma, '👋 ¡Hola! Por aquí no puedo abrirte un ticket: tus servidores no lo tienen activado. Búscalo en el canal de soporte de tu servidor.', '👋 Hi! I can’t open a ticket for you here: your servers haven’t turned this on. Look for it in your server’s support channel.')).catch(() => {});
        return;
    }
    pendientes.set(userId, { texto: message.content || '', adjuntos: urlsAdjuntos(message), momento: Date.now() });
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(t(idioma, '📩 ¿Abro un ticket con el staff?', '📩 Shall I open a ticket with the staff?'))
        .setDescription(t(idioma,
            `Lo que me has escrito será el primer mensaje. Después, lo que me escribas por aquí le llegará al staff${lista.length === 1 ? ` de **${lista[0].guild.name}**` : ''} y sus respuestas te llegarán por aquí.`,
            `What you wrote will be the first message. After that, whatever you write here reaches the staff${lista.length === 1 ? ` of **${lista[0].guild.name}**` : ''} and their replies come back here.`));
    await message.reply({ embeds: [embed], components: botonesServidores(lista, idioma) }).catch(() => {});
}

// Botones y menú del privado: abrir en un servidor o cancelar.
async function manejarInteraccion(interaction, client) {
    const userId = interaction.user.id;
    const idioma = await idiomaMiembro(userId, { locale: interaction.locale });
    if (interaction.customId === 'tkpriv_cancelar') {
        pendientes.delete(userId);
        return interaction.update({ content: t(idioma, 'Vale, no abro nada. Si me necesitas, escríbeme otra vez.', 'Okay, I won’t open anything. If you need me, write to me again.'), embeds: [], components: [] });
    }
    const guildId = interaction.isStringSelectMenu() ? interaction.values[0] : interaction.customId.split(':')[1];
    const p = pendientes.get(userId);
    if (!p || Date.now() - p.momento > VIGENCIA) {
        pendientes.delete(userId);
        return interaction.update({ content: t(idioma, '⌛ Ha pasado mucho rato. Escríbeme otra vez lo que necesitas.', '⌛ It’s been a while. Write to me again with what you need.'), embeds: [], components: [] });
    }
    const guild = client.guilds.cache.get(guildId);
    const cfg = await getConfigCached(guildId).catch(() => null);
    const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!guild || !cfg?.ticketsPrivado?.activo || !member) {
        return interaction.update({ content: t(idioma, '❌ Ese servidor ya no permite abrir tickets por aquí.', '❌ That server no longer allows opening tickets here.'), embeds: [], components: [] });
    }
    if (await ticketAbierto(userId)) return interaction.update({ content: t(idioma, 'Ya tienes un ticket abierto por aquí: escribe y le llegará al staff.', 'You already have a ticket open here: write and it’ll reach the staff.'), embeds: [], components: [] });
    const max = cfg.maxTicketsAbiertos || 0;
    if (max > 0 && await Ticket.countDocuments({ guildId, creadorId: userId, estado: { $ne: 'Cerrado' } }) >= max) {
        return interaction.update({ content: t(idioma, `🎫 Ya tienes el máximo de tickets abiertos en **${guild.name}** (${max}). Sigue en el que tienes.`, `🎫 You already have the maximum open tickets on **${guild.name}** (${max}). Continue in the one you have.`), embeds: [], components: [] });
    }
    pendientes.delete(userId);
    await interaction.update({ content: t(idioma, '⏳ Abriendo tu ticket…', '⏳ Opening your ticket…'), embeds: [], components: [] });
    const { crearTicket } = require('./ticketManager.js');
    const texto = p.texto || t(cfg, '(sin texto)', '(no text)');
    const res = await crearTicket(client, {
        guildId,
        creador: { id: userId, username: interaction.user.username, avatar: interaction.user.displayAvatarURL({ size: 128 }) },
        motivo: t(cfg, 'Por privado', 'Via DM'),
        titulo: (p.texto || t(cfg, 'Ticket por privado', 'DM ticket')).split('\n')[0].slice(0, 80),
        descripcion: texto.slice(0, 1500),
        porPrivado: true,
    }).catch((e) => ({ ok: false, error: e.message }));
    if (!res.ok) return interaction.editReply(t(idioma, '❌ No he podido abrir el ticket (puede que me falten permisos en el servidor). Prueba desde el canal de soporte.', '❌ I couldn’t open the ticket (I may be missing permissions on the server). Try from the support channel.'));
    // La primera nota (con sus archivos) también se guarda en la conversación.
    if (p.adjuntos.length) await res.canal.send({ content: t(cfg, `📎 Archivos de **${interaction.user.username}**:`, `📎 Files from **${interaction.user.username}**:`), files: p.adjuntos }).catch(() => {});
    await Mensaje.create({ ticketId: res.canal.id, usuario: interaction.user.username, usuarioId: userId, contenido: p.texto || '', imagenes: p.adjuntos }).catch(() => {});
    return interaction.editReply(t(idioma,
        `✅ Ticket abierto en **${guild.name}**. Escríbeme por aquí lo que quieras añadir y le llegará al staff; sus respuestas te llegarán por aquí. (También puedes verlo en ${res.canal}.)`,
        `✅ Ticket opened on **${guild.name}**. Write here anything you want to add and it’ll reach the staff; their replies will come here. (You can also see it in ${res.canal}.)`));
}

module.exports = { alMensajePrivado, manejarInteraccion, alUsuario, alTicket, ticketAbierto, servidoresDisponibles };
