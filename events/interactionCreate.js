const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js'); 

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        
        // --- LÓGICA DE BOTONES ---
        if (interaction.isButton()) {
            
            // EL USUARIO PULSA "ABRIR TICKET"
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

            // --- LÓGICA PARA RECLAMAR EL TICKET ---
            if (interaction.customId === 'reclamar_ticket') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                    return await interaction.reply({ content: '❌ Solo el equipo de soporte puede reclamar este ticket.', ephemeral: true });
                }

                const canalId = interaction.channel.id;
                const ticket = await Ticket.findOne({ canalId: canalId });

                if (!ticket) {
                    return await interaction.reply({ content: '❌ No se encontró este ticket en la base de datos.', ephemeral: true });
                }

                if (ticket.asignadoA) {
                    return await interaction.reply({ content: `⚠️ Este ticket ya está siendo atendido por **${ticket.asignadoNombre}**.`, ephemeral: true });
                }

                ticket.asignadoA = interaction.user.id;
                ticket.asignadoNombre = interaction.user.username;
                ticket.ultimaInteractStaff = new Date();
                await ticket.save();

                const embedOriginal = interaction.message.embeds[0];
                const embedModificado = EmbedBuilder.from(embedOriginal)
                    .addFields({ name: '👀 Atendido por', value: `🙋‍♂️ ${interaction.user.username}`, inline: true });

                const filaOriginal = interaction.message.components[0];
                const filaModificada = ActionRowBuilder.from(filaOriginal);
                filaModificada.components[0].setDisabled(true); 

                await interaction.update({ embeds: [embedModificado], components: [filaModificada] });
                await interaction.followUp({ content: `📢 El agente de soporte **${interaction.user.username}** se ha hecho cargo de este ticket.` });
            }

            // --- LÓGICA PARA CERRAR EL TICKET (TRANSCRIPT + CSAT) ---
            if (interaction.customId === 'close_ticket') {
                const canal = interaction.channel;

                if (!canal) {
                    return await interaction.reply({ content: '❌ No se ha podido encontrar el canal.', ephemeral: true });
                }

                await interaction.reply({ content: 'Generando copia de seguridad y cerrando el ticket...', ephemeral: true });
                
                try {
                    const ticket = await Ticket.findOneAndUpdate(
                        { canalId: canal.id }, 
                        { estado: 'Cerrado' },
                        { returnDocument: 'after' }
                    );

                    if (ticket) {
                        const historial = await Mensaje.find({ ticketId: canal.id }).sort({ fecha: 1 });
                        
                        let transcriptTexto = `=== TRANSCRIPCIÓN DEL TICKET ===\n`;
                        transcriptTexto += `Usuario: ${ticket.creadorNombre}\n`;
                        transcriptTexto += `Motivo: ${ticket.motivo}\n`;
                        transcriptTexto += `Fecha de cierre: ${new Date().toLocaleString('es-ES')}\n`;
                        transcriptTexto += `=================================\n\n`;

                        if (historial.length === 0) {
                            transcriptTexto += `(No se registraron mensajes en la base de datos)\n`;
                        } else {
                            historial.forEach(msg => {
                                const fecha = msg.fecha ? new Date(msg.fecha).toLocaleTimeString('es-ES') : '';
                                transcriptTexto += `[${fecha}] ${msg.usuario}: ${msg.contenido}\n`;
                            });
                        }

                        const buffer = Buffer.from(transcriptTexto, 'utf-8');
                        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${ticket.creadorNombre}.txt` });

                        const embedCSAT = new EmbedBuilder()
                            .setColor('#f1c40f')
                            .setTitle('📊 ¡Tu ticket ha sido cerrado!')
                            .setDescription(`Hola **${ticket.creadorNombre}**, adjunto tienes una copia de la conversación de tu ticket por el motivo: *${ticket.motivo}*.\n\nPor favor, **valora la atención recibida** pulsando en las estrellas de abajo. ¡Nos ayuda a mejorar!`)
                            .setFooter({ text: 'Sistema de Gestión Sokyo' });

                        const filaEstrellas = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`csat_1_${canal.id}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`csat_2_${canal.id}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`csat_3_${canal.id}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`csat_4_${canal.id}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId(`csat_5_${canal.id}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
                        );

                        try {
                            const usuario = await client.users.fetch(ticket.creadorId);
                            await usuario.send({ embeds: [embedCSAT], components: [filaEstrellas], files: [attachment] });
                        } catch (errMD) {
                            console.log(`[AVISO] No se pudo enviar MD a ${ticket.creadorNombre}. Puede que tenga los MD cerrados.`);
                        }
                    }

                    setTimeout(() => {
                        canal.delete().catch(console.error);
                    }, 4000);

                } catch (error) {
                    console.error('Error al cerrar el ticket:', error);
                }
            }

            // --- LÓGICA DE VALORACIÓN (CSAT) POR MD ---
            if (interaction.customId.startsWith('csat_')) {
                const partes = interaction.customId.split('_');
                const valoracion = parseInt(partes[1]);
                const canalId = partes[2];

                try {
                    await Ticket.findOneAndUpdate(
                        { canalId: canalId }, 
                        { valoracionCSAT: valoracion }
                    );

                    const embedGracias = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('💖 ¡Gracias por tu valoración!')
                        .setDescription(`Has valorado la atención recibida con **${valoracion} estrellas**.\n¡Seguiremos trabajando para darte el mejor servicio!`)
                        .setFooter({ text: 'Sistema de Gestión Sokyo' });

                    await interaction.update({ embeds: [embedGracias], components: [] });

                } catch (error) {
                    console.error('Error al guardar CSAT:', error);
                    await interaction.reply({ content: 'Hubo un error al guardar tu valoración.', ephemeral: true });
                }
            }
        }

        // --- LÓGICA DE MENÚS DESPLEGABLES ---
        if (interaction.isStringSelectMenu()) {
            
            // EL USUARIO ELIGE UN MOTIVO (Se crea el canal)
            if (interaction.customId === 'seleccionar_motivo_ticket') {
                // 1. Ocultamos el menú al instante y ponemos mensaje de carga
                await interaction.update({ content: '⏳ Creando tu ticket, por favor espera...', components: [] }); 
                
                const motivoSeleccionado = interaction.values[0];

                try {
                    let config = await ServidorConfig.findOne({ guildId: interaction.guildId });
                    
                    const listaMotivos = (config && config.motivos && config.motivos.length > 0) 
                        ? config.motivos 
                        : [
                            { nombre: 'Fallo Técnico', urgencia: 'Normal' },
                            { nombre: 'Reportar Usuario', urgencia: 'Alta' },
                            { nombre: 'Duda de Pago', urgencia: 'Baja' }
                          ];

                    const listaUrgencias = (config && config.urgencias && config.urgencias.length > 0)
                        ? config.urgencias
                        : [
                            { nombre: 'Urgente', color: '#e74c3c', nivel: 4 },
                            { nombre: 'Alta', color: '#e67e22', nivel: 3 },
                            { nombre: 'Normal', color: '#3498db', nivel: 2 },
                            { nombre: 'Baja', color: '#95a5a6', nivel: 1 }
                          ];

                    const motivoConfig = listaMotivos.find(m => m.nombre === motivoSeleccionado);
                    const urgenciaAsignada = motivoConfig ? motivoConfig.urgencia : 'Normal';

                    const urgData = listaUrgencias.find(u => u.nombre === urgenciaAsignada);
                    const colorHex = urgData ? urgData.color : '#3498db'; 

                    const nivelesNum = listaUrgencias.map(u => u.nivel || 0);
                    const maxNivelEnServidor = nivelesNum.length > 0 ? Math.max(...nivelesNum) : 0;
                    const esPrioridadMaxima = urgData && urgData.nivel === maxNivelEnServidor;

                    const canalTicket = await interaction.guild.channels.create({
                        name: `ticket-${interaction.user.username}`,
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionsBitField.Flags.ViewChannel],
                            },
                            {
                                id: interaction.user.id,
                                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                            }
                        ]
                    });

                    await Ticket.create({
                        guildId: interaction.guild.id,
                        canalId: canalTicket.id,
                        creadorId: interaction.user.id,
                        creadorNombre: interaction.user.username,
                        motivo: motivoSeleccionado,
                        prioridad: urgenciaAsignada, 
                        estado: 'Abierto',
                        visibleWeb: true
                    });

                    const embedBienvenida = new EmbedBuilder()
                        .setTitle(`🎫 Ticket de Soporte: ${motivoSeleccionado}`)
                        .setDescription(`¡Gracias por contactar con soporte!\n\nPor favor, describe tu consulta detalladamente.\nUn miembro del equipo lo revisará en breve.`)
                        .setColor(colorHex) 
                        .addFields(
                            { name: '🚨 Urgencia del Caso', value: `**${urgenciaAsignada}**`, inline: true }
                        );

                    const rowBotones = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('reclamar_ticket')
                            .setLabel('🙋‍♂️ Reclamar Ticket')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('close_ticket') 
                            .setLabel('🔒 Cerrar Ticket')
                            .setStyle(ButtonStyle.Danger)
                    );
                    
                    const contenidoMensaje = esPrioridadMaxima 
                        ? `⚠️ **¡ATENCIÓN STAFF! ¡Ticket de ALERTA MÁXIMA [${urgenciaAsignada}] abierto por <@${interaction.user.id}>!**` 
                        : `¡Hola <@${interaction.user.id}>! Necesitamos un poco más de información. 👇`;

                    await canalTicket.send({ 
                        content: contenidoMensaje,
                        embeds: [embedBienvenida],
                        components: [rowBotones] 
                    });

                    // 2. Editamos el mensaje de carga para confirmar la creación
                    await interaction.editReply({ 
                        content: `✅ Tu ticket ha sido creado exitosamente: <#${canalTicket.id}>\n*(Este mensaje desaparecerá en 5 segundos)*`
                    });

                    // 3. Autodestrucción del mensaje a los 5 segundos
                    setTimeout(() => {
                        interaction.deleteReply().catch(console.error);
                    }, 5000);

                } catch (error) {
                    console.error('Error al crear el ticket desde el menú:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al crear el ticket en el servidor.' });
                }
            }
        }
    }
};