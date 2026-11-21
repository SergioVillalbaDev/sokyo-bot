const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, MessageFlags } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const { cerrarTicket, registrarLogTicket } = require('../utils/ticketManager.js');
const ticketCache = require('../utils/ticketCache.js');
const { esStaff } = require('../utils/permisos.js');

const MOTIVOS_POR_DEFECTO = [
    { nombre: 'Soporte General', urgencia: 'Normal' },
    { nombre: 'Reportar Usuario', urgencia: 'Alta' },
    { nombre: 'Donaciones', urgencia: 'Baja' }
];
const EFIMERO = MessageFlags.Ephemeral;

// Responde o edita según el estado de la interacción (nunca lanza: así un fallo no tira el bot).
async function responderSeguro(interaction, contenido) {
    const datos = { content: contenido, flags: EFIMERO };
    try {
        if (interaction.deferred || interaction.replied) await interaction.followUp(datos);
        else await interaction.reply(datos);
    } catch (e) { console.error('No se pudo responder a la interacción:', e.message); }
}

const obtenerConfig = (guildId) => ServidorConfig.findOne({ guildId });
const listaMotivos = (config) => (config?.motivos?.length ? config.motivos : MOTIVOS_POR_DEFECTO).slice(0, 25);

// Tickets abiertos del usuario cuyo canal aún existe (los de canales borrados se cierran solos).
async function ticketsAbiertosDe(guild, userId) {
    const tickets = await Ticket.find({ guildId: guild.id, creadorId: userId, estado: { $ne: 'Cerrado' } });
    let vivos = 0;
    for (const t of tickets) {
        if (guild.channels.cache.has(t.canalId)) vivos++;
        else {
            await Ticket.updateOne({ _id: t._id }, { estado: 'Cerrado', fechaCierre: new Date() });
            ticketCache.quitar(t.canalId);
        }
    }
    return vivos;
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            await manejar(interaction, client);
        } catch (error) {
            console.error('Error en interactionCreate:', error);
            await responderSeguro(interaction, '❌ Hubo un error al procesar tu solicitud.');
        }
    }
};

