const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const { cerrarTicket, registrarLogTicket } = require('../utils/ticketManager.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        
        // --- LÓGICA DE BOTONES ---
        if (interaction.isButton()) {
            
            // ABRIR TICKET (Muestra el menú de motivos)
            if (interaction.customId === 'create_ticket') {
                try {
                    let config = await ServidorConfig.findOne({ guildId: interaction.guildId });
                    
                    const listaMotivos = (config && config.motivos && config.motivos.length > 0) 
                        ? config.motivos 
                        : [
                            { nombre: 'Fallo Técnico', urgencia: 'Normal' },
                            { nombre: 'Reportar Usuario', urgencia: 'Alta' },
                            { nombre: 'Duda de Pago', urgencia: 'Baja' }
                          ];

                    const menuMotivos = new StringSelectMenuBuilder()
                        .setCustomId('seleccionar_motivo_ticket')
                        .setPlaceholder('👉 Selecciona el motivo de tu consulta...')
                        .addOptions(
                            listaMotivos.map((motivo) => ({
                                label: motivo.nombre, 
                                description: `Prioridad asignada: ${motivo.urgencia}`,
                                value: motivo.nombre,
                            }))
                        );

                    const filaComponentes = new ActionRowBuilder().addComponents(menuMotivos);

                    await interaction.reply({
                        content: 'Por favor, selecciona una categoría para poder ayudarte mejor:',
                        components: [filaComponentes],
                        ephemeral: true 
                    });

                } catch (error) {
                    console.error('Error al mostrar menú de motivos:', error);
                    await interaction.reply({ content: '❌ Hubo un error al procesar tu solicitud.', ephemeral: true });
                }
            }

            // RECLAMAR TICKET (Guarda al staff en los implicados)
            if (interaction.customId === 'reclamar_ticket') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                    return await interaction.reply({ content: '❌ Solo el equipo de soporte puede reclamar este ticket.', ephemeral: true });
                }

                const canalId = interaction.channel.id;
                const ticket = await Ticket.findOne({ canalId: canalId });

                if (!ticket) return await interaction.reply({ content: '❌ No se encontró este ticket en la base de datos.', ephemeral: true });
                if (ticket.asignadoA) return await interaction.reply({ content: `⚠️ Este ticket ya está siendo atendido por **${ticket.asignadoNombre}**.`, ephemeral: true });

                const staffAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
                
                if (!ticket.participantes) ticket.participantes = [];
                if (!ticket.participantes.some(p => p.id === interaction.user.id)) {
                    ticket.participantes.push({ id: interaction.user.id, username: interaction.user.username, avatar: staffAvatar, rol: 'Staff' });
                }

                ticket.asignadoA = interaction.user.id;
                ticket.asignadoNombre = interaction.user.username;
                ticket.ultimaInteractStaff = new Date();
                await ticket.save();

                await registrarLogTicket(ticket, '🙋 Ticket Reclamado', '#3498db', interaction.user.username);

                const embedOriginal = interaction.message.embeds[0];
                const embedModificado = EmbedBuilder.from(embedOriginal).addFields({ name: '👀 Atendido por', value: `🙋‍♂️ ${interaction.user.username}`, inline: true });

                const filaOriginal = interaction.message.components[0];
                const filaModificada = ActionRowBuilder.from(filaOriginal);
                filaModificada.components[0].setDisabled(true); 

                await interaction.update({ embeds: [embedModificado], components: [filaModificada] });
                await interaction.followUp({ content: `📢 El agente de soporte **${interaction.user.username}** se ha hecho cargo de este ticket.` });
            }

            // AÑADIR USUARIO AL TICKET
            if (interaction.customId === 'add_user_prompt') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                    return await interaction.reply({ content: '❌ Solo el equipo de soporte puede invitar a otras personas.', ephemeral: true });
                }

                const userSelect = new UserSelectMenuBuilder().setCustomId('add_user_select').setPlaceholder('🔍 Busca y selecciona a un usuario...').setMinValues(1).setMaxValues(1);
                const row = new ActionRowBuilder().addComponents(userSelect);
                await interaction.reply({ content: 'Elige al usuario que quieres invitar a participar en este ticket:', components: [row], ephemeral: true });
            }

            // CERRAR TICKET (transcript + CSAT + archivado, vía módulo compartido)
            if (interaction.customId === 'close_ticket') {
                const canal = interaction.channel;
                if (!canal) return await interaction.reply({ content: '❌ No se ha podido encontrar el canal.', ephemeral: true });

                await interaction.reply({ content: '🔒 Generando copia de seguridad y cerrando el ticket...', ephemeral: true });

                try {
                    const res = await cerrarTicket(client, canal.id, { autor: interaction.user.username });
                    if (!res.ok) return await interaction.editReply({ content: '❌ No se encontró este ticket en la base de datos.' });
                    await interaction.editReply({ content: '✅ Ticket cerrado y archivado correctamente.' });
                } catch (error) {
                    console.error('Error al cerrar:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al cerrar el ticket.' }).catch(() => {});
                }
            }

            if (interaction.customId.startsWith('csat_')) {
                const partes = interaction.customId.split('_');
                const valoracion = parseInt(partes[1]);
                try {
                    const ticket = await Ticket.findOneAndUpdate({ canalId: partes[2] }, { valoracionCSAT: valoracion }, { new: true });
                    if (ticket) await registrarLogTicket(ticket, `⭐ Ticket Valorado (${valoracion}/5)`, '#f1c40f', ticket.creadorNombre);
                    const embedGracias = new EmbedBuilder().setColor('#2ecc71').setTitle('💖 ¡Gracias por tu valoración!').setDescription(`Has valorado la atención recibida con **${valoracion} estrellas**.`);
                    await interaction.update({ embeds: [embedGracias], components: [] });
                } catch (e) { await interaction.reply({ content: 'Error al guardar.', ephemeral: true }); }
            }
        }

        // --- LÓGICA DE SELECCIÓN DE USUARIO (Guardar en DB) ---
        if (interaction.isUserSelectMenu() && interaction.customId === 'add_user_select') {
            const userIdToAdd = interaction.values[0];
            const canal = interaction.channel;

            try {
                await canal.permissionOverwrites.edit(userIdToAdd, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await interaction.update({ content: `✅ Permisos concedidos.`, components: [] });
                await canal.send({ content: `👋 El usuario <@${userIdToAdd}> ha sido añadido a la conversación por <@${interaction.user.id}>.` });

                const addedUser = await client.users.fetch(userIdToAdd);
                const addedAvatar = addedUser.displayAvatarURL({ extension: 'png', size: 128 });
                const ticket = await Ticket.findOne({ canalId: canal.id });
                
                if (ticket) {
                    if (!ticket.participantes) ticket.participantes = [];
                    if (!ticket.participantes.some(p => p.id === userIdToAdd)) {
                        ticket.participantes.push({ id: userIdToAdd, username: addedUser.username, avatar: addedAvatar, rol: 'Invitado' });
                        await ticket.save();
                    }
                }
            } catch (error) { console.error(error); }
        }

        // --- MENÚ DESPLEGABLE A MODAL ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'seleccionar_motivo_ticket') {
            const modal = new ModalBuilder().setCustomId(`modal_abrir_ticket_${interaction.values[0]}`).setTitle(`Ticket: ${interaction.values[0]}`);
            const asuntoInput = new TextInputBuilder().setCustomId('asuntoInput').setLabel("Asunto del Ticket").setPlaceholder("Ej: Problema con la base de datos").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
            const descripcionInput = new TextInputBuilder().setCustomId('descripcionInput').setLabel("Describe tu problema detalladamente").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
            modal.addComponents(new ActionRowBuilder().addComponents(asuntoInput), new ActionRowBuilder().addComponents(descripcionInput));
            await interaction.showModal(modal);
            // El menú efímero se limpia al enviar el modal (interaction.update en el handler del modal).
        }

        // --- CREACIÓN DEL TICKET DESDE EL MODAL ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_abrir_ticket_')) {
            const motivo = interaction.customId.replace('modal_abrir_ticket_', '');
            const asunto = interaction.fields.getTextInputValue('asuntoInput');
            const descripcion = interaction.fields.getTextInputValue('descripcionInput');

            // El modal proviene del menú efímero de categorías; update() edita ese mensaje
            // y elimina el desplegable de "selecciona una categoría".
            if (interaction.isFromMessage()) {
                await interaction.update({ content: '⏳ Procesando tu solicitud y creando el canal...', components: [], embeds: [] });
            } else {
                await interaction.reply({ content: '⏳ Procesando tu solicitud y creando el canal...', ephemeral: true });
            }

            try {
                let config = await ServidorConfig.findOne({ guildId: interaction.guildId });
                const listaMotivos = (config && config.motivos && config.motivos.length > 0) ? config.motivos : [];
                const listaUrgencias = (config && config.urgencias && config.urgencias.length > 0) ? config.urgencias : [];
                const urgencia = listaMotivos.find(m => m.nombre === motivo)?.urgencia || 'Normal';
                const colorHex = listaUrgencias.find(u => u.nombre === urgencia)?.color || '#3498db'; 

                const canalTicket = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                // AQUÍ ES DONDE DEBE IR LA FOTO:
                const creadorAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });

                const nuevoTicket = await Ticket.create({
                    guildId: interaction.guild.id,
                    canalId: canalTicket.id,
                    creadorId: interaction.user.id,
                    creadorNombre: interaction.user.username,
                    creadorAvatar: creadorAvatar, // FOTO GUARDADA CORRECTAMENTE EN LA BASE DE DATOS
                    motivo: motivo,
                    titulo: asunto,
                    descripcion: descripcion,
                    prioridad: urgencia,
                    estado: 'Abierto',
                    participantes: [{ id: interaction.user.id, username: interaction.user.username, avatar: creadorAvatar, rol: 'Creador' }],
                    visibleWeb: true
                });

                await registrarLogTicket(nuevoTicket, '🎫 Ticket Abierto', '#2ecc71', interaction.user.username);

                const embedBienvenida = new EmbedBuilder().setTitle(`🎫 ${asunto}`).setDescription(`**Motivo:** ${motivo}\n\n**Descripción del usuario:**\n${descripcion}\n\n*Un miembro del equipo lo revisará en breve.*`).setColor(colorHex).addFields({ name: '🚨 Urgencia', value: `**${urgencia}**`, inline: true });
                const rowBotones = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('🙋‍♂️ Reclamar Ticket').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('add_user_prompt').setLabel('➕ Añadir Usuario').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Cerrar Ticket').setStyle(ButtonStyle.Danger)
                );
                
                await canalTicket.send({ content: `¡Hola <@${interaction.user.id}>! Aquí tienes tu ticket. 👇`, embeds: [embedBienvenida], components: [rowBotones] });
                await interaction.editReply({ content: `✅ Tu ticket ha sido creado exitosamente: <#${canalTicket.id}>` });
                setTimeout(() => interaction.deleteReply().catch(console.error), 5000);

            } catch (error) { console.error(error); await interaction.editReply({ content: '❌ Hubo un error.' }); }
        }
    }
};