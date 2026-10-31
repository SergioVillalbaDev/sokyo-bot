const { Events, ActionRowBuilder, EmbedBuilder, UserSelectMenuBuilder, MessageFlags } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const { cerrarTicket, registrarLogTicket } = require('../utils/ticketManager.js');
const { obtenerConfig, buscarMotivo } = require('../utils/config.js');
const { puedeAtender } = require('../utils/permisos.js');
const apertura = require('../utils/aperturaTickets.js');

const EFIMERO = { flags: MessageFlags.Ephemeral };

// ¿Es staff para ESTE ticket? (respeta los roles propios de cada tipo de ticket)
async function staffDelTicket(interaction, ticket) {
    const config = await obtenerConfig(interaction.guildId);
    const motivo = buscarMotivo(config, ticket.motivoId || ticket.motivo);
    return puedeAtender(interaction.member, config, motivo);
}

async function reclamar(interaction) {
    const ticket = await Ticket.findOne({ canalId: interaction.channelId });
    if (!ticket) return interaction.reply({ content: '❌ No se encontró este ticket en la base de datos.', ...EFIMERO });
    if (!(await staffDelTicket(interaction, ticket))) {
        return interaction.reply({ content: '❌ Solo el equipo de soporte puede reclamar este ticket.', ...EFIMERO });
    }
    if (ticket.asignadoA) return interaction.reply({ content: `⚠️ Este ticket ya está siendo atendido por **${ticket.asignadoNombre}**.`, ...EFIMERO });

    const avatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
    if (!ticket.participantes.some(p => p.id === interaction.user.id)) {
        ticket.participantes.push({ id: interaction.user.id, username: interaction.user.username, avatar, rol: 'Staff' });
    }
    ticket.asignadoA = interaction.user.id;
    ticket.asignadoNombre = interaction.user.username;
    ticket.ultimaInteractStaff = new Date();
    if (!ticket.primeraRespuestaStaff) ticket.primeraRespuestaStaff = new Date();
    await ticket.save();

    await registrarLogTicket(interaction.client, ticket, '🙋 Ticket Reclamado', '#3498db', interaction.user.username);

    const embed = EmbedBuilder.from(interaction.message.embeds[0]).addFields({ name: '👀 Atendido por', value: `🙋‍♂️ ${interaction.user.username}`, inline: true });
    const fila = ActionRowBuilder.from(interaction.message.components[0]);
    fila.components[0].setDisabled(true);
    await interaction.update({ embeds: [embed], components: [fila] });
    await interaction.followUp({ content: `📢 El agente de soporte **${interaction.user.username}** se ha hecho cargo de este ticket.` });
}

async function pedirUsuario(interaction) {
    const ticket = await Ticket.findOne({ canalId: interaction.channelId });
    if (!ticket || !(await staffDelTicket(interaction, ticket))) {
        return interaction.reply({ content: '❌ Solo el equipo de soporte puede invitar a otras personas.', ...EFIMERO });
    }
    const menu = new UserSelectMenuBuilder().setCustomId('add_user_select').setPlaceholder('🔍 Busca y selecciona a un usuario...').setMinValues(1).setMaxValues(1);
    return interaction.reply({ content: 'Elige al usuario que quieres invitar a participar en este ticket:', components: [new ActionRowBuilder().addComponents(menu)], ...EFIMERO });
}

async function anadirUsuario(interaction, client) {
    const userId = interaction.values[0];
    const canal = interaction.channel;
    try {
        await canal.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
        await interaction.update({ content: '✅ Permisos concedidos.', components: [] });
        await canal.send({ content: `👋 El usuario <@${userId}> ha sido añadido a la conversación por <@${interaction.user.id}>.` });

        const usuario = await client.users.fetch(userId);
        const ticket = await Ticket.findOne({ canalId: canal.id });
        if (ticket && !ticket.participantes.some(p => p.id === userId)) {
            ticket.participantes.push({ id: userId, username: usuario.username, avatar: usuario.displayAvatarURL({ extension: 'png', size: 128 }), rol: 'Invitado' });
            await ticket.save();
        }
    } catch (error) {
        console.error('Error añadiendo usuario al ticket:', error);
        await interaction.followUp({ content: '❌ No se pudo añadir al usuario (¿faltan permisos?).', ...EFIMERO }).catch(() => {});
    }
}