async function manejar(interaction, client) {
    // Todo el sistema de tickets ocurre dentro de un servidor, salvo las valoraciones (llegan por MD).
    const esValoracion = interaction.isButton() && interaction.customId.startsWith('csat_');
    if (!interaction.guild && !esValoracion) return;

    // ------------------------------ BOTONES ------------------------------
    if (interaction.isButton()) {
        const id = interaction.customId;

        // ABRIR TICKET -> menú de motivos
        if (id === 'create_ticket') {
            const config = await obtenerConfig(interaction.guildId);
            const max = config?.maxTicketsPorUsuario || 3;
            if (await ticketsAbiertosDe(interaction.guild, interaction.user.id) >= max) {
                return responderSeguro(interaction, `⚠️ Ya tienes ${max} tickets abiertos. Cierra alguno antes de abrir otro.`);
            }
            const motivos = listaMotivos(config);
            // El valor es el ÍNDICE: así no hay límites de longitud en customId ni problemas con nombres repetidos.
            const menu = new StringSelectMenuBuilder()
                .setCustomId('seleccionar_motivo_ticket')
                .setPlaceholder('👉 Selecciona el motivo de tu consulta...')
                .addOptions(motivos.map((m, i) => ({
                    label: String(m.nombre).slice(0, 100),
                    description: `Prioridad asignada: ${m.urgencia}`.slice(0, 100),
                    value: String(i)
                })));
            return interaction.reply({
                content: 'Por favor, selecciona una categoría para poder ayudarte mejor:',
                components: [new ActionRowBuilder().addComponents(menu)],
                flags: EFIMERO
            });
        }

        // RECLAMAR TICKET
        if (id === 'reclamar_ticket') {
            const config = await obtenerConfig(interaction.guildId);
            if (!esStaff(interaction.member, config)) return responderSeguro(interaction, '❌ Solo el equipo de soporte puede reclamar este ticket.');

            const ticket = await Ticket.findOne({ canalId: interaction.channel.id });
            if (!ticket) return responderSeguro(interaction, '❌ No se encontró este ticket en la base de datos.');
            if (ticket.asignadoA) return responderSeguro(interaction, `⚠️ Este ticket ya está siendo atendido por **${ticket.asignadoNombre}**.`);

            const avatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
            const participantes = ticket.participantes || [];
            const nuevo = participantes.some(p => p.id === interaction.user.id)
                ? {}
                : { $push: { participantes: { id: interaction.user.id, username: interaction.user.username, avatar, rol: 'Staff' } } };

            // Reclamo atómico: si dos agentes pulsan a la vez, solo uno lo consigue.
            const reclamado = await Ticket.findOneAndUpdate(
                { _id: ticket._id, asignadoA: null },
                { $set: { asignadoA: interaction.user.id, asignadoNombre: interaction.user.username, ultimaInteractStaff: new Date() }, ...nuevo },
                { returnDocument: 'after' }
            );
            if (!reclamado) return responderSeguro(interaction, '⚠️ Otro agente acaba de reclamar este ticket.');

            await registrarLogTicket(reclamado, '🙋 Ticket Reclamado', '#3498db', interaction.user.username);

            const embedOriginal = interaction.message.embeds[0];
            const embedNuevo = EmbedBuilder.from(embedOriginal).addFields({ name: '👀 Atendido por', value: `🙋‍♂️ ${interaction.user.username}`, inline: true });
            const fila = ActionRowBuilder.from(interaction.message.components[0]);
            fila.components[0].setDisabled(true);

            await interaction.update({ embeds: [embedNuevo], components: [fila] });
            return interaction.followUp({ content: `📢 El agente de soporte **${interaction.user.username}** se ha hecho cargo de este ticket.`, allowedMentions: { parse: [] } });
        }

        // AÑADIR USUARIO
        if (id === 'add_user_prompt') {
            const config = await obtenerConfig(interaction.guildId);
            if (!esStaff(interaction.member, config)) return responderSeguro(interaction, '❌ Solo el equipo de soporte puede invitar a otras personas.');
            const select = new UserSelectMenuBuilder().setCustomId('add_user_select').setPlaceholder('🔍 Busca y selecciona a un usuario...').setMinValues(1).setMaxValues(1);
            return interaction.reply({ content: 'Elige al usuario que quieres invitar a participar en este ticket:', components: [new ActionRowBuilder().addComponents(select)], flags: EFIMERO });
        }

        // CERRAR TICKET: el creador o el staff
        if (id === 'close_ticket') {
            const ticket = await Ticket.findOne({ canalId: interaction.channel.id });
            if (!ticket) return responderSeguro(interaction, '❌ No se encontró este ticket en la base de datos.');
            const config = await obtenerConfig(interaction.guildId);
            if (ticket.creadorId !== interaction.user.id && !esStaff(interaction.member, config)) {
                return responderSeguro(interaction, '❌ Solo quien abrió el ticket o el equipo de soporte puede cerrarlo.');
            }
            await interaction.reply({ content: '🔒 Generando copia de seguridad y cerrando el ticket...', flags: EFIMERO });
            const r = await cerrarTicket(client, interaction.channel.id, { autor: interaction.user.username });
            if (!r.ok) return interaction.editReply({ content: r.codigo === 'YA_CERRADO' ? '⚠️ Este ticket ya estaba cerrado.' : '❌ No se encontró este ticket.' });
            return interaction.editReply({ content: '✅ Ticket cerrado y archivado correctamente.' });
        }

        // VALORACIÓN (CSAT): solo el creador, una única vez, de 1 a 5
        if (esValoracion) {
            const [, estrellas, canalId] = interaction.customId.split('_');
            const valoracion = Number.parseInt(estrellas, 10);
            if (!Number.isInteger(valoracion) || valoracion < 1 || valoracion > 5 || !canalId) return;

            const ticket = await Ticket.findOneAndUpdate(
                { canalId, creadorId: interaction.user.id, valoracionCSAT: null },
                { valoracionCSAT: valoracion },
                { returnDocument: 'after' }
            );
            if (!ticket) return responderSeguro(interaction, 'ℹ️ Este ticket ya estaba valorado.');
            await registrarLogTicket(ticket, `⭐ Ticket Valorado (${valoracion}/5)`, '#f1c40f', ticket.creadorNombre);
            const gracias = new EmbedBuilder().setColor('#2ecc71').setTitle('💖 ¡Gracias por tu valoración!').setDescription(`Has valorado la atención recibida con **${valoracion} estrellas**.`);
            return interaction.update({ embeds: [gracias], components: [] });
        }
        return;
    }

    // ------------------- SELECCIÓN DE USUARIO (añadir al ticket) -------------------
    if (interaction.isUserSelectMenu() && interaction.customId === 'add_user_select') {
        const config = await obtenerConfig(interaction.guildId);
        if (!esStaff(interaction.member, config)) return responderSeguro(interaction, '❌ Solo el equipo de soporte puede invitar a otras personas.');

        const ticket = await Ticket.findOne({ canalId: interaction.channel.id });
        if (!ticket) return responderSeguro(interaction, '❌ Este canal no es un ticket.');

        const userId = interaction.values[0];
        const usuario = await client.users.fetch(userId);
        if (usuario.bot) return responderSeguro(interaction, '❌ No puedes añadir un bot al ticket.');

        await interaction.channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
        await interaction.update({ content: '✅ Permisos concedidos.', components: [] });
        await interaction.channel.send({ content: `👋 <@${userId}> ha sido añadido a la conversación por <@${interaction.user.id}>.`, allowedMentions: { users: [userId] } });

        if (!(ticket.participantes || []).some(p => p.id === userId)) {
            await Ticket.updateOne({ _id: ticket._id }, { $push: { participantes: { id: userId, username: usuario.username, avatar: usuario.displayAvatarURL({ extension: 'png', size: 128 }), rol: 'Invitado' } } });
        }
        return;
    }

    // ------------------------------ MENÚ -> MODAL ------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === 'seleccionar_motivo_ticket') {
        const config = await obtenerConfig(interaction.guildId);
        const motivos = listaMotivos(config);
        const indice = Number.parseInt(interaction.values[0], 10);
        const motivo = motivos[indice];
        if (!motivo) return responderSeguro(interaction, '❌ Ese motivo ya no existe. Pulsa de nuevo en «Abrir Ticket».');

        const modal = new ModalBuilder().setCustomId(`modal_abrir_ticket_${indice}`).setTitle(`Ticket: ${motivo.nombre}`.slice(0, 45));
        const asunto = new TextInputBuilder().setCustomId('asuntoInput').setLabel('Asunto del Ticket').setPlaceholder('Ej: Problema con mi compra').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
        const descripcion = new TextInputBuilder().setCustomId('descripcionInput').setLabel('Describe tu problema detalladamente').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
        modal.addComponents(new ActionRowBuilder().addComponents(asunto), new ActionRowBuilder().addComponents(descripcion));
        return interaction.showModal(modal);
    }

    // ------------------------------ CREAR TICKET ------------------------------
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_abrir_ticket_')) {
        const asunto = interaction.fields.getTextInputValue('asuntoInput').trim();
        const descripcion = interaction.fields.getTextInputValue('descripcionInput').trim();
        if (!asunto || !descripcion) return responderSeguro(interaction, '❌ El asunto y la descripción no pueden estar vacíos.');

        const msgProcesando = { content: '⏳ Procesando tu solicitud y creando el canal...', components: [], embeds: [] };
        if (interaction.isFromMessage()) await interaction.update(msgProcesando);
        else await interaction.reply({ ...msgProcesando, flags: EFIMERO });

        let canalTicket = null;
        try {
            const config = await obtenerConfig(interaction.guildId);
            const motivos = listaMotivos(config);
            const motivo = motivos[Number.parseInt(interaction.customId.replace('modal_abrir_ticket_', ''), 10)];
            if (!motivo) return interaction.editReply({ content: '❌ Ese motivo ya no existe. Vuelve a pulsar «Abrir Ticket».' });

            const max = config?.maxTicketsPorUsuario || 3;
            if (await ticketsAbiertosDe(interaction.guild, interaction.user.id) >= max) {
                return interaction.editReply({ content: `⚠️ Ya tienes ${max} tickets abiertos. Cierra alguno antes de abrir otro.` });
            }

            const urgencia = motivo.urgencia || 'Normal';
            const colorHex = (config?.urgencias || []).find(u => u.nombre === urgencia)?.color || '#3498db';
            const F = PermissionsBitField.Flags;

            const permisos = [
                { id: interaction.guild.id, deny: [F.ViewChannel] },
                { id: interaction.user.id, allow: [F.ViewChannel, F.SendMessages, F.ReadMessageHistory, F.AttachFiles] },
                { id: client.user.id, allow: [F.ViewChannel, F.SendMessages, F.ReadMessageHistory, F.ManageChannels] }
            ];
            // El rol de staff configurado ve y escribe en todos los tickets
            if (config?.rolStaffId && interaction.guild.roles.cache.has(config.rolStaffId)) {
                permisos.push({ id: config.rolStaffId, allow: [F.ViewChannel, F.SendMessages, F.ReadMessageHistory, F.AttachFiles] });
            }

            canalTicket = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`.slice(0, 100),
                type: ChannelType.GuildText,
                permissionOverwrites: permisos
            });

            const creadorAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
            const nuevoTicket = await Ticket.create({
                guildId: interaction.guild.id,
                canalId: canalTicket.id,
                creadorId: interaction.user.id,
                creadorNombre: interaction.user.username,
                creadorAvatar,
                motivo: motivo.nombre,
                titulo: asunto,
                descripcion,
                prioridad: urgencia,
                estado: 'Abierto',
                participantes: [{ id: interaction.user.id, username: interaction.user.username, avatar: creadorAvatar, rol: 'Creador' }],
                visibleWeb: true
            });
            ticketCache.agregar(canalTicket.id);
            await registrarLogTicket(nuevoTicket, '🎫 Ticket Abierto', '#2ecc71', interaction.user.username);

            const embed = new EmbedBuilder()
                .setTitle(`🎫 ${asunto}`.slice(0, 256))
                .setDescription(`**Motivo:** ${motivo.nombre}\n\n**Descripción del usuario:**\n${descripcion}\n\n*Un miembro del equipo lo revisará en breve.*`.slice(0, 4096))
                .setColor(colorHex)
                .addFields({ name: '🚨 Urgencia', value: `**${urgencia}**`, inline: true });
            const botones = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('🙋‍♂️ Reclamar Ticket').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('add_user_prompt').setLabel('➕ Añadir Usuario').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Cerrar Ticket').setStyle(ButtonStyle.Danger)
            );

            await canalTicket.send({
                content: `¡Hola <@${interaction.user.id}>! Aquí tienes tu ticket. 👇`,
                embeds: [embed],
                components: [botones],
                allowedMentions: { users: [interaction.user.id] }
            });
            await interaction.editReply({ content: `✅ Tu ticket ha sido creado exitosamente: <#${canalTicket.id}>` });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
        } catch (error) {
            console.error('Error creando ticket:', error);
            // Si el canal llegó a crearse pero algo falló después, lo limpiamos para no dejar huérfanos.
            if (canalTicket && !(await Ticket.exists({ canalId: canalTicket.id }))) await canalTicket.delete().catch(() => {});
            await interaction.editReply({ content: '❌ No se pudo crear el ticket. Avisa a un administrador (el bot necesita el permiso «Gestionar canales»).' }).catch(() => {});
        }
    }
}