async function cerrar(interaction, client) {
    const ticket = await Ticket.findOne({ canalId: interaction.channelId });
    if (!ticket) return interaction.reply({ content: '❌ No se encontró este ticket en la base de datos.', ...EFIMERO });
    const esCreador = ticket.creadorId === interaction.user.id;
    if (!esCreador && !(await staffDelTicket(interaction, ticket))) {
        return interaction.reply({ content: '❌ Solo quien abrió el ticket o el equipo de soporte pueden cerrarlo.', ...EFIMERO });
    }
    if (ticket.estado === 'Cerrado') return interaction.reply({ content: 'ℹ️ Este ticket ya está cerrado.', ...EFIMERO });

    await interaction.reply({ content: '🔒 Generando copia de seguridad y cerrando el ticket...', ...EFIMERO });
    try {
        const res = await cerrarTicket(client, interaction.channelId, { autor: interaction.user.username });
        await interaction.editReply({ content: res.ok ? '✅ Ticket cerrado y archivado correctamente.' : '❌ No se encontró este ticket en la base de datos.' });
    } catch (error) {
        console.error('Error al cerrar:', error);
        await interaction.editReply({ content: '❌ Hubo un error al cerrar el ticket.' }).catch(() => {});
    }
}

async function valorar(interaction, client) {
    const [, nota, canalId] = interaction.customId.split('_');
    const valoracion = parseInt(nota, 10);
    try {
        const ticket = await Ticket.findOneAndUpdate({ canalId, creadorId: interaction.user.id }, { valoracionCSAT: valoracion }, { returnDocument: 'after' });
        if (ticket) await registrarLogTicket(client, ticket, `⭐ Ticket Valorado (${valoracion}/5)`, '#f1c40f', ticket.creadorNombre);
        const gracias = new EmbedBuilder().setColor('#2ecc71').setTitle('💖 ¡Gracias por tu valoración!').setDescription(`Has valorado la atención recibida con **${valoracion} estrellas**.`);
        // Se conserva la fila del botón "Añadir Sokyo" si la había (la última fila no es de estrellas)
        const filas = interaction.message.components.filter(f => !f.components.some(c => c.customId?.startsWith('csat_')));
        await interaction.update({ embeds: [gracias], components: filas });
    } catch (e) {
        await interaction.reply({ content: 'Error al guardar.', ...EFIMERO }).catch(() => {});
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // --- COMANDOS / ---
            if (interaction.isChatInputCommand()) {
                const comando = client.commands.get(interaction.commandName);
                if (comando) await comando.execute(interaction, client);
                return;
            }
            if (interaction.isAutocomplete()) {
                const comando = client.commands.get(interaction.commandName);
                if (comando?.autocomplete) await comando.autocomplete(interaction, client);
                return;
            }

            // --- BOTONES ---
            if (interaction.isButton()) {
                const id = interaction.customId;
                if (id === 'create_ticket' || id.startsWith('abrir_panel:')) return apertura.alPulsarPanel(interaction);
                if (id.startsWith('deflex_')) return apertura.alResponderDeflexion(interaction, client);
                if (id === 'reclamar_ticket') return reclamar(interaction);
                if (id === 'add_user_prompt') return pedirUsuario(interaction);
                if (id === 'close_ticket') return cerrar(interaction, client);
                if (id.startsWith('csat_')) return valorar(interaction, client);
                return;
            }

            // --- MENÚS ---
            if (interaction.isStringSelectMenu() && (interaction.customId === 'sel_motivo' || interaction.customId === 'seleccionar_motivo_ticket')) {
                return apertura.alElegirMotivo(interaction);
            }
            if (interaction.isUserSelectMenu() && interaction.customId === 'add_user_select') {
                return anadirUsuario(interaction, client);
            }

            // --- FORMULARIOS ---
            if (interaction.isModalSubmit() && interaction.customId.startsWith('abrir:')) {
                return apertura.alEnviarFormulario(interaction, client);
            }
        } catch (error) {
            console.error('Error procesando interacción:', error);
            const respuesta = { content: '❌ Hubo un error al procesar tu solicitud.', ...EFIMERO };
            if (interaction.isRepliable()) {
                if (interaction.deferred || interaction.replied) await interaction.followUp(respuesta).catch(() => {});
                else await interaction.reply(respuesta).catch(() => {});
            }
        }
    }
};
